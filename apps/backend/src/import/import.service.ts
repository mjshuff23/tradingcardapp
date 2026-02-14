import { BadRequestException, Injectable } from '@nestjs/common';
import { CollectionStatus } from '@prisma/client';
import { parseCsv } from '../common/csv.util';
import { PrismaService } from '../prisma/prisma.service';

type ImportError = {
  row: number;
  message: string;
};

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importCardsCsv(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('CSV file is required.');
    }

    const importJob = await this.prisma.importJob.create({
      data: {
        filename: file.originalname,
        status: 'PROCESSING',
      },
    });

    const rows = parseCsv(file.buffer.toString('utf8'));
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: ImportError[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2;
      const row = rows[i];

      const name = row.name || row.card || '';
      if (!name.trim()) {
        skippedCount += 1;
        errors.push({ row: rowNumber, message: 'Missing name/card column value.' });
        continue;
      }

      const set = row.set?.trim() || null;
      const player = row.player?.trim() || null;
      const variant = row.variant?.trim() || null;
      const sport = row.sport?.trim() || null;
      const year = row.year ? Number(row.year) || null : null;
      const collectionStatus =
        row.collectionStatus === 'WANTED' ? CollectionStatus.WANTED : CollectionStatus.OWNED;

      try {
        const existing = await this.prisma.card.findFirst({
          where: {
            name: name.trim(),
            set,
            year,
            player,
            variant,
            sport,
          },
        });

        if (existing) {
          await this.prisma.card.update({
            where: { id: existing.id },
            data: {
              collectionStatus,
              gradeEstimate: row.gradeEstimate || existing.gradeEstimate,
            },
          });
          updatedCount += 1;
        } else {
          await this.prisma.card.create({
            data: {
              name: name.trim(),
              set,
              year,
              player,
              variant,
              sport,
              collectionStatus,
              gradeEstimate: row.gradeEstimate || null,
            },
          });
          createdCount += 1;
        }
      } catch (error) {
        skippedCount += 1;
        errors.push({
          row: rowNumber,
          message: `Failed to import row: ${(error as Error).message}`,
        });
      }
    }

    const errorCount = errors.length;

    const finalizedJob = await this.prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: errorCount > 0 ? 'FAILED' : 'COMPLETED',
        totalRows: rows.length,
        createdCount,
        updatedCount,
        skippedCount,
        errorCount,
        errors,
      },
    });

    return {
      importJob: finalizedJob,
      summary: {
        totalRows: rows.length,
        createdCount,
        updatedCount,
        skippedCount,
        errorCount,
      },
    };
  }
}
