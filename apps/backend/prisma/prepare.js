const { spawnSync } = require('node:child_process');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');

function main() {
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
