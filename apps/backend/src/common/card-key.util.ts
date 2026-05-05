import { normalizeText } from "./normalize.util";

export type CardKeyInput = {
  name: string;
  set?: string | null;
  year?: number | null;
  player?: string | null;
  variant?: string | null;
  sport?: string | null;
};

export function buildCardKey(input: CardKeyInput): string {
  return [
    normalizeText(input.name),
    normalizeText(input.set),
    input.year ? String(input.year) : "",
    normalizeText(input.player),
    normalizeText(input.variant),
    normalizeText(input.sport),
  ]
    .filter(Boolean)
    .join("|");
}
