import { normalizeText } from "./normalize.util";

export const DEFAULT_LOCAL_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  username: "local",
  email: "local@example.com",
  passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$local$placeholder",
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
  "upper deck",
  "topps",
  "panini",
  "skybox",
  "donruss",
  "prizm",
  "hoops",
  "fleer",
  "bowman",
  "score",
  "pokemon",
  "chrome",
  "optic",
  "o pee chee",
];

export function normalizeNullableText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
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

export function inferSeason(
  setValue: string | null | undefined,
  year: number | null | undefined,
): string | null {
  const fromSet =
    normalizeNullableText(setValue)?.match(/\b(\d{4}-\d{2})\b/)?.[1];
  if (fromSet) {
    return fromSet;
  }

  if (!year) {
    return null;
  }

  return null;
}

type CardNumberMention = {
  cardNumber: string;
  start: number;
  end: number;
};

type CardNumberToken = {
  text: string;
  start: number;
  end: number;
};

const CARD_NUMBER_TOKEN_PATTERN =
  /#?[a-z]?\d{1,6}[a-z]?|\bcard\b|\bnumber\b|\bno\b\.?/gi;

function cardNumberTokens(value: string): CardNumberToken[] {
  return Array.from(value.matchAll(CARD_NUMBER_TOKEN_PATTERN)).map((match) => {
    const start = match.index ?? 0;
    return {
      text: match[0],
      start,
      end: start + match[0].length,
    };
  });
}

function normalizeCardNumberToken(token: string): string | null {
  const withoutHash = token.startsWith("#") ? token.slice(1) : token;
  return /^[a-z]?\d{1,6}[a-z]?$/i.test(withoutHash)
    ? withoutHash.toUpperCase()
    : null;
}

function isNumberLabel(token: string): boolean {
  const normalized = token.toLowerCase();
  return normalized === "number" || normalized === "no" || normalized === "no.";
}

function findExplicitCardNumberMentions(value: string): CardNumberMention[] {
  const tokens = cardNumberTokens(value);
  const mentions: CardNumberMention[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const lowerToken = token.text.toLowerCase();

    if (token.text.startsWith("#")) {
      const cardNumber = normalizeCardNumberToken(token.text);
      if (cardNumber) {
        mentions.push({ cardNumber, start: token.start, end: token.end });
      }
      continue;
    }

    if (lowerToken === "card") {
      let numberIndex = index + 1;
      if (tokens[numberIndex] && isNumberLabel(tokens[numberIndex].text)) {
        numberIndex += 1;
      }

      const cardNumber = tokens[numberIndex]
        ? normalizeCardNumberToken(tokens[numberIndex].text)
        : null;
      if (cardNumber) {
        mentions.push({
          cardNumber,
          start: token.start,
          end: tokens[numberIndex].end,
        });
      }
      continue;
    }

    if (isNumberLabel(token.text)) {
      const numberToken = tokens[index + 1];
      const cardNumber = numberToken
        ? normalizeCardNumberToken(numberToken.text)
        : null;
      if (cardNumber) {
        mentions.push({
          cardNumber,
          start: token.start,
          end: numberToken.end,
        });
      }
    }
  }

  return mentions;
}

export function extractExplicitCardNumbers(value: string): string[] {
  return Array.from(
    new Set(
      findExplicitCardNumberMentions(value).map((match) => match.cardNumber),
    ),
  );
}

export function stripExplicitCardNumberMentions(value: string): string {
  const mentions = findExplicitCardNumberMentions(value).sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const ranges: Array<{ start: number; end: number }> = [];

  for (const mention of mentions) {
    const previous = ranges[ranges.length - 1];
    if (previous && mention.start <= previous.end) {
      previous.end = Math.max(previous.end, mention.end);
    } else {
      ranges.push({ start: mention.start, end: mention.end });
    }
  }

  let stripped = "";
  let cursor = 0;
  for (const range of ranges) {
    stripped += value.slice(cursor, range.start);
    const hasSpaceBefore = /\s/.test(value.charAt(range.start - 1));
    const hasSpaceAfter = /\s/.test(value.charAt(range.end));
    if (!hasSpaceBefore || !hasSpaceAfter) {
      stripped += " ";
    }
    cursor = range.end;
  }

  return `${stripped}${value.slice(cursor)}`.replace(/\s+/g, " ").trim();
}

export function inferCardNumber(
  ...values: Array<string | null | undefined>
): string | null {
  let standaloneFallback: string | null = null;

  for (const value of values) {
    const normalized = normalizeNullableText(value);
    if (!normalized) {
      continue;
    }

    const explicitMatches = extractExplicitCardNumbers(normalized);
    if (explicitMatches.length) {
      return explicitMatches[0];
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
    input.yearManufactured ? String(input.yearManufactured) : "",
    normalizeText(input.sport),
  ]
    .filter(Boolean)
    .join("|");
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
    input.year ? String(input.year) : "",
    normalizeText(input.sport),
  ]
    .filter(Boolean)
    .join("|");
}

export function deriveCatalogDraft(input: CatalogDraftInput) {
  const setValue = normalizeNullableText(input.set ?? input.setName);
  const explicitSetName = normalizeNullableText(input.setName);
  const explicitBrand = normalizeNullableText(input.brand);
  const yearValue = normalizeNullableNumber(
    input.yearManufactured ?? input.year,
  );
  const sportValue = normalizeNullableText(input.sport);
  const playerValue = normalizeNullableText(input.player);
  const variantValue = normalizeNullableText(input.variant);
  const brandValue = explicitBrand ?? inferBrand(setValue);
  const setNameValue = explicitSetName ?? setValue;
  const seasonValue =
    normalizeNullableText(input.season) ?? inferSeason(setValue, yearValue);
  const cardNumberValue =
    normalizeNullableText(input.cardNumber) ??
    inferCardNumber(input.name, setValue, input.variant);
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
    .split(" ")
    .filter(Boolean)
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join(" ");
}
