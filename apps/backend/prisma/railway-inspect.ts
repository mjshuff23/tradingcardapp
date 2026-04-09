// @ts-nocheck
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const packageRoot = path.resolve(__dirname, '..');
const targetDatabaseUrl = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

type RailwaySchemaState =
  | 'already_managed'
  | 'current_without_history'
  | 'legacy_pre_normalized'
  | 'unknown_drift';

async function main() {
  if (!targetDatabaseUrl) {
    throw new Error('TARGET_DATABASE_URL or DATABASE_URL is required.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: targetDatabaseUrl,
    }),
  });

  try {
    const migrationTableExists = await relationExists(prisma, '_prisma_migrations');
    const migrationCount = migrationTableExists
      ? await countRows(prisma, '_prisma_migrations')
      : 0;
    const legacyCardExists = await relationExists(prisma, '"Card"');
    const normalizedTables = await Promise.all(
      ['"CardSet"', '"CardDefinition"', '"UserCard"', '"UserWishlist"'].map((table) =>
        relationExists(prisma, table),
      ),
    );

    const normalizedTableCount = normalizedTables.filter(Boolean).length;
    const state = classifyState({
      migrationCount,
      legacyCardExists,
      normalizedTableCount,
    });

    const payload = {
      state,
      databaseUrlHost: safeHost(targetDatabaseUrl),
      migrationTableExists,
      migrationCount,
      legacyCardExists,
      normalizedTableCount,
      normalizedTables: {
        CardSet: normalizedTables[0],
        CardDefinition: normalizedTables[1],
        UserCard: normalizedTables[2],
        UserWishlist: normalizedTables[3],
      },
      recommendedNextStep: recommendedNextStep(state),
      packageRoot,
    };

    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function classifyState(input: {
  migrationCount: number;
  legacyCardExists: boolean;
  normalizedTableCount: number;
}): RailwaySchemaState {
  if (input.migrationCount > 0) {
    return 'already_managed';
  }

  if (input.legacyCardExists) {
    return 'legacy_pre_normalized';
  }

  if (input.normalizedTableCount >= 4) {
    return 'current_without_history';
  }

  return 'unknown_drift';
}

function recommendedNextStep(state: RailwaySchemaState): string {
  switch (state) {
    case 'already_managed':
      return 'Run `npx prisma migrate status` or `npx prisma migrate deploy` against this database.';
    case 'current_without_history':
      return 'Run `npm run db:railway:mark-applied -w apps/backend` after verifying `prisma migrate diff --exit-code` shows no diff.';
    case 'legacy_pre_normalized':
      return 'Export the legacy catalog, provision a clean normalized database, run `prisma migrate deploy`, then import the catalog JSON.';
    default:
      return 'Treat this database as drifted. Inspect schema manually before applying or marking migrations.';
  }
}

async function relationExists(prisma: PrismaClient, relationName: string) {
  const result = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT to_regclass('${relationName}') IS NOT NULL AS "exists"`,
  );

  return Boolean(result?.[0]?.exists);
}

async function countRows(prisma: PrismaClient, relationName: string) {
  const result = await prisma.$queryRawUnsafe<{ count: bigint | number | string }[]>(
    `SELECT COUNT(*)::bigint AS "count" FROM ${relationName}`,
  );

  return Number(result?.[0]?.count ?? 0);
}

function safeHost(connectionString: string) {
  try {
    const url = new URL(connectionString);
    return `${url.hostname}:${url.port || '5432'}`;
  } catch {
    return 'unknown';
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
