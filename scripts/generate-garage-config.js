/**
 * This script generates the `garage.toml` configuration file for the Garage S3-compatible storage service.
 * It reads environment variables from a `.env` file and replaces placeholders in a template file.
 * The generated `garage.toml` is written to the project root directory.
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const templatePath = path.join(rootDir, 'garage.toml.template');
const outputPath = path.join(rootDir, 'garage.toml');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envPath);

if (!fs.existsSync(templatePath)) {
  console.error(`Missing template: ${templatePath}`);
  process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf8');
const missing = new Set();

const rendered = template.replace(/\$\{([A-Z0-9_]+)\}/g, (match, name) => {
  const value = process.env[name];
  if (!value) {
    missing.add(name);
    return match;
  }
  return value;
});

if (missing.size > 0) {
  console.error(`Missing required env vars: ${Array.from(missing).join(', ')}`);
  process.exit(1);
}

fs.writeFileSync(outputPath, rendered);
console.log(`Wrote ${outputPath}`);
