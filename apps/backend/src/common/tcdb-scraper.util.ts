import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import type { Element } from "domhandler";

import {
  buildNormalizedCardKey,
  buildNormalizedSetKey,
} from "./catalog-normalization.util";

export const TCDB_BASE_URL = "https://www.tcdb.com";

const CARD_NUMBER_RE = /^[A-Z]?\d{1,6}[A-Z]?$/i;
const CHECKLIST_STOPWORDS = new Set([
  "overview",
  "checklist",
  "teams",
  "errors / variations",
  "hall of famers",
  "rookies",
  "inserts and related sets",
  "comments",
  "packaging",
  "pricing",
  "sell sheets / ads",
  "trivia",
  "videos",
  "forum",
  "external links",
  "change log",
  "contributors",
  "glossary",
  "gallery",
  "card rankings",
  "collection summary",
  "options",
  "checklist by age",
  "checklist by first name",
  "checklist by last name",
  "printable view",
]);

export type TcdbSetConfig = {
  sid: number;
  slug: string;
  sport: string;
  imageSportPath: string;
};

export type TcdbOverview = {
  sport: string;
  title: string;
  season: string | null;
  yearManufactured: number | null;
  brand: string | null;
  totalCards: number;
  releaseDate: string | null;
  notes: string | null;
};

export type TcdbChecklistRow = {
  cardNumber: string;
  player: string;
  team: string | null;
  badges: string[];
  thumbnailUrls: string[];
  rowText: string;
};

export type TcdbChecklistPage = {
  pageIndex: number;
  rows: TcdbChecklistRow[];
};

export type TcdbInsertRange = {
  label: string;
  start: number;
  end: number;
};

export type TcdbSnapshotSet = {
  id: string;
  normalizedSetKey: string;
  brand: string | null;
  setName: string;
  yearManufactured: number | null;
  sport: string;
  season: string | null;
  metadata: {
    tcdb: {
      sid: number;
      slug: string;
      overviewUrl: string;
      checklistBaseUrl: string;
      releaseDate: string | null;
      totalCards: number;
      notes: string | null;
      insertRanges: TcdbInsertRange[];
    };
  };
};

export type TcdbSnapshotCard = {
  id: string;
  normalizedCardKey: string;
  cardSetId: string;
  cardNumber: string;
  name: string;
  player: string;
  variant: string | null;
  legacySetText: string;
  insertSetName: string | null;
  metadata: {
    tcdb: {
      sid: number;
      slug: string;
      checklistPageIndex: number;
      team: string | null;
      badges: string[];
      thumbnailUrls: string[];
      remoteFrontImageUrl: string;
      remoteBackImageUrl: string;
      localFrontImagePath: string | null;
      localBackImagePath: string | null;
      rowText: string;
    };
  };
};

export function buildTcdbOverviewUrl(config: TcdbSetConfig): string {
  return `${TCDB_BASE_URL}/ViewSet.cfm/sid/${config.sid}/${config.slug}`;
}

export function buildTcdbChecklistUrl(
  config: TcdbSetConfig,
  pageIndex = 1,
): string {
  const baseUrl = `${TCDB_BASE_URL}/Checklist.cfm/sid/${config.sid}/${config.slug}`;
  if (pageIndex <= 1) {
    return baseUrl;
  }

  return `${baseUrl}?PageIndex=${pageIndex}`;
}

export function buildTcdbImageUrl(
  config: TcdbSetConfig,
  cardNumber: string,
  side: "front" | "back",
): string {
  const suffix = side === "front" ? "Fr" : "Bk";
  return `${TCDB_BASE_URL}/Images/Cards/${config.imageSportPath}/${config.sid}/${config.sid}-${cardNumber}${suffix}.jpg`;
}

export function parseTcdbOverviewHtml(html: string): TcdbOverview {
  const $ = cheerio.load(html);
  const bodyText = collapseWhitespace($("body").text());
  const title =
    collapseWhitespace($("div.block1 h1 font").first().text()) ||
    collapseWhitespace($("h1 font").first().text()) ||
    collapseWhitespace($("h1").first().text());

  if (!title) {
    throw new Error("TCDB overview parse failed: title not found.");
  }

  const totalCards = Number(
    bodyText.match(/\bTotal Cards:\s*(\d+)/i)?.[1] ?? Number.NaN,
  );
  if (!Number.isFinite(totalCards)) {
    throw new Error("TCDB overview parse failed: total card count not found.");
  }

  const releaseDate =
    bodyText.match(
      /\bRelease Date:\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b/i,
    )?.[1] ?? null;

  const notesFromParagraph = collapseWhitespace(
    $("p")
      .toArray()
      .map((element) => $(element).text())
      .find((text) => /^\s*Notes:/i.test(text)) ?? "",
  ).replace(/^Notes:\s*/i, "");
  const notesFromBody =
    bodyText.match(
      /\bNotes:\s*(.+?)(?=\b(?:Checklist|Set Links|Cards|Trivia|User Comments|Videos|Forum|External Links)\b|$)/i,
    )?.[1] ?? null;
  const notes = notesFromParagraph || notesFromBody || null;

  const breadcrumbTexts = $(".breadcrumb a, nav a")
    .toArray()
    .map((element) => collapseWhitespace($(element).text()))
    .filter(Boolean);
  const sport =
    breadcrumbTexts.find((text) => {
      const normalized = text.toLowerCase();
      return (
        normalized !== "home" &&
        normalized !== "sets" &&
        normalized !== "overview" &&
        !/^\d{4}(?:-\d{2})?$/.test(normalized)
      );
    }) ?? "Unknown";

  const [seasonToken, ...brandTokens] = title.split(/\s+/).filter(Boolean);
  const season = /^\d{4}(?:-\d{2})?$/.test(seasonToken) ? seasonToken : null;
  const yearManufactured = season
    ? Number.parseInt(season.slice(0, 4), 10)
    : null;
  const brand = season ? brandTokens.join(" ") || null : title;

  return {
    sport,
    title,
    season,
    yearManufactured: Number.isFinite(yearManufactured) ? yearManufactured : null,
    brand,
    totalCards,
    releaseDate: releaseDate ? releaseDate.trim() : null,
    notes: notes ? notes.trim() : null,
  };
}

export function parseTcdbChecklistPageHtml(html: string): TcdbChecklistRow[] {
  const $ = cheerio.load(html);
  const rowElements = $("tr").toArray();
  const parsedRows = parseChecklistRows($, rowElements);

  if (parsedRows.length > 0) {
    return parsedRows;
  }

  return parseChecklistRows($, $("li, .row").toArray());
}

export function collectUniqueChecklistRows(pages: TcdbChecklistPage[]): {
  rowsByCardNumber: Map<string, TcdbChecklistRow & { checklistPageIndex: number }>;
  duplicates: string[];
} {
  const rowsByCardNumber = new Map<
    string,
    TcdbChecklistRow & { checklistPageIndex: number }
  >();
  const duplicates: string[] = [];

  for (const page of pages) {
    for (const row of page.rows) {
      const existing = rowsByCardNumber.get(row.cardNumber);
      if (!existing) {
        rowsByCardNumber.set(row.cardNumber, {
          ...row,
          checklistPageIndex: page.pageIndex,
        });
        continue;
      }

      duplicates.push(row.cardNumber);
      rowsByCardNumber.set(row.cardNumber, {
        ...existing,
        team: existing.team ?? row.team,
        badges: uniquePreservingOrder([...existing.badges, ...row.badges]),
        thumbnailUrls: uniquePreservingOrder([
          ...existing.thumbnailUrls,
          ...row.thumbnailUrls,
        ]),
        rowText:
          existing.rowText.length >= row.rowText.length
            ? existing.rowText
            : row.rowText,
      });
    }
  }

  return { rowsByCardNumber, duplicates };
}

export function parseTcdbInsertRanges(notes: string | null | undefined): TcdbInsertRange[] {
  if (!notes) {
    return [];
  }

  const ranges: TcdbInsertRange[] = [];
  let lastLabel: string | null = null;
  const rangePattern = /(?:([A-Za-z0-9][A-Za-z0-9&'\/\-. ]+?)\s+)?#(\d+)\s*-\s*(\d+)/g;

  for (const match of notes.matchAll(rangePattern)) {
    const rawLabel = collapseWhitespace(match[1] ?? "");
    const start = Number.parseInt(match[2], 10);
    const end = Number.parseInt(match[3], 10);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }

    if (rawLabel && !/distributed in one series/i.test(rawLabel)) {
      lastLabel = stripTrailingJoiners(rawLabel);
    }

    if (!lastLabel) {
      continue;
    }

    ranges.push({
      label: lastLabel,
      start,
      end,
    });
  }

  return mergeInsertRanges(ranges);
}

export function buildTcdbSetRecord(
  config: TcdbSetConfig,
  overview: TcdbOverview,
  insertRanges: TcdbInsertRange[],
): TcdbSnapshotSet {
  const normalizedSetKey = buildNormalizedSetKey({
    brand: overview.brand,
    setName: overview.title,
    legacySetText: overview.title,
    yearManufactured: overview.yearManufactured,
    sport: overview.sport,
  });

  return {
    id: createDeterministicUuid(`tcdb:set:${normalizedSetKey}`),
    normalizedSetKey,
    brand: overview.brand,
    setName: overview.title,
    yearManufactured: overview.yearManufactured,
    sport: overview.sport,
    season: overview.season,
    metadata: {
      tcdb: {
        sid: config.sid,
        slug: config.slug,
        overviewUrl: buildTcdbOverviewUrl(config),
        checklistBaseUrl: buildTcdbChecklistUrl(config),
        releaseDate: overview.releaseDate,
        totalCards: overview.totalCards,
        notes: overview.notes,
        insertRanges,
      },
    },
  };
}

export function buildTcdbCardRecord(input: {
  config: TcdbSetConfig;
  overview: TcdbOverview;
  setRecord: TcdbSnapshotSet;
  row: TcdbChecklistRow & { checklistPageIndex: number };
  insertRanges: TcdbInsertRange[];
  localFrontImagePath: string | null;
  localBackImagePath: string | null;
}): TcdbSnapshotCard {
  const rangeMatch = findInsertRange(input.insertRanges, input.row.cardNumber);
  const variant = buildVariantLabel(input.row.badges, rangeMatch !== null);
  const cardName = rangeMatch?.label ?? input.overview.title;
  const insertSetName = rangeMatch?.label ?? null;
  const normalizedCardKey = buildNormalizedCardKey({
    normalizedSetKey: input.setRecord.normalizedSetKey,
    cardNumber: input.row.cardNumber,
    name: cardName,
    player: input.row.player,
    variant,
    legacySetText: input.overview.title,
    year: input.overview.yearManufactured,
    sport: input.overview.sport,
  });

  return {
    id: createDeterministicUuid(`tcdb:card:${normalizedCardKey}`),
    normalizedCardKey,
    cardSetId: input.setRecord.id,
    cardNumber: input.row.cardNumber,
    name: cardName,
    player: input.row.player,
    variant,
    legacySetText: input.overview.title,
    insertSetName,
    metadata: {
      tcdb: {
        sid: input.config.sid,
        slug: input.config.slug,
        checklistPageIndex: input.row.checklistPageIndex,
        team: input.row.team,
        badges: input.row.badges,
        thumbnailUrls: input.row.thumbnailUrls,
        remoteFrontImageUrl: buildTcdbImageUrl(
          input.config,
          input.row.cardNumber,
          "front",
        ),
        remoteBackImageUrl: buildTcdbImageUrl(
          input.config,
          input.row.cardNumber,
          "back",
        ),
        localFrontImagePath: input.localFrontImagePath,
        localBackImagePath: input.localBackImagePath,
        rowText: input.row.rowText,
      },
    },
  };
}

export function createDeterministicUuid(seed: string): string {
  const hex = createHash("sha1").update(seed).digest("hex").slice(0, 32);
  const chars = hex.split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const joined = chars.join("");

  return [
    joined.slice(0, 8),
    joined.slice(8, 12),
    joined.slice(12, 16),
    joined.slice(16, 20),
    joined.slice(20, 32),
  ].join("-");
}

export function getChecklistSortValue(cardNumber: string): number {
  const numeric = Number.parseInt(cardNumber.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
}

function parseChecklistRows(
  $: cheerio.CheerioAPI,
  elements: Element[],
): TcdbChecklistRow[] {
  const rows: TcdbChecklistRow[] = [];

  for (const [index, element] of elements.entries()) {
    const anchorTexts = $(element)
      .find("a")
      .toArray()
      .map((anchor) => collapseWhitespace($(anchor).text()))
      .filter(Boolean);
    if (anchorTexts.length < 3) {
      continue;
    }

    const cardNumberIndex = anchorTexts.findIndex((text) =>
      CARD_NUMBER_RE.test(text),
    );
    if (cardNumberIndex === -1) {
      continue;
    }

    const meaningfulAnchors = anchorTexts
      .slice(cardNumberIndex + 1)
      .filter((text) => !isChecklistStopword(text));
    if (meaningfulAnchors.length < 2) {
      continue;
    }

    const player = meaningfulAnchors[0];
    const team =
      meaningfulAnchors.length > 0
        ? meaningfulAnchors[meaningfulAnchors.length - 1]
        : null;
    const cardNumber = anchorTexts[cardNumberIndex].toUpperCase();
    const rowText = collapseWhitespace($(element).text());
    const thumbnailUrls = uniquePreservingOrder(
      $(element)
        .find("img[src]")
        .toArray()
        .map((image) => $(image).attr("src"))
        .filter((src): src is string => Boolean(src))
        .map((src) => absolutizeTcdbUrl(src)),
    );
    const badges = extractBadgeTokens({
      cardNumber,
      player,
      team,
      rowText,
    });

    if (!player || !team) {
      continue;
    }

    rows.push({
      cardNumber,
      player,
      team,
      badges,
      thumbnailUrls,
      rowText: rowText || `row-${index}`,
    });
  }

  return rows;
}

function extractBadgeTokens(input: {
  cardNumber: string;
  player: string;
  team: string | null;
  rowText: string;
}): string[] {
  const teamText = input.team ? escapeRegExp(input.team) : "";
  const pattern = new RegExp(
    `^.*?${escapeRegExp(input.cardNumber)}\\s+${escapeRegExp(input.player)}\\s*(.*?)\\s*${
      teamText || "$"
    }`,
    "i",
  );
  const middle = collapseWhitespace(
    input.rowText.replace(pattern, "$1").replace(/^[,\s]+|[,\s]+$/g, ""),
  );
  if (!middle) {
    return [];
  }

  return middle
    .split(/[,\s]+/)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => /^[A-Z]{2,5}$/.test(token));
}

function findInsertRange(
  ranges: TcdbInsertRange[],
  cardNumber: string,
): TcdbInsertRange | null {
  const numeric = getChecklistSortValue(cardNumber);
  return ranges.find((range) => numeric >= range.start && numeric <= range.end) ?? null;
}

function buildVariantLabel(badges: string[], isInsert: boolean): string | null {
  if (badges.length > 0) {
    return badges.join(" ");
  }

  return isInsert ? null : "Base";
}

function mergeInsertRanges(ranges: TcdbInsertRange[]): TcdbInsertRange[] {
  const merged: TcdbInsertRange[] = [];

  for (const range of ranges) {
    const existing = merged.find(
      (candidate) =>
        candidate.label === range.label && candidate.end + 1 >= range.start,
    );
    if (!existing) {
      merged.push({ ...range });
      continue;
    }

    existing.end = Math.max(existing.end, range.end);
  }

  return merged.sort((left, right) => left.start - right.start);
}

function stripTrailingJoiners(value: string): string {
  return value.replace(/\b(and|or)$/i, "").trim();
}

function uniquePreservingOrder(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isChecklistStopword(value: string): boolean {
  return CHECKLIST_STOPWORDS.has(value.toLowerCase());
}

function absolutizeTcdbUrl(url: string): string {
  return new URL(url, TCDB_BASE_URL).toString();
}

function collapseWhitespace(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
