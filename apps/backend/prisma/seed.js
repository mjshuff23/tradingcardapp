const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();
const packageRoot = path.resolve(__dirname, '..');
const seedDataPath = path.join(__dirname, 'seed-data', 'catalog.json');
const seedAssetsRoot = path.join(__dirname, 'seed-assets');

async function main() {
  const raw = await fs.readFile(seedDataPath, 'utf8');
  const catalog = JSON.parse(raw);

  if (!catalog || typeof catalog !== 'object') {
    console.log('No catalog seed data found. Skipping.');
    return;
  }

  await seedUsers(catalog.users ?? []);
  await seedCardSets(catalog.cardSets ?? []);
  await seedCardDefinitions(catalog.cardDefinitions ?? []);
  await seedUserCards(catalog.userCards ?? []);
  await seedUserWishlists(catalog.userWishlists ?? []);
  await syncSharedCardIdSequence();

  console.log(
    `Seed complete. ${catalog.cardSets?.length ?? 0} sets, ${catalog.cardDefinitions?.length ?? 0} definitions, ${catalog.userCards?.length ?? 0} owned rows, ${catalog.userWishlists?.length ?? 0} wishlist rows.`,
  );
}

async function seedUsers(users) {
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        email: user.email,
        passwordHash: user.passwordHash,
        pfpUrl: normalizeNullable(user.pfpUrl),
      },
      create: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash: user.passwordHash,
        pfpUrl: normalizeNullable(user.pfpUrl),
        createdAt: toDate(user.createdAt),
        updatedAt: toDate(user.updatedAt),
      },
    });
  }
}

async function seedCardSets(cardSets) {
  for (const cardSet of cardSets) {
    await prisma.cardSet.upsert({
      where: { id: cardSet.id },
      update: {
        normalizedSetKey: cardSet.normalizedSetKey,
        brand: normalizeNullable(cardSet.brand),
        setName: normalizeNullable(cardSet.setName),
        yearManufactured: normalizeNullableNumber(cardSet.yearManufactured),
        sport: normalizeNullable(cardSet.sport),
        season: normalizeNullable(cardSet.season),
        cardConditionScale: normalizeNullable(cardSet.cardConditionScale),
        cardSize: normalizeNullable(cardSet.cardSize),
        cardThicknessPt: normalizeNullableNumber(cardSet.cardThicknessPt),
        countryOfOrigin: normalizeNullable(cardSet.countryOfOrigin),
        language: normalizeNullable(cardSet.language),
        material: normalizeNullable(cardSet.material),
        metadata: normalizeJson(cardSet.metadata),
      },
      create: {
        id: cardSet.id,
        normalizedSetKey: cardSet.normalizedSetKey,
        brand: normalizeNullable(cardSet.brand),
        setName: normalizeNullable(cardSet.setName),
        yearManufactured: normalizeNullableNumber(cardSet.yearManufactured),
        sport: normalizeNullable(cardSet.sport),
        season: normalizeNullable(cardSet.season),
        cardConditionScale: normalizeNullable(cardSet.cardConditionScale),
        cardSize: normalizeNullable(cardSet.cardSize),
        cardThicknessPt: normalizeNullableNumber(cardSet.cardThicknessPt),
        countryOfOrigin: normalizeNullable(cardSet.countryOfOrigin),
        language: normalizeNullable(cardSet.language),
        material: normalizeNullable(cardSet.material),
        metadata: normalizeJson(cardSet.metadata),
        createdAt: toDate(cardSet.createdAt),
        updatedAt: toDate(cardSet.updatedAt),
      },
    });
  }
}

async function seedCardDefinitions(cardDefinitions) {
  for (const definition of cardDefinitions) {
    await prisma.cardDefinition.upsert({
      where: { id: definition.id },
      update: {
        normalizedCardKey: definition.normalizedCardKey,
        cardSetId: normalizeNullable(definition.cardSetId),
        cardNumber: normalizeNullable(definition.cardNumber),
        name: definition.name,
        player: normalizeNullable(definition.player),
        variant: normalizeNullable(definition.variant),
        legacySetText: normalizeNullable(definition.legacySetText),
        category: normalizeNullable(definition.category),
        subcategory: normalizeNullable(definition.subcategory),
        hasAutographVariant: Boolean(definition.hasAutographVariant),
        features: normalizeJson(definition.features),
        originalOrReprint: normalizeNullable(definition.originalOrReprint),
        parallelOrVariety: normalizeNullable(definition.parallelOrVariety),
        setType: normalizeNullable(definition.setType),
        insertSetName: normalizeNullable(definition.insertSetName),
        cardType: normalizeNullable(definition.cardType),
        isVintage: Boolean(definition.isVintage),
        metadata: normalizeJson(definition.metadata),
      },
      create: {
        id: definition.id,
        normalizedCardKey: definition.normalizedCardKey,
        cardSetId: normalizeNullable(definition.cardSetId),
        cardNumber: normalizeNullable(definition.cardNumber),
        name: definition.name,
        player: normalizeNullable(definition.player),
        variant: normalizeNullable(definition.variant),
        legacySetText: normalizeNullable(definition.legacySetText),
        category: normalizeNullable(definition.category),
        subcategory: normalizeNullable(definition.subcategory),
        hasAutographVariant: Boolean(definition.hasAutographVariant),
        features: normalizeJson(definition.features),
        originalOrReprint: normalizeNullable(definition.originalOrReprint),
        parallelOrVariety: normalizeNullable(definition.parallelOrVariety),
        setType: normalizeNullable(definition.setType),
        insertSetName: normalizeNullable(definition.insertSetName),
        cardType: normalizeNullable(definition.cardType),
        isVintage: Boolean(definition.isVintage),
        metadata: normalizeJson(definition.metadata),
        createdAt: toDate(definition.createdAt),
        updatedAt: toDate(definition.updatedAt),
      },
    });
  }
}

async function seedUserCards(userCards) {
  for (const userCard of userCards) {
    const image = await maybeImportSeedImage(userCard);
    await prisma.userCard.upsert({
      where: { id: Number(userCard.id) },
      update: buildCardRecordData(userCard, image),
      create: {
        id: Number(userCard.id),
        ...buildCardRecordData(userCard, image),
        createdAt: toDate(userCard.createdAt),
        updatedAt: toDate(userCard.updatedAt),
      },
    });
  }
}

async function seedUserWishlists(userWishlists) {
  for (const wishlist of userWishlists) {
    const image = await maybeImportSeedImage(wishlist);
    await prisma.userWishlist.upsert({
      where: { id: Number(wishlist.id) },
      update: buildWishlistRecordData(wishlist, image),
      create: {
        id: Number(wishlist.id),
        ...buildWishlistRecordData(wishlist, image),
        createdAt: toDate(wishlist.createdAt),
        updatedAt: toDate(wishlist.updatedAt),
      },
    });
  }
}

function buildCardRecordData(record, image) {
  return {
    userId: record.userId,
    cardDefinitionId: record.cardDefinitionId,
    condition: normalizeNullable(record.condition),
    isAutographed: Boolean(record.isAutographed),
    autographFormat: normalizeNullable(record.autographFormat),
    imageUrl: image?.thumbnailKey ?? normalizeNullable(record.imageUrl),
    originalImageKey: image?.originalKey ?? normalizeNullable(record.originalImageKey),
    thumbnailImageKey: image?.thumbnailKey ?? normalizeNullable(record.thumbnailImageKey),
    frontImageKey: normalizeNullable(record.frontImageKey),
    backImageKey: normalizeNullable(record.backImageKey),
    isForTrade: Boolean(record.isForTrade),
    isForSale: Boolean(record.isForSale),
    askingPriceCents: normalizeNullableNumber(record.askingPriceCents),
    notes: normalizeNullable(record.notes),
    gradeEstimate: normalizeNullable(record.gradeEstimate),
    confidence: normalizeNullableNumber(record.confidence),
    scanJobId: normalizeNullableNumber(record.scanJobId),
  };
}

function buildWishlistRecordData(record, image) {
  return {
    userId: record.userId,
    cardDefinitionId: record.cardDefinitionId,
    priority: normalizeNullableNumber(record.priority),
    notes: normalizeNullable(record.notes),
    imageUrl: image?.thumbnailKey ?? normalizeNullable(record.imageUrl),
    originalImageKey: image?.originalKey ?? normalizeNullable(record.originalImageKey),
    thumbnailImageKey: image?.thumbnailKey ?? normalizeNullable(record.thumbnailImageKey),
    gradeEstimate: normalizeNullable(record.gradeEstimate),
    confidence: normalizeNullableNumber(record.confidence),
    scanJobId: normalizeNullableNumber(record.scanJobId),
  };
}

async function maybeImportSeedImage(record) {
  const relativeImagePath = normalizeNullable(record.seedImagePath ?? record.imagePath);
  if (!relativeImagePath) {
    return null;
  }

  return importSeedImage(relativeImagePath);
}

async function importSeedImage(relativeImagePath) {
  const sourcePath = path.join(seedAssetsRoot, relativeImagePath);
  const buffer = await fs.readFile(sourcePath);
  const extension = getExtension(sourcePath);
  const id = randomUUID();
  const originalKey = `seed/original/${id}.${extension}`;
  const thumbnailKey = `seed/thumb/${id}.jpg`;

  const thumbnailBuffer = await sharp(buffer)
    .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const storage = createStorageClient();
  if (storage) {
    try {
      await Promise.all([
        storage.client.send(
          new PutObjectCommand({
            Bucket: storage.bucket,
            Key: originalKey,
            Body: buffer,
            ContentType: detectMimeType(extension),
          }),
        ),
        storage.client.send(
          new PutObjectCommand({
            Bucket: storage.bucket,
            Key: thumbnailKey,
            Body: thumbnailBuffer,
            ContentType: 'image/jpeg',
          }),
        ),
      ]);

      return { originalKey, thumbnailKey };
    } catch (error) {
      console.warn(`S3 seed upload failed, falling back to local storage: ${error.message}`);
    }
  }

  return writeLocally(id, extension, buffer, thumbnailBuffer);
}

function createStorageClient() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || 'auto';

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    bucket,
    client: new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };
}

async function writeLocally(id, extension, originalBuffer, thumbnailBuffer) {
  const localRoot = path.join(packageRoot, '.local-storage');
  const originalDir = path.join(localRoot, 'seed', 'original');
  const thumbDir = path.join(localRoot, 'seed', 'thumb');

  await Promise.all([
    fs.mkdir(originalDir, { recursive: true }),
    fs.mkdir(thumbDir, { recursive: true }),
  ]);

  const originalFile = `${id}.${extension}`;
  const thumbFile = `${id}.jpg`;

  await Promise.all([
    fs.writeFile(path.join(originalDir, originalFile), originalBuffer),
    fs.writeFile(path.join(thumbDir, thumbFile), thumbnailBuffer),
  ]);

  return {
    originalKey: `local/seed/original/${originalFile}`,
    thumbnailKey: `local/seed/thumb/${thumbFile}`,
  };
}

function getExtension(filename) {
  const extension = path.extname(filename).replace('.', '').toLowerCase();
  if (['png', 'webp', 'jpeg', 'jpg'].includes(extension)) {
    return extension === 'jpeg' ? 'jpg' : extension;
  }
  return 'jpg';
}

function detectMimeType(extension) {
  if (extension === 'png') {
    return 'image/png';
  }
  if (extension === 'webp') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function normalizeNullable(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeJson(value) {
  if (value === undefined) {
    return null;
  }

  return value === null ? null : value;
}

function toDate(value) {
  if (!value) {
    return undefined;
  }

  return new Date(value);
}

async function syncSharedCardIdSequence() {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      '"CardRecordIdSeq"',
      GREATEST(
        COALESCE((SELECT MAX(id) FROM "UserCard"), 0),
        COALESCE((SELECT MAX(id) FROM "UserWishlist"), 0),
        1
      ),
      true
    )
  `);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
