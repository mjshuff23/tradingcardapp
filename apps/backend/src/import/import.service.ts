import { BadRequestException, Injectable } from "@nestjs/common";
import { CollectionStatus } from "../prisma/client";
import { parseCsv } from "../common/csv.util";
import { UploadedFile } from "../common/uploaded-file.type";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { CatalogIndexService } from "../catalog/catalog-index.service";

type ImportError = {
  row: number;
  message: string;
};

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly catalogIndexService: CatalogIndexService,
  ) {}

  async importCardsCsv(file: UploadedFile, userId: string) {
    if (!file || !file.buffer) {
      throw new BadRequestException("CSV file is required.");
    }

    const importJob = await this.prisma.importJob.create({
      data: {
        filename: file.originalname,
        status: "PROCESSING",
      },
    });

    const rows = parseCsv(file.buffer.toString("utf8"));
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: ImportError[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2;
      const row = rows[i];

      const name = (row.name || row.card || "").trim();
      if (!name) {
        skippedCount += 1;
        errors.push({
          row: rowNumber,
          message: "Missing name/card column value.",
        });
        continue;
      }

      const set = row.set?.trim() || null;
      const player = row.player?.trim() || null;
      const variant = row.variant?.trim() || null;
      const sport = row.sport?.trim() || null;
      const year = row.year ? Number(row.year) || null : null;
      const importImageUrl =
        row.imageUrl?.trim() || row.image_url?.trim() || null;
      const gradeEstimate = row.gradeEstimate?.trim() || null;
      const collectionStatus =
        row.collectionStatus === "WANTED"
          ? CollectionStatus.WANTED
          : CollectionStatus.OWNED;

      try {
        const importedImage = importImageUrl
          ? await this.importImageFromUrl(importImageUrl)
          : null;

        const { cardDefinition } =
          await this.catalogIndexService.upsertCatalogNodes({
            name,
            set,
            year,
            player,
            variant,
            sport,
          });

        const summary =
          collectionStatus === CollectionStatus.WANTED
            ? await this.upsertWishlistRecord({
                userId,
                cardDefinitionId: cardDefinition.id,
                gradeEstimate,
                importedImage,
              })
            : await this.upsertOwnedRecord({
                userId,
                cardDefinitionId: cardDefinition.id,
                gradeEstimate,
                importedImage,
              });

        createdCount += summary.created ? 1 : 0;
        updatedCount += summary.created ? 0 : 1;
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
        status: errorCount > 0 ? "FAILED" : "COMPLETED",
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

  private async upsertOwnedRecord(input: {
    userId: string;
    cardDefinitionId: string;
    gradeEstimate: string | null;
    importedImage: { originalKey: string; thumbnailKey: string } | null;
  }) {
    const existingWishlist = await this.prisma.userWishlist.findUnique({
      where: {
        userId_cardDefinitionId: {
          userId: input.userId,
          cardDefinitionId: input.cardDefinitionId,
        },
      },
    });

    if (existingWishlist) {
      await this.prisma.$transaction([
        this.prisma.userCard.create({
          data: {
            id: existingWishlist.id,
            userId: existingWishlist.userId,
            cardDefinitionId: input.cardDefinitionId,
            imageUrl:
              input.importedImage?.thumbnailKey ?? existingWishlist.imageUrl,
            originalImageKey:
              input.importedImage?.originalKey ??
              existingWishlist.originalImageKey,
            thumbnailImageKey:
              input.importedImage?.thumbnailKey ??
              existingWishlist.thumbnailImageKey,
            gradeEstimate:
              input.gradeEstimate ?? existingWishlist.gradeEstimate,
            confidence: existingWishlist.confidence,
            scanJobId: existingWishlist.scanJobId,
            notes: existingWishlist.notes,
            createdAt: existingWishlist.createdAt,
            updatedAt: existingWishlist.updatedAt,
          },
        }),
        this.prisma.userWishlist.delete({ where: { id: existingWishlist.id } }),
      ]);

      return { created: false };
    }

    const existingOwned = await this.prisma.userCard.findFirst({
      where: {
        userId: input.userId,
        cardDefinitionId: input.cardDefinitionId,
      },
      orderBy: { id: "asc" },
    });

    if (existingOwned) {
      await this.prisma.userCard.update({
        where: { id: existingOwned.id },
        data: {
          imageUrl: input.importedImage?.thumbnailKey ?? existingOwned.imageUrl,
          originalImageKey:
            input.importedImage?.originalKey ?? existingOwned.originalImageKey,
          thumbnailImageKey:
            input.importedImage?.thumbnailKey ??
            existingOwned.thumbnailImageKey,
          gradeEstimate: input.gradeEstimate ?? existingOwned.gradeEstimate,
        },
      });

      return { created: false };
    }

    await this.prisma.userCard.create({
      data: {
        userId: input.userId,
        cardDefinitionId: input.cardDefinitionId,
        imageUrl: input.importedImage?.thumbnailKey ?? null,
        originalImageKey: input.importedImage?.originalKey ?? null,
        thumbnailImageKey: input.importedImage?.thumbnailKey ?? null,
        gradeEstimate: input.gradeEstimate,
      },
    });

    return { created: true };
  }

  private async upsertWishlistRecord(input: {
    userId: string;
    cardDefinitionId: string;
    gradeEstimate: string | null;
    importedImage: { originalKey: string; thumbnailKey: string } | null;
  }) {
    const existingOwned = await this.prisma.userCard.findFirst({
      where: {
        userId: input.userId,
        cardDefinitionId: input.cardDefinitionId,
      },
      orderBy: { id: "asc" },
    });

    if (existingOwned) {
      const duplicateWishlist = await this.prisma.userWishlist.findUnique({
        where: {
          userId_cardDefinitionId: {
            userId: input.userId,
            cardDefinitionId: input.cardDefinitionId,
          },
        },
      });

      await this.prisma.$transaction(async (tx) => {
        if (duplicateWishlist && duplicateWishlist.id !== existingOwned.id) {
          await tx.userWishlist.delete({ where: { id: duplicateWishlist.id } });
        }

        await tx.userWishlist.create({
          data: {
            id: existingOwned.id,
            userId: existingOwned.userId,
            cardDefinitionId: input.cardDefinitionId,
            imageUrl:
              input.importedImage?.thumbnailKey ?? existingOwned.imageUrl,
            originalImageKey:
              input.importedImage?.originalKey ??
              existingOwned.originalImageKey,
            thumbnailImageKey:
              input.importedImage?.thumbnailKey ??
              existingOwned.thumbnailImageKey,
            gradeEstimate: input.gradeEstimate ?? existingOwned.gradeEstimate,
            confidence: existingOwned.confidence,
            scanJobId: existingOwned.scanJobId,
            notes: existingOwned.notes,
            createdAt: existingOwned.createdAt,
            updatedAt: existingOwned.updatedAt,
          },
        });

        await tx.userCard.delete({ where: { id: existingOwned.id } });
      });

      return { created: false };
    }

    const existingWishlist = await this.prisma.userWishlist.findUnique({
      where: {
        userId_cardDefinitionId: {
          userId: input.userId,
          cardDefinitionId: input.cardDefinitionId,
        },
      },
    });

    if (existingWishlist) {
      await this.prisma.userWishlist.update({
        where: { id: existingWishlist.id },
        data: {
          imageUrl:
            input.importedImage?.thumbnailKey ?? existingWishlist.imageUrl,
          originalImageKey:
            input.importedImage?.originalKey ??
            existingWishlist.originalImageKey,
          thumbnailImageKey:
            input.importedImage?.thumbnailKey ??
            existingWishlist.thumbnailImageKey,
          gradeEstimate: input.gradeEstimate ?? existingWishlist.gradeEstimate,
        },
      });

      return { created: false };
    }

    await this.prisma.userWishlist.create({
      data: {
        userId: input.userId,
        cardDefinitionId: input.cardDefinitionId,
        imageUrl: input.importedImage?.thumbnailKey ?? null,
        originalImageKey: input.importedImage?.originalKey ?? null,
        thumbnailImageKey: input.importedImage?.thumbnailKey ?? null,
        gradeEstimate: input.gradeEstimate,
      },
    });

    return { created: true };
  }

  private async importImageFromUrl(imageUrl: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        },
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        return null;
      }

      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) {
        return null;
      }

      const derivedFilename = this.filenameFromUrl(imageUrl, contentType);
      return this.storageService.uploadScanImage(
        Buffer.from(bytes),
        derivedFilename,
      );
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private filenameFromUrl(imageUrl: string, contentType: string): string {
    try {
      const url = new URL(imageUrl);
      const pathname = url.pathname.split("/").filter(Boolean);
      const basename = pathname[pathname.length - 1] || "import-image";
      if (basename.includes(".")) {
        return basename;
      }
    } catch {
      // fall through
    }

    if (contentType.includes("png")) {
      return "import-image.png";
    }
    if (contentType.includes("webp")) {
      return "import-image.webp";
    }
    return "import-image.jpg";
  }
}
