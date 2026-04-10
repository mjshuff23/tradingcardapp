import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import sharp from "sharp";
import { CollectionStatus, Prisma } from "../prisma/client";
import { buildCardKey } from "../common/card-key.util";
import { StructuredCardHints } from "../common/card-hints.util";
import {
  normalizeText,
  overlapScore,
  tokenize,
} from "../common/normalize.util";
import {
  levenshteinSimilarity,
  tokenCoverageScore,
} from "../common/similarity.util";
import { SourceHint } from "../common/source-hint.type";
import { UploadedFile } from "../common/uploaded-file.type";
import { LookupService } from "../lookup/lookup.service";
import { PrismaService } from "../prisma/prisma.service";
import { OcrService } from "../ocr/ocr.service";
import { StorageService } from "../storage/storage.service";
import { ValidationService } from "../validation/validation.service";
import { CatalogIndexService } from "../catalog/catalog-index.service";
import { TitleNormalizationService } from "../catalog/title-normalization.service";
import { ConfirmScanDto } from "./dto/confirm-scan.dto";
import { LinkPreviewService } from "./link-preview.service";
import {
  computeImageQualityFromSignals,
  computeOverallQuality,
  computePersistedConfidence,
  ScanCandidateDiagnostics,
  ScanJobDiagnostics,
  toStructuredHintCounts,
  totalStructuredHintCount,
} from "./scan-diagnostics.util";

type CandidateReference = {
  name: string;
  set: string | null;
  setName: string | null;
  legacySetText: string | null;
  brand: string | null;
  year: number | null;
  season: string | null;
  cardNumber: string | null;
  player: string | null;
  variant: string | null;
  sport: string | null;
  source: string;
  metadata?: Prisma.JsonValue | null;
};

type RankedCandidate = CandidateReference & {
  score: number;
  validationScore: number | null;
  sourceHints: SourceHint[];
  diagnostics: ScanCandidateDiagnostics;
};

type ImageSignalSnapshot = {
  width: number | null;
  height: number | null;
  blurProxy: number | null;
  exposureMean: number | null;
  exposureStdDev: number | null;
};

const CARD_BRAND_KEYWORDS = [
  "upper deck",
  "topps",
  "panini",
  "skybox",
  "donruss",
  "prizm",
  "hoops",
  "fleer",
  "bowman",
  "score",
  "pokemon",
  "chrome",
  "optic",
];

const CARD_SUBSET_KEYWORDS = [
  "spx",
  "sp authentic",
  "die cut",
  "refractor",
  "holo",
  "silver",
  "finest",
  "stadium club",
  "rookie",
  "auto",
  "autograph",
  "jersey",
  "patch",
];

const REFERENCE_NOISE_TERMS = [
  "for sale",
  "sample",
  "buy now",
  "auction",
  "lot of",
  "price guide",
  "checklist",
  "for trade",
];

const PROFILE_NOISE_TERMS = [
  "wikipedia",
  "biography",
  "businessman",
  "stats",
  "facts",
  "height",
  "age",
  "nascar",
];

const PROFILE_DOMAINS = [
  "wikipedia.org",
  "britannica.com",
  "biography.com",
  "basketball-reference.com",
];

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
    private readonly catalogIndexService: CatalogIndexService,
    private readonly titleNormalizationService: TitleNormalizationService,
  ) {}

  async createScan(params: {
    userId: string;
    frontFile?: UploadedFile;
    backFile?: UploadedFile;
  }) {
    const frontFile = params.frontFile;
    const backFile = params.backFile;

    if (!frontFile || !frontFile.buffer) {
      throw new BadRequestException("Front image file is required.");
    }

    const [frontStoredImage, backStoredImage] = await Promise.all([
      this.storageService.uploadScanImage(
        frontFile.buffer,
        frontFile.originalname,
      ),
      backFile
        ? this.storageService.uploadScanImage(
            backFile.buffer,
            backFile.originalname,
          )
        : Promise.resolve(null),
    ]);

    const scanJob = await this.prisma.scanJob.create({
      data: {
        userId: params.userId,
        status: "QUEUED",
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

  async getScan(scanId: number, userId: string) {
    const scanJob = await this.prisma.scanJob.findFirst({
      where: { id: scanId, userId },
      include: {
        candidates: {
          orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!scanJob) {
      throw new NotFoundException("Scan not found.");
    }

    const enrichedCandidates = await Promise.all(
      scanJob.candidates.map(async (candidate) => {
        const sourceHints = this.normalizeSourceHints(candidate.sourceHints);
        const enrichedSourceHints =
          await this.enrichSourceHintsWithPreviewImages(
            scanId,
            candidate.id,
            sourceHints,
          );
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
    userId: string,
    side: "front" | "back",
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const scanJob = await this.prisma.scanJob.findFirst({
      where: { id: scanId, userId },
      select: {
        originalImageKey: true,
        thumbnailImageKey: true,
        backOriginalImageKey: true,
        backThumbnailImageKey: true,
      },
    });

    if (!scanJob) {
      throw new NotFoundException("Scan not found.");
    }

    const key =
      side === "front"
        ? (scanJob.thumbnailImageKey ?? scanJob.originalImageKey)
        : (scanJob.backThumbnailImageKey ?? scanJob.backOriginalImageKey);

    if (!key) {
      throw new NotFoundException(`${side} image not found for this scan.`);
    }

    return this.storageService.readImage(key);
  }

  async getCandidatePreviewImage(
    scanId: number,
    candidateId: number,
    userId: string,
    hintUrl: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (!hintUrl.trim()) {
      throw new BadRequestException("hintUrl is required.");
    }

    const candidate = await this.prisma.scanCandidate.findFirst({
      where: {
        id: candidateId,
        scanJobId: scanId,
        scanJob: {
          is: {
            userId,
          },
        },
      },
      select: {
        sourceHints: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException("Scan candidate not found.");
    }

    const hint = this.normalizeSourceHints(candidate.sourceHints).find(
      (item) => item.url === hintUrl,
    );
    if (!hint) {
      throw new NotFoundException("Source hint not found for candidate.");
    }

    const image = await this.linkPreviewService.getTrustedPreviewImage(
      hint.url,
    );
    if (!image) {
      throw new NotFoundException(
        "Trusted preview image not available for this source hint.",
      );
    }

    return image;
  }

  async confirmScan(scanId: number, userId: string, dto: ConfirmScanDto) {
    const scanJob = await this.prisma.scanJob.findFirst({
      where: { id: scanId, userId },
      include: { candidates: true },
    });

    if (!scanJob) {
      throw new NotFoundException("Scan not found.");
    }

    if (!scanJob.candidates.length) {
      throw new BadRequestException("No scan candidates available to confirm.");
    }

    const sortedCandidates = [...scanJob.candidates].sort(
      (a, b) => b.score - a.score,
    );
    const selectedCandidate = dto.candidateId
      ? scanJob.candidates.find((candidate) => candidate.id === dto.candidateId)
      : sortedCandidates[0];

    if (!selectedCandidate) {
      throw new BadRequestException("Selected candidate was not found.");
    }

    const merged = {
      name: dto.draft?.name ?? selectedCandidate.name,
      set:
        dto.draft?.set ??
        selectedCandidate.legacySetText ??
        selectedCandidate.set,
      setName:
        dto.draft?.setName ??
        selectedCandidate.setName ??
        selectedCandidate.set,
      brand: dto.draft?.brand ?? selectedCandidate.brand ?? null,
      year: dto.draft?.year ?? selectedCandidate.year,
      yearManufactured: dto.draft?.year ?? selectedCandidate.year,
      player: dto.draft?.player ?? selectedCandidate.player,
      variant: dto.draft?.variant ?? selectedCandidate.variant,
      sport: dto.draft?.sport ?? selectedCandidate.sport,
      season: dto.draft?.season ?? selectedCandidate.season ?? null,
      cardNumber: dto.draft?.cardNumber ?? selectedCandidate.cardNumber ?? null,
      category: dto.draft?.category ?? null,
      subcategory: dto.draft?.subcategory ?? null,
      hasAutographVariant: dto.draft?.hasAutographVariant ?? false,
      isVintage: dto.draft?.isVintage ?? false,
    };

    if (!merged.name) {
      throw new BadRequestException(
        "Card name is required when confirming a scan.",
      );
    }

    const { cardDefinition } =
      await this.catalogIndexService.upsertCatalogNodes(merged);

    if (dto.enrichment) {
      const currentMetadata =
        cardDefinition.metadata &&
        typeof cardDefinition.metadata === "object" &&
        !Array.isArray(cardDefinition.metadata)
          ? cardDefinition.metadata
          : {};

      await this.prisma.cardDefinition.update({
        where: { id: cardDefinition.id },
        data: {
          metadata: {
            ...currentMetadata,
            enrichment: {
              ...(dto.enrichment as unknown as Prisma.JsonObject),
              acceptedAt: new Date().toISOString(),
              scanId,
              candidateId: selectedCandidate.id,
            },
          },
        },
      });
    }

    const scanDiagnostics = this.parseScanJobDiagnostics(scanJob.diagnostics);
    const structuredHintCounts =
      scanDiagnostics?.ocr.structuredHintCounts ?? {
        years: 0,
        seasons: 0,
        cardNumbers: 0,
        brands: 0,
        subsets: 0,
      };
    const confidence = computePersistedConfidence({
      score: selectedCandidate.score,
      validationScore: selectedCandidate.validationScore,
      overallQuality: scanDiagnostics?.quality.overall ?? 1,
      frontTextLength: scanDiagnostics?.ocr.frontTextLength ?? 0,
      backTextLength: scanDiagnostics?.ocr.backTextLength ?? 0,
      structuredHintCounts,
    });

    await this.prisma.scanCandidate.updateMany({
      where: { scanJobId: scanId },
      data: { chosen: false },
    });

    await this.prisma.scanCandidate.update({
      where: { id: selectedCandidate.id },
      data: { chosen: true },
    });

    const keepScanImage = dto.keepScanImage !== false;
    const frontImageUrl = keepScanImage
      ? (scanJob.thumbnailImageKey ?? scanJob.originalImageKey)
      : null;
    const frontOriginalImageKey = keepScanImage
      ? scanJob.originalImageKey
      : null;
    const frontThumbnailImageKey = keepScanImage
      ? scanJob.thumbnailImageKey
      : null;
    const backImageKey = keepScanImage
      ? (scanJob.backThumbnailImageKey ?? null)
      : null;

    const record =
      (dto.collectionStatus ?? CollectionStatus.OWNED) ===
      CollectionStatus.WANTED
        ? await this.prisma.userWishlist.upsert({
            where: {
              userId_cardDefinitionId: {
                userId,
                cardDefinitionId: cardDefinition.id,
              },
            },
            update: {
              imageUrl: frontImageUrl,
              originalImageKey: frontOriginalImageKey,
              thumbnailImageKey: frontThumbnailImageKey,
              frontImageKey: frontImageUrl,
              backImageKey,
              notes: dto.draft?.notes ?? undefined,
              priority: dto.draft?.priority ?? undefined,
              confidence,
              scanJobId: scanJob.id,
            },
            create: {
              userId,
              cardDefinitionId: cardDefinition.id,
              imageUrl: frontImageUrl,
              originalImageKey: frontOriginalImageKey,
              thumbnailImageKey: frontThumbnailImageKey,
              frontImageKey: frontImageUrl,
              backImageKey,
              notes: dto.draft?.notes ?? null,
              priority: dto.draft?.priority ?? null,
              confidence,
              scanJobId: scanJob.id,
            },
          })
        : await this.prisma.userCard.create({
            data: {
              userId,
              cardDefinitionId: cardDefinition.id,
              imageUrl: frontImageUrl,
              originalImageKey: frontOriginalImageKey,
              thumbnailImageKey: frontThumbnailImageKey,
              frontImageKey: frontImageUrl,
              backImageKey,
              condition: dto.draft?.condition ?? null,
              isAutographed: dto.draft?.isAutographed ?? false,
              autographFormat: dto.draft?.autographFormat ?? null,
              isForTrade: dto.draft?.isForTrade ?? false,
              isForSale: dto.draft?.isForSale ?? false,
              askingPriceCents: dto.draft?.askingPriceCents ?? null,
              notes: dto.draft?.notes ?? null,
              gradeEstimate: dto.draft?.gradeEstimate ?? null,
              confidence,
              scanJobId: scanJob.id,
            },
          });

    if (dto.promoteToCanonical && keepScanImage && scanJob.thumbnailImageKey) {
      await this.prisma.cardDefinition.update({
        where: { id: cardDefinition.id },
        data: {
          canonicalImageUrl: null,
          canonicalOriginalImageKey: scanJob.originalImageKey,
          canonicalThumbnailImageKey: scanJob.thumbnailImageKey,
          canonicalSourceUserId: userId,
          canonicalSelectedAt: new Date(),
          canonicalSelectedByUserId: userId,
        },
      });
    }

    await this.prisma.scanJob.update({
      where: { id: scanJob.id },
      data: { status: "CONFIRMED" },
    });

    return { id: record.id };
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
      data: { status: "PROCESSING" },
    });

    const startedAt = Date.now();
    const timingsMs: ScanJobDiagnostics["timingsMs"] = {
      ocr: 0,
      lookup: 0,
      rank: 0,
      total: 0,
    };
    const lookupProvidersUsed = this.lookupService.getActiveProviders();
    let failedStage: string | null = null;
    let ocrResult: Awaited<ReturnType<OcrService["extractText"]>> | null = null;
    let lookup: {
      corpus: string;
      hints: SourceHint[];
    } = {
      corpus: "",
      hints: [],
    };
    let frontQuality = this.buildEmptyImageQuality();
    let backQuality = input.backBuffer ? this.buildEmptyImageQuality() : null;
    let candidates: RankedCandidate[] = [];

    try {
      failedStage = "ocr";
      const ocrStartedAt = Date.now();
      ocrResult = await this.ocrService.extractText({
        frontBuffer: input.frontBuffer,
        frontFilename: input.frontFilename,
        backBuffer: input.backBuffer,
        backFilename: input.backFilename,
      });
      timingsMs.ocr = Date.now() - ocrStartedAt;

      failedStage = "quality";
      const structuredHintCounts = toStructuredHintCounts(ocrResult.hints);
      const effectiveFrontTextLength = ocrResult.usedFallback
        ? 0
        : ocrResult.frontText.length;
      const effectiveBackTextLength = ocrResult.usedFallback
        ? 0
        : ocrResult.backText.length;
      const effectiveStructuredHintCount = ocrResult.usedFallback
        ? 0
        : totalStructuredHintCount(structuredHintCounts);

      [frontQuality, backQuality] = await Promise.all([
        this.assessImageQuality(
          input.frontBuffer,
          effectiveFrontTextLength,
          effectiveStructuredHintCount,
        ),
        input.backBuffer
          ? this.assessImageQuality(
              input.backBuffer,
              effectiveBackTextLength,
              effectiveStructuredHintCount,
            )
          : Promise.resolve(null),
      ]);

      failedStage = "lookup";
      const lookupStartedAt = Date.now();
      lookup = await this.lookupService.lookup({
        frontBuffer: input.frontBuffer,
        backBuffer: input.backBuffer,
        ocrText: ocrResult.text,
        hints: ocrResult.hints,
      });
      timingsMs.lookup = Date.now() - lookupStartedAt;

      failedStage = "rank";
      const rankStartedAt = Date.now();
      const references = await this.loadCandidateReferences();
      candidates = this.rankCandidates(
        {
          text: ocrResult.text,
          backText: ocrResult.backText,
          hints: ocrResult.hints,
          lookup,
        },
        references,
      ).slice(0, 8);
      timingsMs.rank = Date.now() - rankStartedAt;
      timingsMs.total = Date.now() - startedAt;

      const diagnostics = this.buildScanJobDiagnostics({
        frontQuality,
        backQuality,
        ocrResult,
        lookup,
        lookupProvidersUsed,
        timingsMs,
        failedStage: null,
      });

      failedStage = "persist";
      await this.prisma.$transaction([
        this.prisma.scanCandidate.deleteMany({ where: { scanJobId: scanId } }),
        ...candidates.map((candidate) =>
          this.prisma.scanCandidate.create({
            data: {
              scanJobId: scanId,
              name: candidate.name,
              set: candidate.set,
              setName: candidate.setName,
              legacySetText: candidate.legacySetText,
              brand: candidate.brand,
              year: candidate.year,
              season: candidate.season,
              cardNumber: candidate.cardNumber,
              player: candidate.player,
              variant: candidate.variant,
              sport: candidate.sport,
              score: candidate.score,
              validationScore: candidate.validationScore,
              sourceHints: candidate.sourceHints as unknown as Prisma.JsonArray,
              diagnostics:
                candidate.diagnostics as unknown as Prisma.InputJsonValue,
            },
          }),
        ),
        this.prisma.scanJob.update({
          where: { id: scanId },
          data: {
            status: "NEEDS_REVIEW",
            ocrText: ocrResult.text,
            diagnostics: diagnostics as unknown as Prisma.InputJsonValue,
            error: null,
          },
        }),
      ]);
    } catch (error) {
      timingsMs.total = Date.now() - startedAt;
      this.logger.error(
        `Failed processing scan ${scanId}: ${(error as Error).message}`,
      );
      const diagnostics = this.buildScanJobDiagnostics({
        frontQuality,
        backQuality,
        ocrResult,
        lookup,
        lookupProvidersUsed,
        timingsMs,
        failedStage,
      });
      await this.prisma.scanJob.update({
        where: { id: scanId },
        data: {
          status: "FAILED",
          diagnostics: diagnostics as unknown as Prisma.InputJsonValue,
          error: (error as Error).message,
        },
      });
    }
  }

  private async loadCandidateReferences(): Promise<CandidateReference[]> {
    const existingDefinitions = await this.prisma.cardDefinition.findMany({
      include: {
        cardSet: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 1200,
    });

    const catalogDerived: CandidateReference[] = existingDefinitions.map(
      (definition) => {
        const number = this.extractReferenceNumber({
          name: definition.name,
          set: definition.cardSet?.setName ?? definition.legacySetText,
          setName: definition.cardSet?.setName ?? null,
          legacySetText: definition.legacySetText ?? null,
          cardNumber: definition.cardNumber ?? null,
          variant: definition.variant,
          metadata: null,
        });

        return {
          name: definition.name,
          set: definition.cardSet?.setName ?? definition.legacySetText,
          setName: definition.cardSet?.setName ?? null,
          legacySetText: definition.legacySetText,
          brand: definition.cardSet?.brand ?? null,
          year: definition.cardSet?.yearManufactured ?? null,
          season: definition.cardSet?.season ?? null,
          cardNumber: definition.cardNumber ?? number,
          player: definition.player,
          variant: definition.variant,
          sport: definition.cardSet?.sport ?? null,
          source: "catalog_card",
          metadata: {
            fromDefinitionId: definition.id,
            number,
          },
        };
      },
    );

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
    const backText = ocr.backText || "";
    const ocrTokens = tokenize(ocrText);
    const lookupHints = ocr.lookup.hints.filter((hint) =>
      this.isLookupHintCardLike(hint),
    );
    const lookupCorpus = normalizeText(
      lookupHints.map((hint) => hint.title).join(" "),
    );
    const lockedPlayer = this.detectLockedPlayer(
      `${ocrText} ${backText} ${lookupCorpus}`,
      references,
    );
    const lookupDerivedReferences = this.buildLookupDerivedReferences(
      lookupHints,
      lockedPlayer,
    );
    const allReferences = this.filterReferencesForRanking(
      this.dedupeReferencesByKey([...references, ...lookupDerivedReferences]),
    );

    if (!allReferences.length) {
      const fallbackValidation = this.validationService.validateCandidate(
        {
          name: ocrText || "Unknown Card",
        },
        ocrText,
      );

      return [
        {
          name: ocrText || "Unknown Card",
          set: null,
          setName: null,
          legacySetText: null,
          brand: null,
          year: null,
          season: null,
          cardNumber: null,
          player: null,
          variant: null,
          sport: null,
          source: "ocr_fallback",
          metadata: null,
          score: 0.15,
          validationScore: fallbackValidation.validationScore,
          sourceHints: fallbackValidation.sourceHints,
          diagnostics: {
            reference: {
              source: "ocr_fallback",
              fromDefinitionId: null,
            },
            ranking: {
              coverage: 0,
              overlap: 0,
              fuzzy: 0,
              yearBonus: 0,
              playerBonus: 0,
              playerLockBonus: 0,
              setBonus: 0,
              numberBonus: 0,
              lookupBonus: 0,
              finalScore: 0.15,
            },
            validation: {
              validationScore: fallbackValidation.validationScore,
              hintCount: fallbackValidation.sourceHints.length,
            },
          },
        },
      ];
    }

    const ranked = allReferences
      .map((reference) => {
        const searchable = [
          reference.year,
          reference.season,
          reference.brand,
          reference.setName,
          reference.legacySetText,
          reference.player,
          reference.name,
          reference.set,
          reference.cardNumber ? `#${reference.cardNumber}` : null,
          reference.variant,
          reference.sport,
        ]
          .filter(Boolean)
          .join(" ");

        const normalizedSearchable = normalizeText(searchable);
        const overlap = overlapScore(ocrTokens, tokenize(searchable));
        const coverage = tokenCoverageScore(ocrText, searchable);
        const fuzzy = levenshteinSimilarity(
          normalizeText(ocrText).slice(0, 220),
          normalizedSearchable,
        );

        const yearBonus = this.computeYearBonus(
          reference.year,
          ocr.hints.years,
          ocrText,
        );
        const structuredReference = this.countReferenceSignals(reference) >= 2;
        const playerBonus = structuredReference
          ? this.computePlayerBonus(reference.player, ocrText, backText)
          : 0;
        const playerLockBonus = structuredReference
          ? this.computePlayerLockBonus(reference.player, lockedPlayer)
          : 0;
        const setBonus = this.computeSetBonus(reference, ocrText, backText, [
          ...ocr.hints.brands,
          ...ocr.hints.subsets,
        ]);
        const numberBonus = this.computeNumberBonus(
          reference,
          ocr.hints.cardNumbers,
        );
        const lookupBonus =
          structuredReference && lookupHints.length > 0
            ? this.computeLookupBonus(searchable, lookupCorpus)
            : 0;

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

        const validation = this.validationService.validateCandidate(
          reference,
          ocrText,
        );
        const matchedLookupHints = this.selectLookupHintsForCandidate(
          searchable,
          lookupHints,
        );
        const fromDefinitionId =
          reference.metadata &&
          typeof reference.metadata === "object" &&
          !Array.isArray(reference.metadata) &&
          "fromDefinitionId" in reference.metadata &&
          typeof reference.metadata.fromDefinitionId === "string"
            ? reference.metadata.fromDefinitionId
            : null;

        return {
          ...reference,
          score,
          validationScore: validation.validationScore,
          sourceHints: [...validation.sourceHints, ...matchedLookupHints],
          diagnostics: {
            reference: {
              source: reference.source,
              fromDefinitionId,
            },
            ranking: {
              coverage: Number(coverage.toFixed(3)),
              overlap: Number(overlap.toFixed(3)),
              fuzzy: Number(fuzzy.toFixed(3)),
              yearBonus,
              playerBonus,
              playerLockBonus,
              setBonus,
              numberBonus,
              lookupBonus,
              finalScore: score,
            },
            validation: {
              validationScore: validation.validationScore,
              hintCount:
                validation.sourceHints.length + matchedLookupHints.length,
            },
          },
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

  private buildEmptyImageQuality() {
    return computeImageQualityFromSignals({
      width: null,
      height: null,
      blurProxy: null,
      exposureMean: null,
      exposureStdDev: null,
      ocrTextLength: 0,
      structuredHintCount: 0,
    });
  }

  private async assessImageQuality(
    buffer: Buffer,
    ocrTextLength: number,
    structuredHintCount: number,
  ) {
    const signals = await this.extractImageSignals(buffer);
    return computeImageQualityFromSignals({
      ...signals,
      ocrTextLength,
      structuredHintCount,
    });
  }

  private async extractImageSignals(
    buffer: Buffer,
  ): Promise<ImageSignalSnapshot> {
    const rotated = sharp(buffer).rotate();
    const [metadata, stats, raw] = await Promise.all([
      rotated.metadata(),
      rotated.clone().greyscale().stats(),
      rotated
        .clone()
        .resize({
          width: 256,
          height: 256,
          fit: "inside",
          withoutEnlargement: true,
        })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ]);
    const channel = stats.channels[0];

    return {
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      blurProxy: this.computeBlurProxy(
        raw.data,
        raw.info.width,
        raw.info.height,
      ),
      exposureMean:
        typeof channel?.mean === "number" ? channel.mean : null,
      exposureStdDev:
        typeof channel?.stdev === "number" ? channel.stdev : null,
    };
  }

  private computeBlurProxy(data: Buffer, width: number, height: number) {
    if (width < 2 || height < 2) {
      return 0;
    }

    let totalDifference = 0;
    let sampleCount = 0;

    for (let y = 1; y < height; y += 1) {
      for (let x = 1; x < width; x += 1) {
        const index = y * width + x;
        totalDifference += Math.abs(data[index] - data[index - 1]);
        totalDifference += Math.abs(data[index] - data[index - width]);
        sampleCount += 2;
      }
    }

    if (!sampleCount) {
      return 0;
    }

    return Number((totalDifference / sampleCount).toFixed(3));
  }

  private buildScanJobDiagnostics(input: {
    frontQuality: ReturnType<ScanService["buildEmptyImageQuality"]>;
    backQuality: ReturnType<ScanService["buildEmptyImageQuality"]> | null;
    ocrResult: Awaited<ReturnType<OcrService["extractText"]>> | null;
    lookup: {
      corpus: string;
      hints: SourceHint[];
    };
    lookupProvidersUsed: string[];
    timingsMs: ScanJobDiagnostics["timingsMs"];
    failedStage: string | null;
  }): ScanJobDiagnostics {
    const structuredHintCounts = input.ocrResult
      ? toStructuredHintCounts(input.ocrResult.hints)
      : {
          years: 0,
          seasons: 0,
          cardNumbers: 0,
          brands: 0,
          subsets: 0,
        };
    const overallQuality = computeOverallQuality(
      input.frontQuality,
      input.backQuality,
    );

    return {
      quality: {
        front: input.frontQuality,
        back: input.backQuality,
        overall: overallQuality,
        reasons: Array.from(
          new Set([
            ...input.frontQuality.reasons,
            ...(input.backQuality?.reasons ?? []),
          ]),
        ),
        checks: {
          hasBackImage: Boolean(input.backQuality),
          totalOcrTextLength:
            (input.ocrResult?.frontText.length ?? 0) +
            (input.ocrResult?.backText.length ?? 0),
          structuredHintCounts,
        },
      },
      ocr: {
        frontTextLength: input.ocrResult?.frontText.length ?? 0,
        backTextLength: input.ocrResult?.backText.length ?? 0,
        structuredHintCounts,
        provider: input.ocrResult?.provider ?? this.ocrService.getProviderName(),
        usedFallback: input.ocrResult?.usedFallback ?? false,
      },
      lookup: {
        providersUsed: input.lookupProvidersUsed,
        hintCount: input.lookup.hints.length,
      },
      timingsMs: input.timingsMs,
      failedStage: input.failedStage,
    };
  }

  private parseScanJobDiagnostics(
    value: Prisma.JsonValue | null | undefined,
  ): ScanJobDiagnostics | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as unknown as ScanJobDiagnostics;
  }

  private computeYearBonus(
    referenceYear: number | null,
    hintYears: number[],
    ocrText: string,
  ): number {
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

  private computePlayerBonus(
    player: string | null,
    ocrText: string,
    backText: string,
  ): number {
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
      return 0.16;
    }

    const fullTokens = new Set(tokenize(ocrText));
    const allInFull = playerTokens.every((token) => fullTokens.has(token));
    if (allInFull) {
      return 0.08;
    }

    return 0;
  }

  private computePlayerLockBonus(
    player: string | null,
    lockedPlayer: string | null,
  ): number {
    if (!lockedPlayer) {
      return 0;
    }

    const normalizedPlayer = normalizeText(player);
    if (!normalizedPlayer) {
      return -0.3;
    }

    if (normalizedPlayer === lockedPlayer) {
      return 0.12;
    }

    return -0.18;
  }

  private computeSetBonus(
    reference: Pick<
      CandidateReference,
      "set" | "setName" | "legacySetText" | "brand" | "source"
    >,
    ocrText: string,
    backText: string,
    setHints: string[],
  ): number {
    const setNormalized = normalizeText(
      [
        reference.brand,
        reference.setName,
        reference.legacySetText,
        reference.set,
      ]
        .filter(Boolean)
        .join(" "),
    );
    const sourceNormalized = normalizeText(reference.source);
    const full = normalizeText(ocrText);
    const back = normalizeText(backText);

    let bonus = 0;
    if (setNormalized && back.includes(setNormalized)) {
      bonus += 0.1;
    } else if (setNormalized && full.includes(setNormalized)) {
      bonus += 0.05;
    }

    if (
      setHints.some(
        (hint) =>
          setNormalized.includes(hint) || sourceNormalized.includes(hint),
      )
    ) {
      bonus += 0.06;
    }

    return Number(Math.min(0.16, bonus).toFixed(3));
  }

  private computeNumberBonus(
    reference: CandidateReference,
    cardNumbers: string[],
  ): number {
    if (!cardNumbers.length) {
      return 0;
    }

    const referenceNumber =
      normalizeText(reference.cardNumber) ||
      this.extractReferenceNumber(reference);
    if (!referenceNumber) {
      return 0;
    }

    return cardNumbers.includes(referenceNumber) ? 0.3 : 0;
  }

  private computeLookupBonus(searchable: string, lookupCorpus: string): number {
    if (!lookupCorpus) {
      return 0;
    }

    const coverage = tokenCoverageScore(lookupCorpus, searchable);
    return Number((coverage * 0.12).toFixed(3));
  }

  private selectLookupHintsForCandidate(
    searchable: string,
    hints: SourceHint[],
  ): SourceHint[] {
    if (!hints.length) {
      return [];
    }

    return hints
      .filter((hint) => this.isLookupHintCardLike(hint))
      .filter(
        (hint) =>
          tokenCoverageScore(`${hint.title} ${hint.url}`, searchable) >= 0.25,
      )
      .slice(0, 2);
  }

  private normalizeSourceHints(
    value: Prisma.JsonValue | null | undefined,
  ): SourceHint[] {
    if (!value || !Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item) => typeof item === "object" && item !== null)
      .map((item) => item as unknown as SourceHint)
      .filter((hint) => Boolean(hint.url && hint.title));
  }

  private async enrichSourceHintsWithPreviewImages(
    scanId: number,
    candidateId: number,
    hints: SourceHint[],
  ): Promise<SourceHint[]> {
    if (!hints.length) {
      return [];
    }

    const uniqueUrls = Array.from(new Set(hints.map((hint) => hint.url))).slice(
      0,
      4,
    );
    const imageByUrl = new Map<string, string | null>();

    await Promise.all(
      uniqueUrls.map(async (url) => {
        const image = await this.linkPreviewService.getPreviewImage(url);
        imageByUrl.set(url, image);
      }),
    );

    return hints.map((hint) => ({
      ...hint,
      imageUrl: this.buildHintPreviewImageUrl(
        scanId,
        candidateId,
        hint,
        hint.imageUrl ?? imageByUrl.get(hint.url) ?? undefined,
      ),
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
      if (
        hint.source !== "web_lookup" ||
        !hint.title ||
        !this.isLookupHintCardLike(hint, lockedPlayer)
      ) {
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
        source: "lookup_hint",
        metadata: {
          lookupUrl: hint.url,
          lookupProvider: hint.provider ?? "web_lookup",
          lookupScore: hint.score,
          number:
            hint.title
              .match(/#\s*([a-z]?\d{1,4}[a-z]?)/i)?.[1]
              ?.toUpperCase() ?? null,
        },
      });
    }

    return candidates;
  }

  private parseLookupHintTitle(
    title: string,
    lockedPlayer: string | null,
  ): Omit<CandidateReference, "source" | "metadata"> | null {
    const segments = title
      .split(" - ")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (!segments.length) {
      return null;
    }

    const normalizedTitle = normalizeText(title);
    const yearMatch = normalizedTitle.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : null;
    const normalized = this.titleNormalizationService.parseDeterministic(
      title,
      {
        player: lockedPlayer ? this.titleCase(lockedPlayer) : null,
        yearManufactured: year,
      },
    );
    const setName =
      normalized.fields.setName ??
      this.extractLookupSet(segments, normalizedTitle);
    const brand = normalized.fields.brand ?? null;
    const season = normalized.fields.season ?? null;
    const cardNumber =
      normalized.fields.cardNumber ?? this.extractCardNumberFromText(title);
    const variant =
      normalized.fields.variant ?? this.extractLookupVariant(segments);
    const player =
      normalized.fields.player ??
      (lockedPlayer ? this.titleCase(lockedPlayer) : null);
    const name = this.extractLookupName(
      segments,
      lockedPlayer,
      title,
      normalized.fields.name ?? null,
    );

    if (!name) {
      return null;
    }

    return {
      name,
      set: setName,
      setName,
      legacySetText: setName,
      brand,
      year,
      season,
      cardNumber,
      player,
      variant,
      sport:
        normalized.fields.sport ?? this.extractLookupSport(normalizedTitle),
    };
  }

  private extractLookupSet(
    segments: string[],
    normalizedTitle: string,
  ): string | null {
    const setKeywords = [
      "upper deck",
      "topps",
      "panini",
      "skybox",
      "donruss",
      "prizm",
      "hoops",
      "fleer",
      "bowman",
      "score",
      "pokemon",
      "sp authentic",
      "chrome",
      "optic",
    ];

    for (const keyword of setKeywords) {
      if (!normalizedTitle.includes(keyword)) {
        continue;
      }

      const segment = segments.find((item) =>
        normalizeText(item).includes(keyword),
      );
      if (segment) {
        return segment.replace(/\[[^\]]+]/g, "").trim();
      }

      return this.titleCase(keyword);
    }

    return null;
  }

  private extractLookupVariant(segments: string[]): string | null {
    const segmentWithVariant = segments.find((segment) =>
      /\[[^\]]+]/.test(segment),
    );
    if (!segmentWithVariant) {
      return null;
    }

    const variant = segmentWithVariant.match(/\[([^\]]+)\]/)?.[1]?.trim();
    return variant || null;
  }

  private extractLookupName(
    segments: string[],
    lockedPlayer: string | null,
    rawTitle: string,
    normalizedName: string | null,
  ): string | null {
    if (normalizedName && !/^[a-z]?\d{2,8}[a-z]?$/i.test(normalizedName)) {
      return normalizedName;
    }

    if (lockedPlayer) {
      const playerIndex = segments.findIndex(
        (segment) => normalizeText(segment) === lockedPlayer,
      );
      if (playerIndex > 0) {
        const candidate = this.cleanLookupNameSegment(
          segments[playerIndex - 1],
        );
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
        /^[a-z]?\d{2,8}[a-z]?$/.test(normalized) ||
        /\b(19\d{2}|20\d{2})\b/.test(normalized) ||
        normalized.includes("comc") ||
        normalized.includes("ebay") ||
        normalized.includes("psa")
      ) {
        continue;
      }

      return cleaned;
    }

    if (lockedPlayer) {
      return this.titleCase(lockedPlayer);
    }

    const fallback = rawTitle
      .replace(/#\s*[a-z]?\d{1,6}[a-z]?/gi, " ")
      .replace(
        /\b(19\d{2}|20\d{2})(?:\s*[-/]\s*(?:\d{2}|19\d{2}|20\d{2}))?\b/gi,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();

    return fallback || null;
  }

  private cleanLookupNameSegment(value: string): string | null {
    const cleaned = value
      .replace(/\[[^\]]+]/g, " ")
      .replace(/#\s*[a-z]?\d{1,4}[a-z]?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned || null;
  }

  private extractLookupSport(normalizedTitle: string): string | null {
    if (normalizedTitle.includes("pokemon")) {
      return "pokemon";
    }
    if (
      normalizedTitle.includes("nba") ||
      normalizedTitle.includes("basketball") ||
      normalizedTitle.includes("bulls")
    ) {
      return "basketball";
    }

    return null;
  }

  private titleCase(value: string): string {
    return value
      .split(" ")
      .filter(Boolean)
      .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
      .join(" ");
  }

  private dedupeReferencesByKey(
    references: CandidateReference[],
  ): CandidateReference[] {
    const map = new Map<string, CandidateReference>();

    for (const reference of references) {
      const key = buildCardKey({
        name: reference.name,
        set: reference.setName ?? reference.legacySetText ?? reference.set,
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

      if (
        reference.source === "lookup_hint" &&
        existing.source !== "lookup_hint"
      ) {
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

  private filterReferencesForRanking(
    references: CandidateReference[],
  ): CandidateReference[] {
    return references.filter((reference) => this.isReferenceUsable(reference));
  }

  private isReferenceUsable(reference: CandidateReference): boolean {
    const combined = this.referenceText(reference);
    if (
      this.hasNoiseTerms(combined, [
        ...REFERENCE_NOISE_TERMS,
        ...PROFILE_NOISE_TERMS,
      ])
    ) {
      return false;
    }

    return this.countReferenceSignals(reference) >= 2;
  }

  private countReferenceSignals(reference: CandidateReference): number {
    const normalized = normalizeText(this.referenceText(reference));
    const setText = normalizeText(
      [
        reference.brand,
        reference.setName,
        reference.legacySetText,
        reference.set,
      ]
        .filter(Boolean)
        .join(" "),
    );
    const hasBrandSignal = CARD_BRAND_KEYWORDS.some((keyword) =>
      normalized.includes(keyword),
    );
    const hasSubsetSignal = CARD_SUBSET_KEYWORDS.some((keyword) =>
      normalized.includes(keyword),
    );
    const hasSetSignal =
      Boolean(setText) &&
      (hasBrandSignal ||
        tokenize(setText).length >= 2 ||
        Boolean(this.extractReferenceNumber(reference)));

    return [
      Boolean(reference.year),
      Boolean(this.extractReferenceNumber(reference)),
      hasSetSignal,
      hasSubsetSignal,
    ].filter(Boolean).length;
  }

  private isLookupHintCardLike(
    hint: SourceHint,
    lockedPlayer?: string | null,
  ): boolean {
    const normalizedTitle = normalizeText(hint.title);
    if (!normalizedTitle) {
      return false;
    }

    if (lockedPlayer && !normalizedTitle.includes(lockedPlayer)) {
      return false;
    }

    if (this.isKnownProfileDomain(hint.url)) {
      return false;
    }

    if (
      this.hasNoiseTerms(normalizedTitle, [
        ...REFERENCE_NOISE_TERMS,
        ...PROFILE_NOISE_TERMS,
      ])
    ) {
      return false;
    }

    return this.countTextSignals(hint.title) >= 2;
  }

  private countTextSignals(value: string): number {
    const normalized = normalizeText(value);
    return [
      /\b(19\d{2}|20\d{2})\b/.test(normalized),
      Boolean(this.extractCardNumberFromText(value)),
      CARD_BRAND_KEYWORDS.some((keyword) => normalized.includes(keyword)),
      CARD_SUBSET_KEYWORDS.some((keyword) => normalized.includes(keyword)),
    ].filter(Boolean).length;
  }

  private extractReferenceNumber(
    reference: Pick<
      CandidateReference,
      | "name"
      | "set"
      | "setName"
      | "legacySetText"
      | "cardNumber"
      | "variant"
      | "metadata"
    >,
  ): string | null {
    if (reference.cardNumber) {
      return reference.cardNumber.trim().toUpperCase();
    }

    if (
      reference.metadata &&
      typeof reference.metadata === "object" &&
      !Array.isArray(reference.metadata)
    ) {
      const metadataNumber = (reference.metadata as Record<string, unknown>)
        .number;
      if (typeof metadataNumber === "string" && metadataNumber.trim()) {
        return metadataNumber.trim().toUpperCase();
      }
    }

    return this.extractCardNumberFromText(
      [
        reference.name,
        reference.set,
        reference.setName,
        reference.legacySetText,
        reference.variant,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  private extractCardNumberFromText(
    value: string | null | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    const explicitMatch = value.match(
      /(?:card\s*(?:no|number)?\s*#?\s*|number\s*#?\s*|#\s*)([a-z]?\d{1,6}[a-z]?)/i,
    );

    if (explicitMatch?.[1]) {
      return explicitMatch[1].toUpperCase();
    }

    return null;
  }

  private referenceText(reference: CandidateReference): string {
    return [
      reference.name,
      reference.brand,
      reference.setName,
      reference.legacySetText,
      reference.set,
      reference.cardNumber ? `#${reference.cardNumber}` : null,
      reference.variant,
    ]
      .filter(Boolean)
      .join(" ");
  }

  private hasNoiseTerms(value: string, terms: string[]): boolean {
    const normalizedValue = normalizeText(value);
    return terms.some((term) => normalizedValue.includes(term));
  }

  private isKnownProfileDomain(value: string): boolean {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return PROFILE_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      return false;
    }
  }

  private buildHintPreviewImageUrl(
    scanId: number,
    candidateId: number,
    hint: SourceHint,
    resolvedImageUrl?: string | null,
  ): string | undefined {
    if (!resolvedImageUrl) {
      return undefined;
    }

    if (!this.linkPreviewService.shouldProxyPreviewImage(resolvedImageUrl)) {
      return resolvedImageUrl;
    }

    return `/api/v1/scans/${scanId}/candidates/${candidateId}/preview-image?hintUrl=${encodeURIComponent(
      hint.url,
    )}`;
  }
}
