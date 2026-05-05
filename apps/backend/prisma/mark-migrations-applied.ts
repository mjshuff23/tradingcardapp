// @ts-nocheck
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const packageRoot = path.resolve(__dirname, '..');
const migrationsRoot = path.join(packageRoot, 'prisma', 'migrations');
const schemaPath = path.join(packageRoot, 'prisma', 'schema.prisma');
const targetDatabaseUrl = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

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

    if (migrationCount > 0) {
      console.log(`Database already has ${migrationCount} recorded Prisma migration(s). Nothing to mark.`);
      return;
    }

    if (legacyCardExists) {
      throw new Error(
        'Legacy "Card" table detected. Do not mark migrations as applied here. Export the catalog and migrate into a clean normalized database instead.',
      );
    }

    if (normalizedTables.filter(Boolean).length < 4) {
      throw new Error(
        'Current schema does not look like the normalized model. Refusing to mark migrations as applied.',
      );
    }

    const diff = runPrisma([
      'migrate',
      'diff',
      '--from-url',
      targetDatabaseUrl,
      '--to-schema-datamodel',
      schemaPath,
      '--exit-code',
    ]);

    if (diff.status !== 0) {
      throw new Error(
        'Prisma detected schema drift between the target database and prisma/schema.prisma. Resolve the diff before marking migrations as applied.',
      );
    }

    const migrations = (await fs.readdir(migrationsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    if (!migrations.length) {
      throw new Error('No migration directories found under prisma/migrations.');
    }

    for (const migration of migrations) {
      const result = runPrisma(['migrate', 'resolve', '--applied', migration]);
      if (result.status !== 0) {
        throw new Error(`Failed marking migration ${migration} as applied.`);
      }
    }

    console.log(`Marked ${migrations.length} Prisma migration(s) as applied on ${safeHost(targetDatabaseUrl)}.`);
  } finally {
    await prisma.$disconnect();
  }
}

function runPrisma(args: string[]) {
  const result = spawnSync(getNpxCommand(), ['prisma', ...args], {
    cwd: packageRoot,
    env: {
      ...process.env,
      DATABASE_URL: targetDatabaseUrl,
    },
    encoding: 'utf8',
    stdio: 'pipe',
  });

  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function getNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
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
