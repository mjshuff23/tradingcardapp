import { normalizeText } from "../common/normalize.util";

export type CardTaxonomyGroup = {
  category: string;
  keywords: string[];
  subcategories: Array<{
    name: string;
    keywords: string[];
  }>;
};

export const CARD_TAXONOMY: CardTaxonomyGroup[] = [
  {
    category: "Sports",
    keywords: ["sports", "sport"],
    subcategories: [
      {
        name: "Basketball",
        keywords: ["basketball", "nba", "wnba", "bulls", "lakers"],
      },
      { name: "Football", keywords: ["football", "nfl", "super bowl"] },
      { name: "Baseball", keywords: ["baseball", "mlb"] },
      { name: "Soccer", keywords: ["soccer", "futbol", "fifa"] },
      { name: "Hockey", keywords: ["hockey", "nhl"] },
      { name: "Golf", keywords: ["golf", "pga"] },
      { name: "Racing", keywords: ["racing", "nascar", "formula 1", "f1"] },
      { name: "Wrestling", keywords: ["wrestling", "wwe", "wwf", "wcw"] },
      { name: "MMA", keywords: ["mma", "ufc", "bellator"] },
      { name: "Multi-sport", keywords: ["multi sport", "multi-sport"] },
    ],
  },
  {
    category: "Entertainment",
    keywords: ["entertainment", "celebrity"],
    subcategories: [
      {
        name: "Films",
        keywords: ["film", "films", "movie", "movies", "cinema"],
      },
      {
        name: "TV Series",
        keywords: ["tv", "television", "series", "sitcom", "show"],
      },
      { name: "Anime", keywords: ["anime", "manga"] },
      { name: "Reality", keywords: ["reality", "reality tv"] },
      { name: "Comics", keywords: ["comic", "comics", "marvel", "dc"] },
      { name: "Music", keywords: ["music", "band", "singer", "album"] },
      { name: "Other", keywords: ["entertainment other"] },
    ],
  },
  {
    category: "Gaming/TCG",
    keywords: ["game", "gaming", "tcg", "trading card game"],
    subcategories: [
      { name: "Pokemon", keywords: ["pokemon", "pikachu"] },
      {
        name: "Magic: The Gathering",
        keywords: ["magic the gathering", "mtg"],
      },
      { name: "Yu-Gi-Oh!", keywords: ["yu gi oh", "yugioh"] },
      {
        name: "Dragon Ball",
        keywords: ["dragon ball", "dragon ball z", "dbz"],
      },
      { name: "One Piece", keywords: ["one piece"] },
      { name: "Digimon", keywords: ["digimon"] },
      { name: "Lorcana", keywords: ["lorcana"] },
      { name: "Other", keywords: ["gaming other", "tcg other"] },
    ],
  },
  {
    category: "Other",
    keywords: ["other", "misc"],
    subcategories: [
      { name: "Historical", keywords: ["historical", "history"] },
      { name: "Non-sports", keywords: ["non sports", "non-sports"] },
      { name: "Miscellaneous", keywords: ["misc", "miscellaneous"] },
    ],
  },
];

export function getTaxonomyForResponse() {
  return {
    groups: CARD_TAXONOMY.map((group) => ({
      category: group.category,
      keywords: group.keywords,
      subcategories: group.subcategories.map((subcategory) => ({
        name: subcategory.name,
        keywords: subcategory.keywords,
      })),
    })),
  };
}

export function inferTaxonomyFromText(
  rawValue: string | null | undefined,
  sportValue?: string | null,
): { category: string | null; subcategory: string | null } {
  const normalized = normalizeText(rawValue);
  const normalizedSport = normalizeText(sportValue);

  if (normalizedSport) {
    const sportMatch = CARD_TAXONOMY[0].subcategories.find((subcategory) =>
      subcategory.keywords.some(
        (keyword) => normalizeText(keyword) === normalizedSport,
      ),
    );

    if (sportMatch) {
      return {
        category: "Sports",
        subcategory: sportMatch.name,
      };
    }
  }

  for (const group of CARD_TAXONOMY) {
    const subcategoryMatch = group.subcategories.find((subcategory) =>
      subcategory.keywords.some((keyword) =>
        normalized.includes(normalizeText(keyword)),
      ),
    );

    if (subcategoryMatch) {
      return {
        category: group.category,
        subcategory: subcategoryMatch.name,
      };
    }

    if (
      group.keywords.some((keyword) =>
        normalized.includes(normalizeText(keyword)),
      )
    ) {
      return {
        category: group.category,
        subcategory: null,
      };
    }
  }

  return {
    category: null,
    subcategory: null,
  };
}

export function getSubcategoriesForCategory(
  category: string | null | undefined,
): string[] {
  const match = CARD_TAXONOMY.find(
    (group) => normalizeText(group.category) === normalizeText(category),
  );

  return match
    ? match.subcategories.map((subcategory) => subcategory.name)
    : [];
}
