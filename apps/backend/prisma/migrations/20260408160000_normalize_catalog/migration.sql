-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT IF EXISTS "Card_userId_fkey";

-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT IF EXISTS "Card_scanJobId_fkey";

-- DropForeignKey
ALTER TABLE "ScanJob" DROP CONSTRAINT IF EXISTS "ScanJob_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Card";

-- DropTable
DROP TABLE IF EXISTS "User";

-- AlterTable
ALTER TABLE "ScanJob"
  ALTER COLUMN "userId" TYPE TEXT USING CASE
    WHEN "userId" IS NULL THEN NULL
    ELSE "userId"::text
  END;

-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS "CardRecordIdSeq";

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "pfpUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSet" (
  "id" TEXT NOT NULL,
  "normalizedSetKey" TEXT NOT NULL,
  "brand" TEXT,
  "setName" TEXT,
  "yearManufactured" SMALLINT,
  "sport" TEXT,
  "season" TEXT,
  "cardConditionScale" TEXT,
  "cardSize" TEXT,
  "cardThicknessPt" SMALLINT,
  "countryOfOrigin" TEXT,
  "language" TEXT,
  "material" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardDefinition" (
  "id" TEXT NOT NULL,
  "normalizedCardKey" TEXT NOT NULL,
  "cardSetId" TEXT,
  "cardNumber" TEXT,
  "name" TEXT NOT NULL,
  "player" TEXT,
  "variant" TEXT,
  "legacySetText" TEXT,
  "category" TEXT,
  "subcategory" TEXT,
  "hasAutographVariant" BOOLEAN NOT NULL DEFAULT false,
  "features" JSONB,
  "originalOrReprint" TEXT,
  "parallelOrVariety" TEXT,
  "setType" TEXT,
  "insertSetName" TEXT,
  "cardType" TEXT,
  "isVintage" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CardDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
  "id" INTEGER NOT NULL DEFAULT nextval('"CardRecordIdSeq"'::regclass),
  "userId" TEXT NOT NULL,
  "cardDefinitionId" TEXT NOT NULL,
  "condition" TEXT,
  "isAutographed" BOOLEAN NOT NULL DEFAULT false,
  "autographFormat" TEXT,
  "imageUrl" TEXT,
  "originalImageKey" TEXT,
  "thumbnailImageKey" TEXT,
  "frontImageKey" TEXT,
  "backImageKey" TEXT,
  "isForTrade" BOOLEAN NOT NULL DEFAULT false,
  "isForSale" BOOLEAN NOT NULL DEFAULT false,
  "askingPriceCents" INTEGER,
  "notes" TEXT,
  "gradeEstimate" TEXT,
  "confidence" DOUBLE PRECISION,
  "scanJobId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWishlist" (
  "id" INTEGER NOT NULL DEFAULT nextval('"CardRecordIdSeq"'::regclass),
  "userId" TEXT NOT NULL,
  "cardDefinitionId" TEXT NOT NULL,
  "priority" SMALLINT,
  "notes" TEXT,
  "imageUrl" TEXT,
  "originalImageKey" TEXT,
  "thumbnailImageKey" TEXT,
  "gradeEstimate" TEXT,
  "confidence" DOUBLE PRECISION,
  "scanJobId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserWishlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CardSet_normalizedSetKey_key" ON "CardSet"("normalizedSetKey");

-- CreateIndex
CREATE UNIQUE INDEX "CardDefinition_normalizedCardKey_key" ON "CardDefinition"("normalizedCardKey");

-- CreateIndex
CREATE INDEX "CardDefinition_cardSetId_idx" ON "CardDefinition"("cardSetId");

-- CreateIndex
CREATE INDEX "CardDefinition_name_idx" ON "CardDefinition"("name");

-- CreateIndex
CREATE INDEX "UserCard_userId_idx" ON "UserCard"("userId");

-- CreateIndex
CREATE INDEX "UserCard_cardDefinitionId_idx" ON "UserCard"("cardDefinitionId");

-- CreateIndex
CREATE INDEX "UserCard_scanJobId_idx" ON "UserCard"("scanJobId");

-- CreateIndex
CREATE INDEX "UserWishlist_userId_idx" ON "UserWishlist"("userId");

-- CreateIndex
CREATE INDEX "UserWishlist_cardDefinitionId_idx" ON "UserWishlist"("cardDefinitionId");

-- CreateIndex
CREATE INDEX "UserWishlist_scanJobId_idx" ON "UserWishlist"("scanJobId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWishlist_userId_cardDefinitionId_key" ON "UserWishlist"("userId", "cardDefinitionId");

-- AddForeignKey
ALTER TABLE "CardDefinition"
  ADD CONSTRAINT "CardDefinition_cardSetId_fkey"
  FOREIGN KEY ("cardSetId")
  REFERENCES "CardSet"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard"
  ADD CONSTRAINT "UserCard_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard"
  ADD CONSTRAINT "UserCard_cardDefinitionId_fkey"
  FOREIGN KEY ("cardDefinitionId")
  REFERENCES "CardDefinition"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard"
  ADD CONSTRAINT "UserCard_scanJobId_fkey"
  FOREIGN KEY ("scanJobId")
  REFERENCES "ScanJob"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWishlist"
  ADD CONSTRAINT "UserWishlist_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWishlist"
  ADD CONSTRAINT "UserWishlist_cardDefinitionId_fkey"
  FOREIGN KEY ("cardDefinitionId")
  REFERENCES "CardDefinition"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWishlist"
  ADD CONSTRAINT "UserWishlist_scanJobId_fkey"
  FOREIGN KEY ("scanJobId")
  REFERENCES "ScanJob"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanJob"
  ADD CONSTRAINT "ScanJob_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
