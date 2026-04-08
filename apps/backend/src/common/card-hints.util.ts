import { normalizeText } from './normalize.util';

export type StructuredCardHints = {
  years: number[];
  seasons: string[];
  cardNumbers: string[];
  brands: string[];
  subsets: string[];
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

const SUBSET_KEYWORDS = [
  'spx',
  'sp authentic',
  'die cut',
  'refractor',
  'holo',
  'silver',
  'chrome',
  'finest',
  'stadium club',
];

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function parseStructuredCardHints(frontText: string, backText?: string): StructuredCardHints {
  const primaryText = backText && backText.trim().length > 0 ? backText : `${frontText} ${backText ?? ''}`;
  const normalized = normalizeText(primaryText);
  const lowered = primaryText.toLowerCase();

  const seasons = unique(
    Array.from(lowered.matchAll(/\b(19\d{2}|20\d{2})\s*[-/]\s*(\d{2}|19\d{2}|20\d{2})\b/g)).map(
      (match) => {
        const startYear = Number(match[1]);
        const rawEnd = match[2];
        const endYear =
          rawEnd.length === 2 ? Math.floor(startYear / 100) * 100 + Number(rawEnd) : Number(rawEnd);
        return `${startYear}-${String(endYear).slice(-2)}`;
      },
    ),
  );

  const seasonYears = seasons.flatMap((season) => {
    const start = Number(season.slice(0, 4));
    const end = Number(`${Math.floor(start / 100)}${season.slice(5, 7)}`);
    return [start, end];
  });

  const years = unique(
    [
      ...Array.from(normalized.matchAll(/\b(19\d{2}|20\d{2})\b/g)).map((match) => Number(match[1])),
      ...seasonYears,
    ]
      .filter((year) => year >= 1900 && year <= 2099),
  );

  const explicitCardNumbers = Array.from(
    lowered.matchAll(
      /(?:card\s*(?:no|number|#)?\s*|no\.?\s*|number\s*|#\s*)([a-z]?\d{1,6}[a-z]?)/g,
    ),
  ).map((match) => match[1].toUpperCase());

  const slabStyleNumbers = Array.from(lowered.matchAll(/#\s*([a-z0-9]{3,8})\b/g)).map((match) =>
    match[1].toUpperCase(),
  );

  const cardNumbers = unique([...explicitCardNumbers, ...slabStyleNumbers])
    .filter((value) => !/^(19\d{2}|20\d{2})$/.test(value))
    .slice(0, 12);

  const brands = BRAND_KEYWORDS.filter((brand) => normalized.includes(brand));
  const subsets = SUBSET_KEYWORDS.filter((subset) => normalized.includes(subset));

  return {
    years,
    seasons,
    cardNumbers,
    brands,
    subsets,
  };
}
