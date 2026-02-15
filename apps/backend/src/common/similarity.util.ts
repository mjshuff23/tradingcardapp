import { tokenize } from './normalize.util';

export function levenshteinSimilarity(left: string, right: string): number {
  if (!left && !right) {
    return 1;
  }

  if (!left || !right) {
    return 0;
  }

  const a = left;
  const b = right;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const distance = matrix[rows - 1][cols - 1];
  const maxLength = Math.max(a.length, b.length);
  return Number((1 - distance / maxLength).toFixed(3));
}

export function tokenCoverageScore(sourceText: string, targetText: string): number {
  const sourceTokens = new Set(tokenize(sourceText));
  const targetTokens = tokenize(targetText);

  if (!sourceTokens.size || !targetTokens.length) {
    return 0;
  }

  let matches = 0;
  for (const token of targetTokens) {
    if (sourceTokens.has(token)) {
      matches += 1;
    }
  }

  return Number((matches / targetTokens.length).toFixed(3));
}
