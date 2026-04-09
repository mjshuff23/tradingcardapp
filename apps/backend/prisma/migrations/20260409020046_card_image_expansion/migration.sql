-- AlterTable
ALTER TABLE "CardDefinition" ADD COLUMN     "canonicalImageUrl" TEXT,
ADD COLUMN     "canonicalOriginalImageKey" TEXT,
ADD COLUMN     "canonicalSelectedAt" TIMESTAMP(3),
ADD COLUMN     "canonicalSelectedByUserId" TEXT,
ADD COLUMN     "canonicalSourceUserId" TEXT,
ADD COLUMN     "canonicalThumbnailImageKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pfpOriginalImageKey" TEXT,
ADD COLUMN     "pfpThumbnailImageKey" TEXT;

-- AlterTable
ALTER TABLE "UserWishlist" ADD COLUMN     "backImageKey" TEXT,
ADD COLUMN     "frontImageKey" TEXT;
