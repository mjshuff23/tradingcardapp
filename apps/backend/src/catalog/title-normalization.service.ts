import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  inferBrand,
  inferCardNumber,
  normalizeNullableNumber,
  normalizeNullableText,
} from '../common/catalog-normalization.util';
import { normalizeText } from '../common/normalize.util';
import { CatalogSearchFilters } from './catalog-query.service';

export type NormalizedTitleFields = {
  name?: string | null;
  player?: string | null;
  brand?: string | null;
  setName?: string | null;
  yearManufactured?: number | null;
  season?: string | null;
  cardNumber?: string | null;
  sport?: string | null;
  variant?: string | null;
  category?: string | null;
  subcategory?: string | null;
  hasAutographVariant?: boolean | null;
  isVintage?: boolean | null;
};

export type TitleNormalizationResult = {
  rawTitle: string;
  cleanedTitle: string;
  cleanedSearchText: string | null;
  fields: NormalizedTitleFields;
  fieldConfidence: Record<string, number>;
  confidence: number;
  usedAi: boolean;
  search: CatalogSearchFilters;
  debug?: Record<string, unknown> | null;
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

const SPORT_KEYWORDS: Array<{ token: string; value: string }> = [
  { token: 'baseball', value: 'Baseball' },
  { token: 'basketball', value: 'Basketball' },
  { token: 'football', value: 'Football' },
  { token: 'hockey', value: 'Hockey' },
  { token: 'soccer', value: 'Soccer' },
  { token: 'pokemon', value: 'Pokemon' },
  { token: 'golf', value: 'Golf' },
];

@Injectable()
export class TitleNormalizationService {
  private readonly logger = new Logger(TitleNormalizationService.name);

  constructor(private readonly configService: ConfigService) {}

  parseDeterministic(rawTitle: string, seeded: NormalizedTitleFields = {}): TitleNormalizationResult {
    const normalizedRawTitle = rawTitle.replace(/\s+/g, ' ').trim();
    let working = ` ${normalizedRawTitle} `;
    const fieldConfidence: Record<string, number> = {};
    const fields: NormalizedTitleFields = { ...seeded };

    const seasonMatch = working.match(/\b(19\d{2}|20\d{2})\s*[-/]\s*(\d{2}|\d{4})\b/);
    if (seasonMatch) {
      const firstYear = Number(seasonMatch[1]);
      const secondYear = seasonMatch[2].length === 2 ? seasonMatch[2] : seasonMatch[2].slice(-2);
      fields.season = `${firstYear}-${secondYear}`;
      fields.yearManufactured = firstYear;
      fieldConfidence.season = 0.96;
      fieldConfidence.yearManufactured = 0.92;
      working = working.replace(seasonMatch[0], ' ');
    } else {
      const explicitYear = working.match(/\b(19\d{2}|20\d{2})\b/);
      if (explicitYear) {
        fields.yearManufactured = Number(explicitYear[1]);
        fieldConfidence.yearManufactured = 0.88;
        working = working.replace(explicitYear[0], ' ');
      }
    }

    const cardNumber = inferCardNumber(normalizedRawTitle, seeded.cardNumber ?? null);
    if (cardNumber) {
      fields.cardNumber = cardNumber;
      fieldConfidence.cardNumber = 0.94;
      working = working.replace(
        /(?:card\s*(?:no|number)?\s*#?\s*|number\s*#?\s*|#\s*)([a-z]?\d{1,6}[a-z]?)/gi,
        ' ',
      );
    }

    const explicitBrand = inferBrand(seeded.brand ?? normalizedRawTitle);
    if (explicitBrand) {
      fields.brand = explicitBrand;
      fieldConfidence.brand = seeded.brand ? 0.98 : 0.87;
      const matchedBrand = BRAND_KEYWORDS.find((keyword) =>
        normalizeText(normalizedRawTitle).includes(keyword),
      );
      if (matchedBrand) {
        working = working.replace(new RegExp(`\\b${matchedBrand.replace(/\s+/g, '\\s+')}\\b`, 'i'), ' ');
      }
    }

    for (const sport of SPORT_KEYWORDS) {
      if (new RegExp(`\\b${sport.token}\\b`, 'i').test(working)) {
        fields.sport = sport.value;
        fieldConfidence.sport = 0.82;
        working = working.replace(new RegExp(`\\b${sport.token}\\b`, 'ig'), ' ');
        break;
      }
    }

    if (/\b(autograph|autographed|signed|auto)\b/i.test(working)) {
      fields.hasAutographVariant = true;
      fieldConfidence.hasAutographVariant = 0.75;
      working = working.replace(/\b(autograph|autographed|signed|auto)\b/gi, ' ');
    }

    if (/\b(vintage|classic|old school|rookie)\b/i.test(working)) {
      fields.isVintage = true;
      fieldConfidence.isVintage = 0.62;
    }

    const cleanedLeftovers = working
      .replace(/[()[\],]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanedTokens = cleanedLeftovers
      .split(' ')
      .map((token) => token.trim())
      .filter(Boolean);

    const seededName = normalizeNullableText(seeded.name);
    const seededPlayer = normalizeNullableText(seeded.player);
    const remainder = titleCasePhrase(cleanedLeftovers);

    if (!fields.player && seededPlayer) {
      fields.player = seededPlayer;
      fieldConfidence.player = 0.98;
    } else if (!fields.player && looksLikePersonName(cleanedTokens)) {
      fields.player = remainder;
      fieldConfidence.player = 0.74;
    }

    if (!fields.name && seededName) {
      fields.name = seededName;
      fieldConfidence.name = 0.98;
    } else if (!fields.name && remainder) {
      fields.name = remainder;
      fieldConfidence.name = fields.player ? 0.68 : 0.72;
    }

    if (!fields.setName && seeded.setName) {
      fields.setName = normalizeNullableText(seeded.setName);
      fieldConfidence.setName = 0.98;
    } else if (!fields.setName && fields.brand && cleanedTokens.length >= 3 && !fields.player) {
      const maybeSetName = titleCasePhrase(cleanedTokens.slice(0, 3).join(' '));
      fields.setName = maybeSetName;
      fieldConfidence.setName = 0.42;
    }

    const cleanedSearchText = cleanedLeftovers ? cleanedLeftovers : null;
    const search = this.toSearchFilters(fields, cleanedSearchText);
    const confidenceValues = Object.values(fieldConfidence);
    const confidence =
      confidenceValues.length > 0
        ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(3))
        : 0.25;

    return {
      rawTitle: normalizedRawTitle,
      cleanedTitle: buildCleanTitle(fields),
      cleanedSearchText,
      fields,
      fieldConfidence,
      confidence,
      usedAi: false,
      search,
      debug: {
        leftoverText: cleanedLeftovers,
      },
    };
  }

  async normalize(rawTitle: string, seeded: NormalizedTitleFields = {}): Promise<TitleNormalizationResult> {
    const deterministic = this.parseDeterministic(rawTitle, seeded);
    const openAiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model = this.configService.get<string>('TITLE_NORMALIZER_AI_MODEL');
    const aiEnabled = this.configService.get<string>('TITLE_NORMALIZER_AI_ENABLED') === 'true';

    if (!aiEnabled || !openAiApiKey || !model || deterministic.confidence >= 0.9) {
      return deterministic;
    }

    try {
      const refined = await this.refineWithAi({
        openAiApiKey,
        model,
        deterministic,
      });

      if (!refined) {
        return deterministic;
      }

      return refined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI title refinement failed, falling back to deterministic parse: ${message}`);
      return deterministic;
    }
  }

  private toSearchFilters(fields: NormalizedTitleFields, cleanedSearchText: string | null): CatalogSearchFilters {
    return {
      searchText: cleanedSearchText ?? undefined,
      year: normalizeNullableNumber(fields.yearManufactured) ?? undefined,
      sport: normalizeNullableText(fields.sport) ?? undefined,
      cardNumber: normalizeNullableText(fields.cardNumber) ?? undefined,
      brand: normalizeNullableText(fields.brand) ?? undefined,
      setName: normalizeNullableText(fields.setName) ?? undefined,
      season: normalizeNullableText(fields.season) ?? undefined,
      isAutographed:
        fields.hasAutographVariant === null || fields.hasAutographVariant === undefined
          ? undefined
          : Boolean(fields.hasAutographVariant),
      isVintage:
        fields.isVintage === null || fields.isVintage === undefined
          ? undefined
          : Boolean(fields.isVintage),
    };
  }

  private async refineWithAi(input: {
    openAiApiKey: string;
    model: string;
    deterministic: TitleNormalizationResult;
  }): Promise<TitleNormalizationResult | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.openAiApiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You normalize messy trading card titles into a compact JSON object with likely fields. Return only valid JSON.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                rawTitle: input.deterministic.rawTitle,
                deterministic: input.deterministic.fields,
                instructions: {
                  preferredFields: [
                    'name',
                    'player',
                    'brand',
                    'setName',
                    'yearManufactured',
                    'season',
                    'cardNumber',
                    'sport',
                    'variant',
                    'category',
                    'subcategory',
                    'hasAutographVariant',
                    'isVintage',
                  ],
                  schema:
                    'Return {"fields": {...}, "fieldConfidence": {"name":0-1}, "cleanedTitle":"...", "cleanedSearchText":"..."}',
                },
              }),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed: ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content) as {
        fields?: NormalizedTitleFields;
        fieldConfidence?: Record<string, number>;
        cleanedTitle?: string;
        cleanedSearchText?: string | null;
      };

      const mergedFields = mergeNormalizedFields(input.deterministic.fields, parsed.fields ?? {}, input.deterministic.fieldConfidence, parsed.fieldConfidence ?? {});
      const mergedConfidence = mergeConfidence(input.deterministic.fieldConfidence, parsed.fieldConfidence ?? {});
      const confidenceValues = Object.values(mergedConfidence);

      return {
        ...input.deterministic,
        cleanedTitle: normalizeNullableText(parsed.cleanedTitle) ?? buildCleanTitle(mergedFields),
        cleanedSearchText:
          normalizeNullableText(parsed.cleanedSearchText ?? undefined) ?? input.deterministic.cleanedSearchText,
        fields: mergedFields,
        fieldConfidence: mergedConfidence,
        confidence:
          confidenceValues.length > 0
            ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(3))
            : input.deterministic.confidence,
        usedAi: true,
        search: this.toSearchFilters(
          mergedFields,
          normalizeNullableText(parsed.cleanedSearchText ?? undefined) ?? input.deterministic.cleanedSearchText,
        ),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function titleCasePhrase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join(' ');
}

function looksLikePersonName(tokens: string[]) {
  return tokens.length >= 2 && tokens.length <= 4 && tokens.every((token) => /^[a-z.'-]+$/i.test(token));
}

function buildCleanTitle(fields: NormalizedTitleFields): string {
  return [
    fields.season ?? fields.yearManufactured ?? null,
    fields.brand ?? null,
    fields.setName ?? null,
    fields.cardNumber ? `#${fields.cardNumber}` : null,
    fields.player ?? fields.name ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function mergeNormalizedFields(
  deterministic: NormalizedTitleFields,
  refined: NormalizedTitleFields,
  deterministicConfidence: Record<string, number>,
  refinedConfidence: Record<string, number>,
) {
  const merged: NormalizedTitleFields = { ...deterministic };

  for (const [key, value] of Object.entries(refined) as Array<[keyof NormalizedTitleFields, string | number | boolean | null | undefined]>) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    const currentConfidence = deterministicConfidence[key] ?? 0;
    const nextConfidence = refinedConfidence[key] ?? 0.7;
    if (!merged[key] || nextConfidence >= currentConfidence) {
      merged[key] = value as never;
    }
  }

  return merged;
}

function mergeConfidence(
  deterministic: Record<string, number>,
  refined: Record<string, number>,
) {
  const merged = { ...deterministic };
  for (const [key, value] of Object.entries(refined)) {
    merged[key] = Math.max(merged[key] ?? 0, value);
  }
  return merged;
}
