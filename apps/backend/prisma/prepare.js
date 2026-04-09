const { spawnSync } = require('node:child_process');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');

function main() {
  const migrateResult = runPrisma(['migrate', 'deploy'], { allowFailure: true });

  if (migrateResult.status !== 0) {
    if (migrateResult.stderr.includes('P3005')) {
      // The database schema is not empty and hasn't been baselined.
      // Mark all migrations as rolled back so Prisma can re-apply them cleanly.
      console.log(
        'Detected P3005: database schema not empty. Baselining existing schema...',
      );
      runPrisma(['migrate', 'resolve', '--rolled-back', '--preview-feature'], {
        allowFailure: true,
      });
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
