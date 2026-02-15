import { BadRequestException, Injectable } from '@nestjs/common';
import { CollectionStatus } from '@prisma/client';
import { parseCsv } from '../common/csv.util';
import { UploadedFile } from '../common/uploaded-file.type';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

type ImportError = {
  row: number;
  message: string;
};

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async importCardsCsv(file: UploadedFile) {
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
      const importImageUrl = row.imageUrl?.trim() || row.image_url?.trim() || null;
      const collectionStatus =
        row.collectionStatus === 'WANTED' ? CollectionStatus.WANTED : CollectionStatus.OWNED;

      try {
        const importedImage = importImageUrl
          ? await this.importImageFromUrl(importImageUrl)
          : null;

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
              imageUrl: importedImage?.thumbnailKey ?? existing.imageUrl,
              originalImageKey: importedImage?.originalKey ?? existing.originalImageKey,
              thumbnailImageKey: importedImage?.thumbnailKey ?? existing.thumbnailImageKey,
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
              imageUrl: importedImage?.thumbnailKey ?? null,
              originalImageKey: importedImage?.originalKey ?? null,
              thumbnailImageKey: importedImage?.thumbnailKey ?? null,
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

  private async importImageFromUrl(imageUrl: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        },
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) {
        return null;
      }

      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) {
        return null;
      }

      const derivedFilename = this.filenameFromUrl(imageUrl, contentType);
      return this.storageService.uploadScanImage(Buffer.from(bytes), derivedFilename);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private filenameFromUrl(imageUrl: string, contentType: string): string {
    try {
      const url = new URL(imageUrl);
      const pathname = url.pathname.split('/').filter(Boolean);
      const basename = pathname[pathname.length - 1] || 'import-image';
      if (basename.includes('.')) {
        return basename;
      }
    } catch {
      // fall through
    }

    if (contentType.includes('png')) {
      return 'import-image.png';
    }
    if (contentType.includes('webp')) {
      return 'import-image.webp';
    }
    return 'import-image.jpg';
  }
}
