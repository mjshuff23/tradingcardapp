import { normalizeText } from './normalize.util';

export type StructuredCardHints = {
  years: number[];
  cardNumbers: string[];
  brands: string[];
};

const BRAND_KEYWORDS = [
  'upper deck',
  'topps',
  'panini',
  'skybox',
  'donruss',
  'prizm',
  'hoops',
  'fleer',
  'bowman',
  'score',
  'pokemon',
  'sp authentic',
  'chrome',
  'optic',
];

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function parseStructuredCardHints(frontText: string, backText?: string): StructuredCardHints {
  const primaryText = backText && backText.trim().length > 0 ? backText : `${frontText} ${backText ?? ''}`;
  const normalized = normalizeText(primaryText);

  const years = unique(
    Array.from(normalized.matchAll(/\b(19\d{2}|20\d{2})\b/g))
      .map((match) => Number(match[1]))
      .filter((year) => year >= 1900 && year <= 2099),
  );

  const explicitCardNumbers = Array.from(
    normalized.matchAll(/(?:card\s*(?:no|number|#)?\s*|no\.?\s*|#\s*)([a-z]?\d{1,4}[a-z]?)/g),
  ).map((match) => match[1].toUpperCase());

  const genericNumberCandidates = Array.from(normalized.matchAll(/\b([a-z]?\d{1,4}[a-z]?)\b/g))
    .map((match) => match[1].toUpperCase())
    .filter((value) => /\d/.test(value))
    .filter((value) => value.length <= 5)
    .filter((value) => !/^19\d{2}$/.test(value) && !/^20\d{2}$/.test(value));

  const cardNumbers = unique([...explicitCardNumbers, ...genericNumberCandidates]).slice(0, 12);

  const brands = BRAND_KEYWORDS.filter((brand) => normalized.includes(brand));

  return {
    years,
    cardNumbers,
    brands,
  };
}
