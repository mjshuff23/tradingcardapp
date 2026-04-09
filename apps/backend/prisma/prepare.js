const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');

function main() {
  const migrateResult = runPrisma(['migrate', 'deploy'], { allowFailure: true });

  if (migrateResult.status !== 0) {
    if (migrateResult.stderr.includes('P3005')) {
      // The database schema is not empty and hasn't been baselined.
      // Mark every migration as already applied so Prisma won't try to re-run
      // SQL that is already present in the production database.
      console.log(
        'Detected P3005: database schema not empty. Baselining existing schema...',
      );

      const migrationsDir = path.join(__dirname, 'migrations');
      const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
      const migrationNames = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();

      for (const migrationName of migrationNames) {
        console.log(`Marking migration as applied: ${migrationName}`);
        runPrisma(['migrate', 'resolve', '--applied', migrationName], {
          allowFailure: true,
        });
      }
    } else {
      process.exit(migrateResult.status ?? 1);
    }
  }

  // Always run `db push` after `migrate deploy`, regardless of whether deploy
  // succeeded or migrations were baselined. This reconciles the actual database
  // schema with the Prisma schema, creating any tables or columns that are
  // missing without touching existing ones. This is necessary when all
  // migrations are already marked as applied (baselined) but the corresponding
  // SQL was never executed — `migrate deploy` exits 0 in that case, so `db
  // push` is the only way to bring the schema up to date. It is idempotent and
  // safe to run even when the schema is already in sync.
  runPrisma(['db', 'push', '--skip-generate']);

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
