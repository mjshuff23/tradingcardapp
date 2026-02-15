-- AlterTable
ALTER TABLE "ScanJob"
  ADD COLUMN "backSourceFilename" TEXT,
  ADD COLUMN "backOriginalImageKey" TEXT,
  ADD COLUMN "backThumbnailImageKey" TEXT;
