export type CsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

export function parseCsv(content: string): CsvRow[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return [];
  }

  const header = parseCsvLine(lines[0]).map((name) => name.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row: CsvRow = {};

    for (let j = 0; j < header.length; j += 1) {
      row[header[j]] = values[j] ?? '';
    }

    rows.push(row);
  }

  return rows;
}
