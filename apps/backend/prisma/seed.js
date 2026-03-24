const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const prisma = new PrismaClient();
const packageRoot = path.resolve(__dirname, '..');
const seedDataPath = path.join(__dirname, 'seed-data', 'cards.json');
const seedAssetsRoot = path.join(__dirname, 'seed-assets');

async function main() {
  const raw = await fs.readFile(seedDataPath, 'utf8');
  const cards = JSON.parse(raw);

  if (!Array.isArray(cards) || cards.length === 0) {
    console.log('No seed cards found. Skipping.');
    return;
  }

  let created = 0;
  let updated = 0;

  for (const card of cards) {
    const image = card.imagePath ? await importSeedImage(card.imagePath) : null;
    const where = {
      name: card.name.trim(),
      set: normalizeNullable(card.set),
      year: normalizeYear(card.year),
      player: normalizeNullable(card.player),
      variant: normalizeNullable(card.variant),
      sport: normalizeNullable(card.sport),
    };

    const existing = await prisma.card.findFirst({ where });
    const data = {
      ...where,
      collectionStatus: card.collectionStatus === 'WANTED' ? 'WANTED' : 'OWNED',
      gradeEstimate: normalizeNullable(card.gradeEstimate),
      confidence: typeof card.confidence === 'number' ? card.confidence : null,
      imageUrl: image?.thumbnailKey ?? existing?.imageUrl ?? null,
      originalImageKey: image?.originalKey ?? existing?.originalImageKey ?? null,
      thumbnailImageKey: image?.thumbnailKey ?? existing?.thumbnailImageKey ?? null,
    };

    if (existing) {
      await prisma.card.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
    } else {
      await prisma.card.create({ data });
      created += 1;
    }
  }

  console.log(`Seed complete. ${created} created, ${updated} updated.`);
}

function normalizeNullable(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeYear(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
