import fs from "node:fs";
import path from "node:path";

import {
  buildTcdbCardRecord,
  buildTcdbChecklistUrl,
  buildTcdbSetRecord,
  collectUniqueChecklistRows,
  parseTcdbChecklistPageHtml,
  parseTcdbInsertRanges,
  parseTcdbOverviewHtml,
  type TcdbChecklistPage,
  type TcdbChecklistRow,
  type TcdbSetConfig,
} from "../src/common/tcdb-scraper.util";

const FIXTURE_ROOT = path.join(__dirname, "fixtures", "tcdb");
const TEST_SET: TcdbSetConfig = {
  sid: 8524,
  slug: "2008-09-Upper-Deck",
  sport: "Basketball",
  imageSportPath: "Basketball",
};

describe("tcdb-scraper.util", () => {
  it("parses overview metadata from fixture HTML", () => {
    const html = readFixture("overview-8524.html");
    const parsed = parseTcdbOverviewHtml(html);

    expect(parsed.sport).toBe("Basketball");
    expect(parsed.title).toBe("2008-09 Upper Deck");
    expect(parsed.season).toBe("2008-09");
    expect(parsed.yearManufactured).toBe(2008);
    expect(parsed.brand).toBe("Upper Deck");
    expect(parsed.totalCards).toBe(266);
    expect(parsed.releaseDate).toBe("September 2, 2008");
    expect(parsed.notes).toContain("UD Legends #201-224");
  });

  it("parses checklist rows from fixture HTML", () => {
    const html = readFixture("checklist-page-2-8524.html");
    const rows = parseTcdbChecklistPageHtml(html);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      cardNumber: "101",
      player: "Charlie Villanueva",
      team: "Milwaukee Bucks",
    });
    expect(rows[0].thumbnailUrls[0]).toContain("8524-101Fr.jpg");
  });

  it("keeps page 1 on the base checklist URL and pages 2+ on PageIndex URLs", () => {
    expect(buildTcdbChecklistUrl(TEST_SET, 1)).toBe(
      "https://www.tcdb.com/Checklist.cfm/sid/8524/2008-09-Upper-Deck",
    );
    expect(buildTcdbChecklistUrl(TEST_SET, 2)).toBe(
      "https://www.tcdb.com/Checklist.cfm/sid/8524/2008-09-Upper-Deck?PageIndex=2",
    );
    expect(buildTcdbChecklistUrl(TEST_SET, 3)).toBe(
      "https://www.tcdb.com/Checklist.cfm/sid/8524/2008-09-Upper-Deck?PageIndex=3",
    );
  });

  it("accumulates paginated checklist pages into a 266-card map", () => {
    const overview = parseTcdbOverviewHtml(readFixture("overview-8524.html"));
    const pages = buildSmokePages();
    const aggregated = collectUniqueChecklistRows(pages);

    expect(aggregated.rowsByCardNumber.size).toBe(266);
    expect(aggregated.rowsByCardNumber.get("1")?.player).toBe("Mike Bibby");
    expect(aggregated.rowsByCardNumber.get("101")?.player).toBe(
      "Charlie Villanueva",
    );
    expect(aggregated.rowsByCardNumber.get("206")?.player).toBe(
      "Michael Jordan",
    );
    expect(aggregated.rowsByCardNumber.get("206")?.badges).toEqual(["LGD"]);
    expect(aggregated.rowsByCardNumber.get("266")?.player).toBe(
      "Joe Alexander",
    );
    expect(overview.totalCards).toBe(aggregated.rowsByCardNumber.size);
  });

  it("protects against duplicate card numbers across checklist pages", () => {
    const duplicateHtml = renderChecklistPage([
      {
        cardNumber: "101",
        player: "Charlie Villanueva",
        team: "Milwaukee Bucks",
        badges: [],
      },
      {
        cardNumber: "101",
        player: "Charlie Villanueva",
        team: "Milwaukee Bucks",
        badges: [],
      },
    ]);
    const aggregated = collectUniqueChecklistRows([
      { pageIndex: 1, rows: parseTcdbChecklistPageHtml(duplicateHtml) },
    ]);

    expect(aggregated.rowsByCardNumber.size).toBe(1);
    expect(aggregated.duplicates).toEqual(["101"]);
  });

  it("builds snapshot-style card records with insert-range metadata", () => {
    const overview = parseTcdbOverviewHtml(readFixture("overview-8524.html"));
    const insertRanges = parseTcdbInsertRanges(overview.notes);
    const setRecord = buildTcdbSetRecord(TEST_SET, overview, insertRanges);
    const jordanRow = {
      cardNumber: "206",
      player: "Michael Jordan",
      team: "Chicago Bulls",
      badges: ["LGD"],
      thumbnailUrls: [],
      rowText: "206 Michael Jordan LGD Chicago Bulls",
      checklistPageIndex: 3,
    };

    const card = buildTcdbCardRecord({
      config: TEST_SET,
      overview,
      setRecord,
      row: jordanRow,
      insertRanges,
      localFrontImagePath: "prisma/seed-assets/tcdb/Basketball/8524/8524-206Fr.jpg",
      localBackImagePath: "prisma/seed-assets/tcdb/Basketball/8524/8524-206Bk.jpg",
    });

    expect(card.name).toBe("UD Legends");
    expect(card.insertSetName).toBe("UD Legends");
    expect(card.variant).toBe("LGD");
    expect(card.metadata.tcdb.team).toBe("Chicago Bulls");
    expect(card.metadata.tcdb.localFrontImagePath).toContain("8524-206Fr.jpg");
  });
});

function readFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURE_ROOT, filename), "utf8");
}

function buildSmokePages(): TcdbChecklistPage[] {
  return [
    {
      pageIndex: 1,
      rows: parseTcdbChecklistPageHtml(
        renderChecklistPage(
          buildRows(1, 100, {
            1: { player: "Mike Bibby", team: "Atlanta Hawks" },
          }),
        ),
      ),
    },
    {
      pageIndex: 2,
      rows: parseTcdbChecklistPageHtml(
        renderChecklistPage(
          buildRows(101, 200, {
            101: { player: "Charlie Villanueva", team: "Milwaukee Bucks" },
          }),
        ),
      ),
    },
    {
      pageIndex: 3,
      rows: parseTcdbChecklistPageHtml(
        renderChecklistPage(
          buildRows(201, 266, {
            206: {
              player: "Michael Jordan",
              team: "Chicago Bulls",
              badges: ["LGD"],
            },
            266: {
              player: "Joe Alexander",
              team: "Milwaukee Bucks",
              badges: ["ROO", "RC", "SP"],
            },
          }),
        ),
      ),
    },
  ];
}

function buildRows(
  start: number,
  end: number,
  overrides: Record<number, Partial<TcdbChecklistRow>>,
): TcdbChecklistRow[] {
  const rows: TcdbChecklistRow[] = [];

  for (let cardNumber = start; cardNumber <= end; cardNumber += 1) {
    const override = overrides[cardNumber] ?? {};
    rows.push({
      cardNumber: String(cardNumber),
      player: override.player ?? `Player ${cardNumber}`,
      team: override.team ?? `Team ${Math.ceil(cardNumber / 10)}`,
      badges: override.badges ?? [],
      thumbnailUrls: override.thumbnailUrls ?? [],
      rowText:
        override.rowText ??
        `${cardNumber} ${override.player ?? `Player ${cardNumber}`} ${
          (override.badges ?? []).join(" ")
        } ${override.team ?? `Team ${Math.ceil(cardNumber / 10)}`}`.trim(),
    });
  }

  return rows;
}

function renderChecklistPage(rows: TcdbChecklistRow[]): string {
  const rowMarkup = rows
    .map((row) => {
      const badgeText = row.badges.length > 0 ? ` ${row.badges.join(", ")}` : "";
      return `
        <tr>
          <td><a href="/card/${row.cardNumber}">${row.cardNumber}</a></td>
          <td><a href="/player/${slugify(row.player)}">${row.player}</a>${badgeText}</td>
          <td><a href="/team/${slugify(row.team ?? "unknown")}">${row.team ?? "Unknown"}</a></td>
        </tr>
      `;
    })
    .join("\n");

  return `<!DOCTYPE html>
  <html lang="en">
    <body>
      <section>
        <h3>Cards</h3>
        <table>
          <tbody>
            ${rowMarkup}
          </tbody>
        </table>
      </section>
    </body>
  </html>`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
