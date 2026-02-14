-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('OWNED', 'WANTED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'PROCESSING', 'NEEDS_REVIEW', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Card"
  ALTER COLUMN "set" DROP NOT NULL,
  ALTER COLUMN "year" DROP NOT NULL,
  ALTER COLUMN "player" DROP NOT NULL,
  ADD COLUMN "variant" TEXT,
  ADD COLUMN "sport" TEXT,
  ADD COLUMN "originalImageKey" TEXT,
  ADD COLUMN "thumbnailImageKey" TEXT,
  ADD COLUMN "confidence" DOUBLE PRECISION,
  ADD COLUMN "collectionStatus" "CollectionStatus" NOT NULL DEFAULT 'OWNED',
  ADD COLUMN "scanJobId" INTEGER,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ScanJob" (
  "id" SERIAL NOT NULL,
  "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
  "sourceFilename" TEXT,
  "originalImageKey" TEXT,
  "thumbnailImageKey" TEXT,
  "ocrText" TEXT,
  "error" TEXT,
  "userId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanCandidate" (
  "id" SERIAL NOT NULL,
  "scanJobId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "set" TEXT,
  "year" INTEGER,
  "player" TEXT,
  "variant" TEXT,
  "sport" TEXT,
  "score" DOUBLE PRECISION NOT NULL,
  "validationScore" DOUBLE PRECISION,
  "sourceHints" JSONB,
  "chosen" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScanCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardReference" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "set" TEXT,
  "year" INTEGER,
  "player" TEXT,
  "variant" TEXT,
  "sport" TEXT,
  "source" TEXT NOT NULL,
  "normalizedKey" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CardReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
  "id" SERIAL NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
  "filename" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardReference_normalizedKey_key" ON "CardReference"("normalizedKey");

-- CreateIndex
CREATE INDEX "ScanCandidate_scanJobId_idx" ON "ScanCandidate"("scanJobId");

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Card_collectionStatus_idx" ON "Card"("collectionStatus");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanJob" ADD CONSTRAINT "ScanJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanCandidate" ADD CONSTRAINT "ScanCandidate_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "ScanJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
