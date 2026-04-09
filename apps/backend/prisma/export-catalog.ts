// @ts-nocheck
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const targetDatabaseUrl = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
const catalogOutputPath = process.env.CATALOG_EXPORT_PATH
  ? path.resolve(process.cwd(), process.env.CATALOG_EXPORT_PATH)
  : path.join(__dirname, 'seed-data', 'catalog.json');
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: targetDatabaseUrl,
  }),
});

const DEFAULT_LOCAL_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'local',
  email: 'local@example.com',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$local$placeholder',
  pfpUrl: null,
  createdAt: '2026-04-08T12:00:00.000Z',
  updatedAt: '2026-04-08T12:05:00.000Z',
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

async function main() {
  if (!targetDatabaseUrl) {
    throw new Error('TARGET_DATABASE_URL or DATABASE_URL is required.');
  }

  const cardTableExists = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('"Card"') IS NOT NULL AS "exists"`,
  );

  if (!cardTableExists?.[0]?.exists) {
    throw new Error('Legacy "Card" table not found. This exporter only supports the pre-normalized schema.');
  }

  const cards = await prisma.$queryRawUnsafe(`
    SELECT
      id,
      name,
      "set",
      year,
      player,
      variant,
      sport,
      "imageUrl",
      "originalImageKey",
      "thumbnailImageKey",
      confidence,
      "collectionStatus",
      "gradeEstimate",
      "createdAt",
      "updatedAt"
    FROM "Card"
    ORDER BY id ASC
  `);

  const cardSets = [];
  const cardDefinitions = [];
  const userCards = [];
  const userWishlists = [];

  const setByKey = new Map();
  const definitionByKey = new Map();

  for (const card of cards) {
    const draft = deriveCatalogDraft(card);

    let cardSetId = null;
    if (draft.normalizedSetKey) {
      const existingSet = setByKey.get(draft.normalizedSetKey);
      if (existingSet) {
        cardSetId = existingSet.id;
      } else {
        cardSetId = randomUUID();
        const createdSet = {
          id: cardSetId,
          normalizedSetKey: draft.normalizedSetKey,
          brand: draft.brand,
          setName: draft.setName,
          yearManufactured: draft.yearManufactured,
          sport: draft.sport,
          season: draft.season,
          cardConditionScale: null,
          cardSize: null,
          cardThicknessPt: null,
          countryOfOrigin: null,
          language: null,
          material: null,
          metadata: null,
          createdAt: toIso(card.createdAt),
          updatedAt: toIso(card.updatedAt),
        };
        setByKey.set(draft.normalizedSetKey, createdSet);
        cardSets.push(createdSet);
      }
    }

    let definitionId = null;
    const existingDefinition = definitionByKey.get(draft.normalizedCardKey);
    if (existingDefinition) {
      definitionId = existingDefinition.id;
    } else {
      definitionId = randomUUID();
      const createdDefinition = {
        id: definitionId,
        normalizedCardKey: draft.normalizedCardKey,
        cardSetId,
        cardNumber: draft.cardNumber,
        name: normalizeNullableText(card.name) ?? 'Unknown Card',
        player: draft.player,
        variant: draft.variant,
        legacySetText: draft.legacySetText,
        category: null,
        subcategory: null,
        hasAutographVariant: false,
        features: null,
        originalOrReprint: null,
        parallelOrVariety: null,
        setType: null,
        insertSetName: null,
        cardType: null,
        isVintage: false,
        metadata: null,
        createdAt: toIso(card.createdAt),
        updatedAt: toIso(card.updatedAt),
      };
      definitionByKey.set(draft.normalizedCardKey, createdDefinition);
      cardDefinitions.push(createdDefinition);
    }

    const sharedRecord = {
      id: Number(card.id),
      userId: DEFAULT_LOCAL_USER.id,
      cardDefinitionId: definitionId,
      imageUrl: normalizeNullableText(card.imageUrl),
      originalImageKey: normalizeNullableText(card.originalImageKey),
      thumbnailImageKey: normalizeNullableText(card.thumbnailImageKey),
      gradeEstimate: normalizeNullableText(card.gradeEstimate),
      confidence: typeof card.confidence === 'number' ? card.confidence : null,
      scanJobId: null,
      createdAt: toIso(card.createdAt),
      updatedAt: toIso(card.updatedAt),
    };

    if (card.collectionStatus === 'WANTED') {
      userWishlists.push({
        ...sharedRecord,
        priority: null,
        notes: null,
      });
      continue;
    }

    userCards.push({
      ...sharedRecord,
      condition: null,
      isAutographed: false,
      autographFormat: null,
      frontImageKey: null,
      backImageKey: null,
      isForTrade: false,
      isForSale: false,
      askingPriceCents: null,
      notes: null,
    });
  }

  const payload = {
    users: [DEFAULT_LOCAL_USER],
    cardSets,
    cardDefinitions,
    userCards,
    userWishlists,
  };

  await fs.writeFile(catalogOutputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(
    `Exported ${cards.length} legacy cards to ${path.relative(process.cwd(), catalogOutputPath)}.`,
  );
}

function deriveCatalogDraft(card) {
  const setValue = normalizeNullableText(card.set);
  const yearValue = normalizeNullableNumber(card.year);
  const sportValue = normalizeNullableText(card.sport);
  const playerValue = normalizeNullableText(card.player);
  const variantValue = normalizeNullableText(card.variant);
  const brandValue = inferBrand(setValue);
  const setNameValue = setValue;
  const seasonValue = inferSeason(setValue, yearValue);
  const cardNumberValue = inferCardNumber(card.name, setValue, card.variant);
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
    name: card.name,
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
    normalizedSetKey,
    normalizedCardKey,
  };
}

function normalizeNullableText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeText(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferBrand(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const keyword = BRAND_KEYWORDS.find((item) => normalized.includes(item));
  if (!keyword) {
    return null;
  }

  return keyword
    .split(' ')
    .filter(Boolean)
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join(' ');
}

function inferSeason(setValue, year) {
  const seasonMatch = normalizeNullableText(setValue)?.match(/\b(\d{4}-\d{2})\b/);
  if (seasonMatch?.[1]) {
    return seasonMatch[1];
  }

  if (!year) {
    return null;
  }

  return null;
}

function inferCardNumber(...values) {
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
    if (standaloneMatch?.[1]) {
      return standaloneMatch[1].toUpperCase();
    }
  }

  return null;
}

function buildNormalizedSetKey(input) {
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

function buildNormalizedCardKey(input) {
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

function toIso(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
