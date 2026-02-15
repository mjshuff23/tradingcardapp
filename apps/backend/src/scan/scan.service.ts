import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CollectionStatus, Prisma } from '@prisma/client';
import { buildCardKey } from '../common/card-key.util';
import { StructuredCardHints } from '../common/card-hints.util';
import { normalizeText, overlapScore, tokenize } from '../common/normalize.util';
import { levenshteinSimilarity, tokenCoverageScore } from '../common/similarity.util';
import { SourceHint } from '../common/source-hint.type';
import { UploadedFile } from '../common/uploaded-file.type';
import { LookupService } from '../lookup/lookup.service';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService } from '../ocr/ocr.service';
import { StorageService } from '../storage/storage.service';
import { ValidationService } from '../validation/validation.service';
import { ConfirmScanDto } from './dto/confirm-scan.dto';
import { LinkPreviewService } from './link-preview.service';

type CandidateReference = {
  name: string;
  set: string | null;
  year: number | null;
  player: string | null;
  variant: string | null;
  sport: string | null;
  source: string;
  metadata?: Prisma.JsonValue | null;
};

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocrService: OcrService,
    private readonly storageService: StorageService,
    private readonly validationService: ValidationService,
    private readonly lookupService: LookupService,
    private readonly linkPreviewService: LinkPreviewService,
  ) {}

  async createScan(params: { frontFile?: UploadedFile; backFile?: UploadedFile }) {
    const frontFile = params.frontFile;
    const backFile = params.backFile;

    if (!frontFile || !frontFile.buffer) {
      throw new BadRequestException('Front image file is required.');
    }

    const [frontStoredImage, backStoredImage] = await Promise.all([
      this.storageService.uploadScanImage(frontFile.buffer, frontFile.originalname),
      backFile
        ? this.storageService.uploadScanImage(backFile.buffer, backFile.originalname)
        : Promise.resolve(null),
    ]);

    const scanJob = await this.prisma.scanJob.create({
      data: {
        status: 'QUEUED',
        sourceFilename: frontFile.originalname,
        originalImageKey: frontStoredImage.originalKey,
        thumbnailImageKey: frontStoredImage.thumbnailKey,
        backSourceFilename: backFile?.originalname,
        backOriginalImageKey: backStoredImage?.originalKey,
        backThumbnailImageKey: backStoredImage?.thumbnailKey,
      },
    });

    void this.processScan(scanJob.id, {
      frontBuffer: frontFile.buffer,
      frontFilename: frontFile.originalname,
      backBuffer: backFile?.buffer,
      backFilename: backFile?.originalname,
    });

    return {
      scanId: scanJob.id,
      status: scanJob.status,
    };
  }

  async getScan(scanId: number) {
    const scanJob = await this.prisma.scanJob.findUnique({
      where: { id: scanId },
      include: {
        candidates: {
          orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!scanJob) {
      throw new NotFoundException('Scan not found.');
    }

    const enrichedCandidates = await Promise.all(
      scanJob.candidates.map(async (candidate) => {
        const sourceHints = this.normalizeSourceHints(candidate.sourceHints);
        const enrichedSourceHints = await this.enrichSourceHintsWithPreviewImages(sourceHints);
        return {
          ...candidate,
          sourceHints: enrichedSourceHints,
        };
      }),
    );

    return {
      ...scanJob,
      frontImageUrl: scanJob.thumbnailImageKey
        ? `/api/v1/scans/${scanId}/image/front`
        : null,
      backImageUrl: scanJob.backThumbnailImageKey
        ? `/api/v1/scans/${scanId}/image/back`
        : null,
      candidates: enrichedCandidates,
    };
  }

  async getScanImage(
    scanId: number,
    side: 'front' | 'back',
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const scanJob = await this.prisma.scanJob.findUnique({
      where: { id: scanId },
      select: {
        originalImageKey: true,
        thumbnailImageKey: true,
        backOriginalImageKey: true,
        backThumbnailImageKey: true,
      },
    });

    if (!scanJob) {
      throw new NotFoundException('Scan not found.');
    }

    const key =
      side === 'front'
        ? scanJob.thumbnailImageKey ?? scanJob.originalImageKey
        : scanJob.backThumbnailImageKey ?? scanJob.backOriginalImageKey;

    if (!key) {
      throw new NotFoundException(`${side} image not found for this scan.`);
    }

    return this.storageService.readImage(key);
  }

  async confirmScan(scanId: number, dto: ConfirmScanDto) {
    const scanJob = await this.prisma.scanJob.findUnique({
      where: { id: scanId },
      include: { candidates: true },
    });

    if (!scanJob) {
      throw new NotFoundException('Scan not found.');
    }

    if (!scanJob.candidates.length) {
      throw new BadRequestException('No scan candidates available to confirm.');
    }

    const sortedCandidates = [...scanJob.candidates].sort((a, b) => b.score - a.score);
    const selectedCandidate = dto.candidateId
      ? scanJob.candidates.find((candidate) => candidate.id === dto.candidateId)
      : sortedCandidates[0];

    if (!selectedCandidate) {
      throw new BadRequestException('Selected candidate was not found.');
    }

    const merged = {
      name: dto.overrides?.name ?? selectedCandidate.name,
      set: dto.overrides?.set ?? selectedCandidate.set,
      year: dto.overrides?.year ?? selectedCandidate.year,
      player: dto.overrides?.player ?? selectedCandidate.player,
      variant: dto.overrides?.variant ?? selectedCandidate.variant,
      sport: dto.overrides?.sport ?? selectedCandidate.sport,
    };

    if (!merged.name) {
      throw new BadRequestException('Card name is required when confirming a scan.');
    }

    await this.prisma.scanCandidate.updateMany({
      where: { scanJobId: scanId },
      data: { chosen: false },
    });

    await this.prisma.scanCandidate.update({
      where: { id: selectedCandidate.id },
      data: { chosen: true },
    });

    const card = await this.prisma.card.create({
      data: {
        name: merged.name,
        set: merged.set,
        year: merged.year,
        player: merged.player,
        variant: merged.variant,
        sport: merged.sport,
        imageUrl: scanJob.thumbnailImageKey ?? scanJob.originalImageKey,
        originalImageKey: scanJob.originalImageKey,
        thumbnailImageKey: scanJob.thumbnailImageKey,
        confidence: Number(
          ((selectedCandidate.score + (selectedCandidate.validationScore ?? 0)) / 2).toFixed(3),
        ),
        collectionStatus: dto.collectionStatus ?? CollectionStatus.OWNED,
        scanJobId: scanJob.id,
      },
    });

    await this.prisma.scanJob.update({
      where: { id: scanJob.id },
      data: { status: 'CONFIRMED' },
    });

    return card;
  }

  private async processScan(
    scanId: number,
    input: {
      frontBuffer: Buffer;
      frontFilename: string;
      backBuffer?: Buffer;
      backFilename?: string;
    },
  ) {
    await this.prisma.scanJob.update({
      where: { id: scanId },
      data: { status: 'PROCESSING' },
    });

    try {
      const ocrResult = await this.ocrService.extractText({
        frontBuffer: input.frontBuffer,
        frontFilename: input.frontFilename,
        backBuffer: input.backBuffer,
        backFilename: input.backFilename,
      });

      const lookup = await this.lookupService.lookup({
        frontBuffer: input.frontBuffer,
        backBuffer: input.backBuffer,
        ocrText: ocrResult.text,
        hints: ocrResult.hints,
      });

      const references = await this.loadCandidateReferences();
      const candidates = this.rankCandidates(
        {
          text: ocrResult.text,
          backText: ocrResult.backText,
          hints: ocrResult.hints,
          lookup,
        },
        references,
      ).slice(0, 8);

      await this.prisma.$transaction([
        this.prisma.scanCandidate.deleteMany({ where: { scanJobId: scanId } }),
        ...candidates.map((candidate) =>
          this.prisma.scanCandidate.create({
            data: {
              scanJobId: scanId,
              name: candidate.name,
              set: candidate.set,
              year: candidate.year,
              player: candidate.player,
              variant: candidate.variant,
              sport: candidate.sport,
              score: candidate.score,
              validationScore: candidate.validationScore,
              sourceHints: candidate.sourceHints as unknown as Prisma.JsonArray,
            },
          }),
        ),
        this.prisma.scanJob.update({
          where: { id: scanId },
          data: {
            status: 'NEEDS_REVIEW',
            ocrText: ocrResult.text,
            error: null,
          },
        }),
      ]);
    } catch (error) {
      this.logger.error(`Failed processing scan ${scanId}: ${(error as Error).message}`);
      await this.prisma.scanJob.update({
        where: { id: scanId },
        data: {
          status: 'FAILED',
          error: (error as Error).message,
        },
      });
    }
  }

  private async loadCandidateReferences(): Promise<CandidateReference[]> {
    const existingCards = await this.prisma.card.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 1200,
    });

    const catalogDerived: CandidateReference[] = existingCards.map((card) => ({
      name: card.name,
      set: card.set,
      year: card.year,
      player: card.player,
      variant: card.variant,
      sport: card.sport,
      source: 'catalog_card',
      metadata: {
        fromCardId: card.id,
      },
    }));

    return this.dedupeReferencesByKey(catalogDerived);
  }

  private rankCandidates(
    ocr: {
      text: string;
      backText: string;
      hints: StructuredCardHints;
      lookup: {
        corpus: string;
        hints: SourceHint[];
      };
    },
    references: CandidateReference[],
  ) {
    const ocrText = ocr.text;
    const backText = ocr.backText || '';
    const ocrTokens = tokenize(ocrText);
    const lookupCorpus = ocr.lookup.corpus;
    const lookupHints = ocr.lookup.hints;
    const lockedPlayer = this.detectLockedPlayer(
      `${ocrText} ${backText} ${lookupCorpus}`,
      references,
    );
    const lookupDerivedReferences = this.buildLookupDerivedReferences(lookupHints, lockedPlayer);
    const allReferences = this.dedupeReferencesByKey([...references, ...lookupDerivedReferences]);

    if (!allReferences.length) {
      const fallbackValidation = this.validationService.validateCandidate(
        {
          name: ocrText || 'Unknown Card',
        },
        ocrText,
      );

      return [
        {
          name: ocrText || 'Unknown Card',
          set: null,
          year: null,
          player: null,
          variant: null,
          sport: null,
          score: 0.15,
          validationScore: fallbackValidation.validationScore,
          sourceHints: fallbackValidation.sourceHints,
        },
      ];
    }

    const ranked = allReferences
      .map((reference) => {
        const searchable = [
          reference.year,
          reference.player,
          reference.name,
          reference.set,
          reference.variant,
          reference.sport,
        ]
          .filter(Boolean)
          .join(' ');

        const normalizedSearchable = normalizeText(searchable);
        const overlap = overlapScore(ocrTokens, tokenize(searchable));
        const coverage = tokenCoverageScore(ocrText, searchable);
        const fuzzy = levenshteinSimilarity(normalizeText(ocrText).slice(0, 220), normalizedSearchable);

        const yearBonus = this.computeYearBonus(reference.year, ocr.hints.years, ocrText);
        const playerBonus = this.computePlayerBonus(reference.player, ocrText, backText);
        const playerLockBonus = this.computePlayerLockBonus(reference.player, lockedPlayer);
        const setBonus = this.computeSetBonus(reference, ocrText, backText, ocr.hints.brands);
        const numberBonus = this.computeNumberBonus(reference.metadata, ocr.hints.cardNumbers);
        const lookupBonus = this.computeLookupBonus(searchable, lookupCorpus);

        const score = Number(
          Math.max(
            0,
            Math.min(
              1,
              coverage * 0.33 +
                overlap * 0.18 +
                fuzzy * 0.15 +
                yearBonus +
                playerBonus +
                playerLockBonus +
                setBonus +
                numberBonus +
                lookupBonus,
            ),
          ).toFixed(3),
        );

        const validation = this.validationService.validateCandidate(reference, ocrText);
        const matchedLookupHints = this.selectLookupHintsForCandidate(searchable, lookupHints);

        return {
          ...reference,
          score,
          validationScore: validation.validationScore,
          sourceHints: [...validation.sourceHints, ...matchedLookupHints],
        };
      })
      .sort((a, b) => {
        if (b.score === a.score) {
          return (b.validationScore ?? 0) - (a.validationScore ?? 0);
        }

        return b.score - a.score;
      });

    const playerFiltered = this.filterByLockedPlayer(ranked, lockedPlayer);
    return this.trimLowConfidenceTail(playerFiltered);
  }

  private computeYearBonus(referenceYear: number | null, hintYears: number[], ocrText: string): number {
    if (!referenceYear) {
      return 0;
    }

    if (hintYears.includes(referenceYear)) {
      return 0.22;
    }

    if (normalizeText(ocrText).includes(String(referenceYear))) {
      return 0.1;
    }

    return 0;
  }

  private computePlayerBonus(player: string | null, ocrText: string, backText: string): number {
    if (!player) {
      return 0;
    }

    const playerTokens = tokenize(player);
    if (!playerTokens.length) {
      return 0;
    }

    const backTokens = new Set(tokenize(backText));
    const allInBack = playerTokens.every((token) => backTokens.has(token));
    if (allInBack) {
      return 0.22;
    }

    const fullTokens = new Set(tokenize(ocrText));
    const allInFull = playerTokens.every((token) => fullTokens.has(token));
    if (allInFull) {
      return 0.12;
    }

    return 0;
  }

  private computePlayerLockBonus(player: string | null, lockedPlayer: string | null): number {
    if (!lockedPlayer) {
      return 0;
    }

    const normalizedPlayer = normalizeText(player);
    if (!normalizedPlayer) {
      return -0.3;
    }

    if (normalizedPlayer === lockedPlayer) {
      return 0.24;
    }

    return -0.35;
  }

  private computeSetBonus(
    reference: { set: string | null; source: string },
    ocrText: string,
    backText: string,
    brandHints: string[],
  ): number {
    const setNormalized = normalizeText(reference.set);
    const sourceNormalized = normalizeText(reference.source);
    const full = normalizeText(ocrText);
    const back = normalizeText(backText);

    let bonus = 0;
    if (setNormalized && back.includes(setNormalized)) {
      bonus += 0.1;
    } else if (setNormalized && full.includes(setNormalized)) {
      bonus += 0.05;
    }

    if (brandHints.some((brand) => setNormalized.includes(brand) || sourceNormalized.includes(brand))) {
      bonus += 0.06;
    }

    return Number(Math.min(0.16, bonus).toFixed(3));
  }

  private computeNumberBonus(metadata: Prisma.JsonValue | null | undefined, cardNumbers: string[]): number {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || !cardNumbers.length) {
      return 0;
    }

    const refNumberRaw = (metadata as Record<string, unknown>).number;
    if (typeof refNumberRaw !== 'string' || !refNumberRaw.trim()) {
      return 0;
    }

    const normalizedRefNumber = refNumberRaw.trim().toUpperCase();
    return cardNumbers.includes(normalizedRefNumber) ? 0.3 : 0;
  }

  private computeLookupBonus(searchable: string, lookupCorpus: string): number {
    if (!lookupCorpus) {
      return 0;
    }

    const coverage = tokenCoverageScore(lookupCorpus, searchable);
    return Number((coverage * 0.22).toFixed(3));
  }

  private selectLookupHintsForCandidate(searchable: string, hints: SourceHint[]): SourceHint[] {
    if (!hints.length) {
      return [];
    }

    return hints
      .filter((hint) => tokenCoverageScore(`${hint.title} ${hint.url}`, searchable) >= 0.25)
      .slice(0, 2);
  }

  private normalizeSourceHints(value: Prisma.JsonValue | null | undefined): SourceHint[] {
    if (!value || !Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item) => typeof item === 'object' && item !== null)
      .map((item) => item as unknown as SourceHint)
      .filter((hint) => Boolean(hint.url && hint.title));
  }

  private async enrichSourceHintsWithPreviewImages(hints: SourceHint[]): Promise<SourceHint[]> {
    if (!hints.length) {
      return [];
    }

    const uniqueUrls = Array.from(new Set(hints.map((hint) => hint.url))).slice(0, 4);
    const imageByUrl = new Map<string, string | null>();

    await Promise.all(
      uniqueUrls.map(async (url) => {
        const image = await this.linkPreviewService.getPreviewImage(url);
        imageByUrl.set(url, image);
      }),
    );

    return hints.map((hint) => ({
      ...hint,
      imageUrl: hint.imageUrl ?? imageByUrl.get(hint.url) ?? undefined,
    }));
  }

  private detectLockedPlayer(
    corpusText: string,
    references: Array<{ player: string | null }>,
  ): string | null {
    const corpusTokens = new Set(tokenize(corpusText));
    if (!corpusTokens.size) {
      return null;
    }

    const uniquePlayers = Array.from(
      new Set(
        references
          .map((reference) => normalizeText(reference.player))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const fullMatches = uniquePlayers.filter((player) => {
      const tokens = tokenize(player).filter((token) => token.length >= 3);
      if (tokens.length < 2) {
        return false;
      }

      return tokens.every((token) => corpusTokens.has(token));
    });

    if (fullMatches.length !== 1) {
      return null;
    }

    return fullMatches[0];
  }

  private buildLookupDerivedReferences(
    hints: SourceHint[],
    lockedPlayer: string | null,
  ): CandidateReference[] {
    const candidates: CandidateReference[] = [];

    for (const hint of hints) {
      if (hint.source !== 'web_lookup' || !hint.title) {
        continue;
      }

      const normalizedTitle = normalizeText(hint.title);
      if (lockedPlayer && !normalizedTitle.includes(lockedPlayer)) {
        continue;
      }

      const parsed = this.parseLookupHintTitle(hint.title, lockedPlayer);
      if (!parsed) {
        continue;
      }

      candidates.push({
        ...parsed,
        source: 'lookup_hint',
        metadata: {
          lookupUrl: hint.url,
          lookupProvider: hint.provider ?? 'web_lookup',
          lookupScore: hint.score,
          number: hint.title.match(/#\s*([a-z]?\d{1,4}[a-z]?)/i)?.[1]?.toUpperCase() ?? null,
        },
      });
    }

    return candidates;
  }

  private parseLookupHintTitle(
    title: string,
    lockedPlayer: string | null,
  ): Omit<CandidateReference, 'source' | 'metadata'> | null {
    const segments = title
      .split(' - ')
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (!segments.length) {
      return null;
    }

    const normalizedTitle = normalizeText(title);
    const yearMatch = normalizedTitle.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : null;

    const set = this.extractLookupSet(segments, normalizedTitle);
    const variant = this.extractLookupVariant(segments);
    const player = lockedPlayer ? this.titleCase(lockedPlayer) : null;
    const name = this.extractLookupName(segments, lockedPlayer);

    if (!name) {
      return null;
    }

    return {
      name,
      set,
      year,
      player,
      variant,
      sport: this.extractLookupSport(normalizedTitle),
    };
  }

  private extractLookupSet(segments: string[], normalizedTitle: string): string | null {
    const setKeywords = [
      'upper deck',
      'topps',
      'panini',
      'skybox',
      'donruss',
      'prizm',
      'hoops',
      'fleer',
      'bowman',
      'score',
      'pokemon',
      'sp authentic',
      'chrome',
      'optic',
    ];

    for (const keyword of setKeywords) {
      if (!normalizedTitle.includes(keyword)) {
        continue;
      }

      const segment = segments.find((item) => normalizeText(item).includes(keyword));
      if (segment) {
        return segment.replace(/\[[^\]]+]/g, '').trim();
      }

      return this.titleCase(keyword);
    }

    return null;
  }

  private extractLookupVariant(segments: string[]): string | null {
    const segmentWithVariant = segments.find((segment) => /\[[^\]]+]/.test(segment));
    if (!segmentWithVariant) {
      return null;
    }

    const variant = segmentWithVariant.match(/\[([^\]]+)\]/)?.[1]?.trim();
    return variant || null;
  }

  private extractLookupName(segments: string[], lockedPlayer: string | null): string | null {
    if (lockedPlayer) {
      const playerIndex = segments.findIndex(
        (segment) => normalizeText(segment) === lockedPlayer,
      );
      if (playerIndex > 0) {
        const candidate = this.cleanLookupNameSegment(segments[playerIndex - 1]);
        if (candidate) {
          return candidate;
        }
      }
    }

    for (const segment of segments) {
      const cleaned = this.cleanLookupNameSegment(segment);
      if (!cleaned) {
        continue;
      }

      const normalized = normalizeText(cleaned);
      if (
        normalized.length < 3 ||
        /\b(19\d{2}|20\d{2})\b/.test(normalized) ||
        normalized.includes('comc') ||
        normalized.includes('ebay') ||
        normalized.includes('psa')
      ) {
        continue;
      }

      return cleaned;
    }

    return null;
  }

  private cleanLookupNameSegment(value: string): string | null {
    const cleaned = value
      .replace(/\[[^\]]+]/g, ' ')
      .replace(/#\s*[a-z]?\d{1,4}[a-z]?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || null;
  }

  private extractLookupSport(normalizedTitle: string): string | null {
    if (normalizedTitle.includes('pokemon')) {
      return 'pokemon';
    }
    if (
      normalizedTitle.includes('nba') ||
      normalizedTitle.includes('basketball') ||
      normalizedTitle.includes('bulls')
    ) {
      return 'basketball';
    }

    return null;
  }

  private titleCase(value: string): string {
    return value
      .split(' ')
      .filter(Boolean)
      .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
      .join(' ');
  }

  private dedupeReferencesByKey(references: CandidateReference[]): CandidateReference[] {
    const map = new Map<string, CandidateReference>();

    for (const reference of references) {
      const key = buildCardKey({
        name: reference.name,
        set: reference.set,
        year: reference.year,
        player: reference.player,
        variant: reference.variant,
        sport: reference.sport,
      });

      const existing = map.get(key);
      if (!existing) {
        map.set(key, reference);
        continue;
      }

      if (reference.source === 'lookup_hint' && existing.source !== 'lookup_hint') {
        map.set(key, reference);
      }
    }

    return [...map.values()];
  }

  private filterByLockedPlayer<
    T extends {
      player: string | null;
      score: number;
    },
  >(candidates: T[], lockedPlayer: string | null): T[] {
    if (!lockedPlayer) {
      return candidates;
    }

    const matching = candidates.filter(
      (candidate) => normalizeText(candidate.player) === lockedPlayer,
    );

    if (matching.length > 0) {
      return matching;
    }

    return candidates;
  }

  private trimLowConfidenceTail<
    T extends {
      score: number;
      validationScore: number | null;
    },
  >(candidates: T[]): T[] {
    if (!candidates.length) {
      return candidates;
    }

    const topScore = candidates[0].score;
    const floor = Math.max(0.08, Number((topScore * 0.35).toFixed(3)));

    const trimmed = candidates.filter((candidate, index) => {
      if (index < 3) {
        return true;
      }

      return candidate.score >= floor;
    });

    return trimmed.slice(0, 8);
  }

}
