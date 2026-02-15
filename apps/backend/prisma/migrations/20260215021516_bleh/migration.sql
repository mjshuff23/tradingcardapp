-- DropIndex
DROP INDEX "Card_collectionStatus_idx";

-- DropIndex
DROP INDEX "Card_name_idx";

-- DropIndex
DROP INDEX "ScanCandidate_scanJobId_idx";

-- AlterTable
ALTER TABLE "Card" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CardReference" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ImportJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScanJob" ALTER COLUMN "updatedAt" DROP DEFAULT;
