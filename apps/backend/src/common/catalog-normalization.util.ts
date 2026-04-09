import { normalizeText } from './normalize.util';

export const DEFAULT_LOCAL_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'local',
  email: 'local@example.com',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$local$placeholder',
  pfpUrl: null as string | null,
};

export type CatalogDraftInput = {
  name: string;
  brand?: string | null;
  set?: string | null;
  setName?: string | null;
  year?: number | null;
  yearManufactured?: number | null;
  player?: string | null;
  variant?: string | null;
  sport?: string | null;
  season?: string | null;
  cardNumber?: string | null;
  category?: string | null;
  subcategory?: string | null;
  hasAutographVariant?: boolean | null;
  originalOrReprint?: string | null;
  parallelOrVariety?: string | null;
  setType?: string | null;
  insertSetName?: string | null;
  cardType?: string | null;
  isVintage?: boolean | null;
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
  'chrome',
  'optic',
  'o pee chee',
];

export function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeNullableNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function inferBrand(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const match = BRAND_KEYWORDS.find((keyword) => normalized.includes(keyword));
  if (!match) {
    return null;
  }

  return titleCase(match);
}

export function inferSeason(setValue: string | null | undefined, year: number | null | undefined): string | null {
  const fromSet = normalizeNullableText(setValue)?.match(/\b(\d{4}-\d{2})\b/)?.[1];
  if (fromSet) {
    return fromSet;
  }

  if (!year) {
    return null;
  }

  return null;
}

export function inferCardNumber(...values: Array<string | null | undefined>): string | null {
  let standaloneFallback: string | null = null;

  for (const value of values) {
    const normalized = normalizeNullableText(value);
    if (!normalized) {
      continue;
    }

    const explicitMatch = normalized.match(
      /(?:card\s*(?:no|number)?\s*#?\s*|number\s*#?\s*|#\s*)([a-z]?\d{1,6}[a-z]?)/i,
    );
    if (explicitMatch?.[1]) {
      return explicitMatch[1].toUpperCase();
    }

    const standaloneMatch = normalized.match(/^\s*([a-z]?\d{1,6}[a-z]?)\s*$/i);
    if (!standaloneFallback && standaloneMatch?.[1]) {
      standaloneFallback = standaloneMatch[1].toUpperCase();
    }
  }

  return standaloneFallback;
}

export function buildNormalizedSetKey(input: {
  brand?: string | null;
  setName?: string | null;
  legacySetText?: string | null;
  yearManufactured?: number | null;
  sport?: string | null;
}): string {
  return [
    normalizeText(input.brand),
    normalizeText(input.setName),
    normalizeText(input.legacySetText),
    input.yearManufactured ? String(input.yearManufactured) : '',
    normalizeText(input.sport),
  ]
    .filter(Boolean)
    .join('|');
}

export function buildNormalizedCardKey(input: {
  normalizedSetKey?: string | null;
  cardNumber?: string | null;
  name: string;
  player?: string | null;
  variant?: string | null;
  legacySetText?: string | null;
  year?: number | null;
  sport?: string | null;
}): string {
  return [
    normalizeText(input.normalizedSetKey),
    normalizeText(input.cardNumber),
    normalizeText(input.name),
    normalizeText(input.player),
    normalizeText(input.variant),
    normalizeText(input.legacySetText),
    input.year ? String(input.year) : '',
    normalizeText(input.sport),
  ]
    .filter(Boolean)
    .join('|');
}

export function deriveCatalogDraft(input: CatalogDraftInput) {
  const setValue = normalizeNullableText(input.set ?? input.setName);
  const explicitSetName = normalizeNullableText(input.setName);
  const explicitBrand = normalizeNullableText(input.brand);
  const yearValue = normalizeNullableNumber(input.yearManufactured ?? input.year);
  const sportValue = normalizeNullableText(input.sport);
  const playerValue = normalizeNullableText(input.player);
  const variantValue = normalizeNullableText(input.variant);
  const brandValue = explicitBrand ?? inferBrand(setValue);
  const setNameValue = explicitSetName ?? setValue;
  const seasonValue = normalizeNullableText(input.season) ?? inferSeason(setValue, yearValue);
  const cardNumberValue =
    normalizeNullableText(input.cardNumber) ?? inferCardNumber(input.name, setValue, input.variant);
  const normalizedSetKey = buildNormalizedSetKey({
    brand: brandValue,
    setName: setNameValue,
    legacySetText: setValue,
    yearManufactured: yearValue,
    sport: sportValue,
  });
  const normalizedCardKey = buildNormalizedCardKey({
    normalizedSetKey,
    cardNumber: cardNumberValue,
    name: input.name,
    player: playerValue,
    variant: variantValue,
    legacySetText: setValue,
    year: yearValue,
    sport: sportValue,
  });

  return {
    brand: brandValue,
    setName: setNameValue,
    legacySetText: setValue,
    yearManufactured: yearValue,
    sport: sportValue,
    season: seasonValue,
    player: playerValue,
    variant: variantValue,
    cardNumber: cardNumberValue,
    category: normalizeNullableText(input.category),
    subcategory: normalizeNullableText(input.subcategory),
    hasAutographVariant: Boolean(input.hasAutographVariant),
    originalOrReprint: normalizeNullableText(input.originalOrReprint),
    parallelOrVariety: normalizeNullableText(input.parallelOrVariety),
    setType: normalizeNullableText(input.setType),
    insertSetName: normalizeNullableText(input.insertSetName),
    cardType: normalizeNullableText(input.cardType),
    isVintage: Boolean(input.isVintage),
    normalizedSetKey,
    normalizedCardKey,
  };
}

function titleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join(' ');
}
