// @ts-nocheck
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import path from 'node:path';
import dotenv from 'dotenv';
import { MediaReference, StorageTarget } from '../src/storage/storage-ops.util';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const packageRoot = path.resolve(__dirname, '..');
export const targetDatabaseUrl =
  process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

type StorageConfig = {
  client: S3Client;
  buckets: Record<StorageTarget, string>;
  endpoint: string | null;
  region: string;
};

export function createPrismaClient() {
  if (!targetDatabaseUrl) {
    throw new Error('TARGET_DATABASE_URL or DATABASE_URL is required.');
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: targetDatabaseUrl,
    }),
  });
}

export function createTargetStorageConfig(): StorageConfig {
  const config = createStorageConfig('S3_');
  if (!config) {
    throw new Error(
      'Target S3 configuration is required. Set S3_ACCESS_KEY, S3_SECRET_KEY, S3_PROFILE_BUCKET, S3_CARD_BUCKET, and S3_REGION.',
    );
  }

  return config;
}

export function createSourceStorageConfig(): StorageConfig | null {
  return createStorageConfig('SOURCE_S3_');
}

export async function loadMediaReferences(
  prisma: PrismaClient,
): Promise<MediaReference[]> {
  const [users, scanJobs, userCards, userWishlists, cardDefinitions] =
    await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          pfpUrl: true,
          pfpOriginalImageKey: true,
          pfpThumbnailImageKey: true,
        },
      }),
      prisma.scanJob.findMany({
        select: {
          id: true,
          originalImageKey: true,
          thumbnailImageKey: true,
          backOriginalImageKey: true,
          backThumbnailImageKey: true,
        },
      }),
      prisma.userCard.findMany({
        select: {
          id: true,
          imageUrl: true,
          originalImageKey: true,
          thumbnailImageKey: true,
          frontImageKey: true,
          backImageKey: true,
        },
      }),
      prisma.userWishlist.findMany({
        select: {
          id: true,
          imageUrl: true,
          originalImageKey: true,
          thumbnailImageKey: true,
          frontImageKey: true,
          backImageKey: true,
        },
      }),
      prisma.cardDefinition.findMany({
        select: {
          id: true,
          canonicalImageUrl: true,
          canonicalOriginalImageKey: true,
          canonicalThumbnailImageKey: true,
        },
      }),
    ]);

  return [
    ...users.flatMap((user) => [
      createReference('profile', 'User', user.id, 'pfpUrl', user.pfpUrl),
      createReference(
        'profile',
        'User',
        user.id,
        'pfpOriginalImageKey',
        user.pfpOriginalImageKey,
      ),
      createReference(
        'profile',
        'User',
        user.id,
        'pfpThumbnailImageKey',
        user.pfpThumbnailImageKey,
      ),
    ]),
    ...scanJobs.flatMap((scanJob) => [
      createReference(
        'card',
        'ScanJob',
        String(scanJob.id),
        'originalImageKey',
        scanJob.originalImageKey,
      ),
      createReference(
        'card',
        'ScanJob',
        String(scanJob.id),
        'thumbnailImageKey',
        scanJob.thumbnailImageKey,
      ),
      createReference(
        'card',
        'ScanJob',
        String(scanJob.id),
        'backOriginalImageKey',
        scanJob.backOriginalImageKey,
      ),
      createReference(
        'card',
        'ScanJob',
        String(scanJob.id),
        'backThumbnailImageKey',
        scanJob.backThumbnailImageKey,
      ),
    ]),
    ...userCards.flatMap((card) => [
      createReference('card', 'UserCard', String(card.id), 'imageUrl', card.imageUrl),
      createReference(
        'card',
        'UserCard',
        String(card.id),
        'originalImageKey',
        card.originalImageKey,
      ),
      createReference(
        'card',
        'UserCard',
        String(card.id),
        'thumbnailImageKey',
        card.thumbnailImageKey,
      ),
      createReference(
        'card',
        'UserCard',
        String(card.id),
        'frontImageKey',
        card.frontImageKey,
      ),
      createReference(
        'card',
        'UserCard',
        String(card.id),
        'backImageKey',
        card.backImageKey,
      ),
    ]),
    ...userWishlists.flatMap((wishlist) => [
      createReference(
        'card',
        'UserWishlist',
        String(wishlist.id),
        'imageUrl',
        wishlist.imageUrl,
      ),
      createReference(
        'card',
        'UserWishlist',
        String(wishlist.id),
        'originalImageKey',
        wishlist.originalImageKey,
      ),
      createReference(
        'card',
        'UserWishlist',
        String(wishlist.id),
        'thumbnailImageKey',
        wishlist.thumbnailImageKey,
      ),
      createReference(
        'card',
        'UserWishlist',
        String(wishlist.id),
        'frontImageKey',
        wishlist.frontImageKey,
      ),
      createReference(
        'card',
        'UserWishlist',
        String(wishlist.id),
        'backImageKey',
        wishlist.backImageKey,
      ),
    ]),
    ...cardDefinitions.flatMap((definition) => [
      createReference(
        'card',
        'CardDefinition',
        definition.id,
        'canonicalImageUrl',
        definition.canonicalImageUrl,
      ),
      createReference(
        'card',
        'CardDefinition',
        definition.id,
        'canonicalOriginalImageKey',
        definition.canonicalOriginalImageKey,
      ),
      createReference(
        'card',
        'CardDefinition',
        definition.id,
        'canonicalThumbnailImageKey',
        definition.canonicalThumbnailImageKey,
      ),
    ]),
  ].filter((reference) => Boolean(reference.key));
}

export async function objectExists(
  storage: StorageConfig,
  target: StorageTarget,
  key: string,
) {
  try {
    await storage.client.send(
      new HeadObjectCommand({
        Bucket: storage.buckets[target],
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    if (isMissingObjectError(error)) {
      return false;
    }

    throw error;
  }
}

export async function readObject(
  storage: StorageConfig,
  target: StorageTarget,
  key: string,
) {
  const response = await storage.client.send(
    new GetObjectCommand({
      Bucket: storage.buckets[target],
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Object body missing for ${key}`);
  }

  const bytes = await response.Body.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    contentType: response.ContentType ?? null,
  };
}

export async function writeObject(
  storage: StorageConfig,
  target: StorageTarget,
  key: string,
  payload: { body: Buffer; contentType: string | null },
) {
  await storage.client.send(
    new PutObjectCommand({
      Bucket: storage.buckets[target],
      Key: key,
      Body: payload.body,
      ContentType: payload.contentType ?? undefined,
    }),
  );
}

function createStorageConfig(prefix: string): StorageConfig | null {
  const endpoint = process.env[`${prefix}ENDPOINT`] ?? null;
  const accessKeyId = process.env[`${prefix}ACCESS_KEY`] ?? '';
  const secretAccessKey = process.env[`${prefix}SECRET_KEY`] ?? '';
  const defaultBucket = process.env[`${prefix}BUCKET`] ?? '';
  const profileBucket =
    process.env[`${prefix}PROFILE_BUCKET`] ?? defaultBucket;
  const cardBucket = process.env[`${prefix}CARD_BUCKET`] ?? defaultBucket;
  const region = process.env[`${prefix}REGION`] ?? 'auto';

  if (!accessKeyId || !secretAccessKey || !profileBucket || !cardBucket) {
    return null;
  }

  return {
    endpoint,
    region,
    buckets: {
      profile: profileBucket,
      card: cardBucket,
    },
    client: new S3Client({
      endpoint: endpoint ?? undefined,
      region,
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };
}

function createReference(
  target: StorageTarget,
  ownerType: string,
  ownerId: string,
  field: string,
  key: string | null | undefined,
): MediaReference {
  return {
    target,
    ownerType,
    ownerId,
    field,
    key: key ?? null,
  };
}

function isMissingObjectError(error: unknown) {
  const code =
    typeof error === 'object' && error !== null
      ? String(error.Code ?? error.name ?? '')
      : '';
  const status = error?.$metadata?.httpStatusCode;

  return (
    code === 'NotFound' ||
    code === 'NoSuchKey' ||
    code === 'UnknownError' ||
    status === 404
  );
}
