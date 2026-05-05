export function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string | null | undefined): string[] {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return normalized.split(" ").filter(Boolean);
}

export function overlapScore(left: string[], right: string[]): number {
  if (!left.length || !right.length) {
    return 0;
  }

  const rightSet = new Set(right);
  let matches = 0;

  for (const token of left) {
    if (rightSet.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(left.length, right.length);
}
