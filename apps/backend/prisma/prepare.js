const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(__dirname, 'schema.prisma');
const migrationsDir = path.join(__dirname, 'migrations');

function main() {
  const deployResult = runPrisma(['migrate', 'deploy'], { allowFailure: true });
  if (deployResult.status === 0) {
    runPrisma(['db', 'seed']);
    return;
  }

  const combinedOutput = `${deployResult.stdout}\n${deployResult.stderr}`;
  if (!combinedOutput.includes('P3005')) {
    process.exit(deployResult.status ?? 1);
  }

  if (process.env.PRISMA_BASELINE_ON_P3005 !== 'true') {
    console.error(
      [
        '',
        'Prisma found a non-empty database with no recorded migration history.',
        'If this Railway database already matches prisma/schema.prisma, rerun with PRISMA_BASELINE_ON_P3005=true once to mark the existing migrations as applied.',
      ].join('\n'),
    );
    process.exit(deployResult.status ?? 1);
  }

  console.log('P3005 detected. Verifying that the existing database already matches prisma/schema.prisma before baselining...');
  const diffResult = runPrisma(
    ['migrate', 'diff', '--exit-code', '--from-url', process.env.DATABASE_URL, '--to-schema-datamodel', schemaPath],
    { allowFailure: true },
  );

  if (diffResult.status === 2) {
    console.error(
      [
        '',
        'Baseline aborted because the live database does not match prisma/schema.prisma.',
        'Run a manual baseline/migration instead of auto-resolving migrations on startup.',
      ].join('\n'),
    );
    process.exit(1);
  }

  if (diffResult.status !== 0) {
    process.exit(diffResult.status ?? 1);
  }

  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (migrations.length === 0) {
    console.error('No Prisma migrations found to baseline.');
    process.exit(1);
  }

  console.log(`Database schema matches the Prisma schema. Marking ${migrations.length} migrations as applied...`);
  for (const migration of migrations) {
    runPrisma(['migrate', 'resolve', '--applied', migration, '--schema', schemaPath]);
  }

  runPrisma(['migrate', 'deploy']);
  runPrisma(['db', 'seed']);
}

function runPrisma(args, { allowFailure = false } = {}) {
  const result = spawnSync(getNpxCommand(), ['prisma', ...args], {
    cwd: packageRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');

  if (!allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function getNpxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

main();
