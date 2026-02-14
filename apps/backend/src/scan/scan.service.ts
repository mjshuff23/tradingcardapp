import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { CollectionStatus, Prisma } from '@prisma/client';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../common/csv.util';
import { buildCardKey } from '../common/card-key.util';
import { overlapScore, tokenize } from '../common/normalize.util';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService } from '../ocr/ocr.service';
import { StorageService } from '../storage/storage.service';
import { ValidationService } from '../validation/validation.service';
import { ConfirmScanDto } from './dto/confirm-scan.dto';

@Injectable()
export class ScanService implements OnModuleInit {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocrService: OcrService,
    private readonly storageService: StorageService,
    private readonly validationService: ValidationService,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureCardReferenceSeed();
    } catch (error) {
      this.logger.warn('Card reference seed was not loaded at startup. It will retry on first scan.');
    }
  }

  async createScan(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Image file is required.');
    }

    const storedImage = await this.storageService.uploadScanImage(file.buffer, file.originalname);

    const scanJob = await this.prisma.scanJob.create({
      data: {
        status: 'QUEUED',
        sourceFilename: file.originalname,
        originalImageKey: storedImage.originalKey,
        thumbnailImageKey: storedImage.thumbnailKey,
      },
    });

    void this.processScan(scanJob.id, file.buffer, file.originalname);

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

    return scanJob;
  }

  async confirmScan(scanId: number, dto: ConfirmScanDto) {
    const scanJob = await this.prisma.scanJob.findUnique({
      where: { id: scanId },
      include: {
        candidates: true,
      },
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

  private async processScan(scanId: number, fileBuffer: Buffer, sourceFilename: string) {
    await this.prisma.scanJob.update({
      where: { id: scanId },
      data: { status: 'PROCESSING' },
    });

    try {
      await this.ensureCardReferenceSeed();

      const ocrText = await this.ocrService.extractText(fileBuffer, sourceFilename);
      const references = await this.prisma.cardReference.findMany({ take: 1000 });
      const candidates = this.rankCandidates(ocrText, references).slice(0, 8);

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
            ocrText,
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

  private rankCandidates(
    ocrText: string,
    references: Array<{
      name: string;
      set: string | null;
      year: number | null;
      player: string | null;
      variant: string | null;
      sport: string | null;
    }>,
  ) {
    const ocrTokens = tokenize(ocrText);

    if (!references.length) {
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

    const ranked = references
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

        const score = overlapScore(ocrTokens, tokenize(searchable));
        const validation = this.validationService.validateCandidate(reference, ocrText);

        return {
          ...reference,
          score: Number(score.toFixed(3)),
          validationScore: validation.validationScore,
          sourceHints: validation.sourceHints,
        };
      })
      .sort((a, b) => {
        if (b.score === a.score) {
          return (b.validationScore ?? 0) - (a.validationScore ?? 0);
        }

        return b.score - a.score;
      });

    if ((ranked[0]?.score ?? 0) === 0) {
      ranked[0].score = 0.2;
    }

    return ranked;
  }

  private async ensureCardReferenceSeed() {
    const existing = await this.prisma.cardReference.count();
    if (existing > 0) {
      return;
    }

    const csvPath = path.resolve(__dirname, '..', '..', 'data', 'card-references.csv');
    const file = await fs.readFile(csvPath, 'utf8');
    const rows = parseCsv(file);

    if (!rows.length) {
      this.logger.warn('Card reference CSV is empty.');
      return;
    }

    await this.prisma.cardReference.createMany({
      data: rows.map((row) => {
        const name = row.name || row.card || 'Unknown Card';
        const set = row.set || null;
        const year = row.year ? Number(row.year) || null : null;
        const player = row.player || null;
        const variant = row.variant || null;
        const sport = row.sport || null;
        const source = row.source || 'seed_csv';

        return {
          name,
          set,
          year,
          player,
          variant,
          sport,
          source,
          normalizedKey: buildCardKey({
            name,
            set,
            year,
            player,
            variant,
            sport,
          }),
          metadata: {
            league: row.league || null,
            team: row.team || null,
            number: row.number || null,
          },
        };
      }),
      skipDuplicates: true,
    });

    this.logger.log(`Seeded ${rows.length} card references.`);
  }
}
