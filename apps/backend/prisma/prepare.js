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

      // All migrations are now baselined — deploy should be a no-op or apply
      // any genuinely new migrations that weren't in the baseline set.
      runPrisma(['migrate', 'deploy']);
    } else {
      process.exit(migrateResult.status ?? 1);
    }
  }

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
