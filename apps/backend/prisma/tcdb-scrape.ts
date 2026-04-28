import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

import {
  buildTcdbCardRecord,
  buildTcdbChecklistUrl,
  buildTcdbImageUrl,
  buildTcdbOverviewUrl,
  buildTcdbSetRecord,
  collectUniqueChecklistRows,
  getChecklistSortValue,
  parseTcdbChecklistPageHtml,
  parseTcdbInsertRanges,
  parseTcdbOverviewHtml,
  type TcdbChecklistPage,
  type TcdbSetConfig,
} from "../src/common/tcdb-scraper.util";

const REQUEST_DELAY_MS = 1000;
const REQUEST_JITTER_MS = 250;
const MAX_RETRIES = 3;
const MAX_CONSECUTIVE_IMAGE_MISSES = 8;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const HTML_CHALLENGE_MARKERS = [
  "Enable JavaScript and cookies to continue",
  "cf_chl_opt",
  "<title>Just a moment...</title>",
];
const BROWSER_TIMEOUT_MS = 60_000;
const CHALLENGE_WAIT_MS = 45_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
const DEFAULT_STORAGE_STATE_FILENAME = "tcdb-storage-state.json";
const DEFAULT_BROWSER_PROFILE_DIRNAME = "tcdb-browser-profile";

const HARD_CODED_SETS: TcdbSetConfig[] = [
  {
    sid: 8524,
    slug: "2008-09-Upper-Deck",
    sport: "Basketball",
    imageSportPath: "Basketball",
  },
];

const prismaRoot = __dirname;
const backendRoot = path.resolve(prismaRoot, "..");
const snapshotOutputPath = path.join(
  prismaRoot,
  "seed-data",
  "tcdb-snapshot.json",
);
const storageStatePath = path.join(
  prismaRoot,
  "seed-data",
  DEFAULT_STORAGE_STATE_FILENAME,
);
const persistentProfilePath = path.join(
  prismaRoot,
  "seed-data",
  DEFAULT_BROWSER_PROFILE_DIRNAME,
);
const localImageRoot = path.join(prismaRoot, "seed-assets", "tcdb");

async function main() {
  const client = new BrowserTcdbClient();
  const generatedAt = new Date().toISOString();
  const sets = [];
  const cards = [];
  const warnings: string[] = [];

  await client.init();
  try {
    for (const config of HARD_CODED_SETS) {
      console.log(`Scraping TCDB set ${config.sid} (${config.slug})`);
      const overviewHtml = await client.fetchHtml(buildTcdbOverviewUrl(config));
      const overview = parseTcdbOverviewHtml(overviewHtml);
      const insertRanges = parseTcdbInsertRanges(overview.notes);
      const checklistPages: TcdbChecklistPage[] = [];

      for (
        let pageIndex = 1;
        checklistPages.length === 0 || pageIndex < 50;
        pageIndex += 1
      ) {
        const checklistUrl = buildTcdbChecklistUrl(config, pageIndex);
        const html = await client.fetchHtml(checklistUrl);
        const rows = parseTcdbChecklistPageHtml(html);

        if (rows.length === 0) {
          warnings.push(
            `Checklist page ${pageIndex} for set ${config.sid} produced no rows; stopping pagination.`,
          );
          break;
        }

        checklistPages.push({ pageIndex, rows });
        const { rowsByCardNumber } = collectUniqueChecklistRows(checklistPages);

        console.log(
          `  page ${pageIndex}: ${rows.length} rows (${rowsByCardNumber.size}/${overview.totalCards} unique)`,
        );

        if (rowsByCardNumber.size >= overview.totalCards) {
          break;
        }
      }

      const { rowsByCardNumber, duplicates } =
        collectUniqueChecklistRows(checklistPages);
      if (duplicates.length > 0) {
        warnings.push(
          `Set ${config.sid} contained duplicate checklist rows for card numbers: ${[
            ...new Set(duplicates),
          ].join(", ")}`,
        );
      }

      if (rowsByCardNumber.size !== overview.totalCards) {
        warnings.push(
          `Set ${config.sid} expected ${overview.totalCards} cards but parsed ${rowsByCardNumber.size}.`,
        );
      }

      const setRecord = buildTcdbSetRecord(config, overview, insertRanges);
      sets.push(setRecord);

      let imageAttemptsHalted = false;
      let consecutiveImageMisses = 0;
      const sortedRows = [...rowsByCardNumber.values()].sort(
        (left, right) =>
          getChecklistSortValue(left.cardNumber) -
          getChecklistSortValue(right.cardNumber),
      );

      for (const row of sortedRows) {
        let localFrontImagePath: string | null = null;
        let localBackImagePath: string | null = null;

        if (!imageAttemptsHalted) {
          const localImageDirectory = path.join(
            localImageRoot,
            config.imageSportPath,
            String(config.sid),
          );
          const frontImageResult = await downloadTcdbImage({
            client,
            config,
            cardNumber: row.cardNumber,
            side: "front",
            localDirectory: localImageDirectory,
          });
          const backImageResult = await downloadTcdbImage({
            client,
            config,
            cardNumber: row.cardNumber,
            side: "back",
            localDirectory: localImageDirectory,
          });

          localFrontImagePath = frontImageResult.relativePath;
          localBackImagePath = backImageResult.relativePath;

          if (frontImageResult.hit || backImageResult.hit) {
            consecutiveImageMisses = 0;
          } else {
            consecutiveImageMisses += 1;
            if (consecutiveImageMisses >= MAX_CONSECUTIVE_IMAGE_MISSES) {
              imageAttemptsHalted = true;
              warnings.push(
                `Halting image downloads for set ${config.sid} after ${consecutiveImageMisses} consecutive misses starting near card ${row.cardNumber}.`,
              );
            }
          }
        }

        cards.push(
          buildTcdbCardRecord({
            config,
            overview,
            setRecord,
            row,
            insertRanges,
            localFrontImagePath,
            localBackImagePath,
          }),
        );
      }
    }

    const payload = {
      generatedAt,
      source: "tcdb",
      sets,
      cards,
      warnings,
    };

    await fs.mkdir(path.dirname(snapshotOutputPath), { recursive: true });
    await fs.writeFile(
      snapshotOutputPath,
      JSON.stringify(payload, null, 2) + "\n",
      "utf8",
    );

    console.log(
      `TCDB snapshot complete: ${sets.length} sets, ${cards.length} cards -> ${path.relative(
        backendRoot,
        snapshotOutputPath,
      )}`,
    );
    if (warnings.length > 0) {
      console.warn("Warnings:");
      for (const warning of warnings) {
        console.warn(`- ${warning}`);
      }
    }
  } finally {
    await client.close();
  }
}

async function downloadTcdbImage(input: {
  client: BrowserTcdbClient;
  config: TcdbSetConfig;
  cardNumber: string;
  side: "front" | "back";
  localDirectory: string;
}): Promise<{ hit: boolean; relativePath: string | null }> {
  const suffix = input.side === "front" ? "Fr" : "Bk";
  const filename = `${input.config.sid}-${input.cardNumber}${suffix}.jpg`;
  const absolutePath = path.join(input.localDirectory, filename);
  const relativePath = toPosix(path.relative(backendRoot, absolutePath));

  try {
    await fs.access(absolutePath);
    return { hit: true, relativePath };
  } catch {
    // Fall through and fetch the image.
  }

  const buffer = await input.client.fetchImage(
    buildTcdbImageUrl(input.config, input.cardNumber, input.side),
  );
  if (!buffer) {
    return { hit: false, relativePath: null };
  }

  await fs.mkdir(input.localDirectory, { recursive: true });
  await fs.writeFile(absolutePath, buffer);

  return { hit: true, relativePath };
}

class BrowserTcdbClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private nextAllowedRequestAt = 0;
  private usingCdpConnection = false;
  private readonly headless = readBooleanEnv("TCDB_HEADLESS", false);
  private readonly slowMo = readNumberEnv(
    "TCDB_SLOW_MO_MS",
    this.headless ? 0 : 50,
  );
  private readonly cdpUrl = process.env.TCDB_CDP_URL?.trim() || null;

  async init() {
    if (this.cdpUrl) {
      await this.connectOverCdp(this.cdpUrl);
    } else {
      await fs.mkdir(persistentProfilePath, { recursive: true });
      this.context = await this.launchPersistentContext();
      this.browser = this.context.browser();
    }

    if (process.env.TCDB_COOKIE) {
      await this.context.addCookies(
        parseCookieHeader(process.env.TCDB_COOKIE).map((cookie) => ({
          ...cookie,
          url: "https://www.tcdb.com",
        })),
      );
    }

    this.page = await this.context.newPage();
  }

  async close() {
    if (this.context) {
      await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
      await this.context.storageState({ path: storageStatePath }).catch(() => {});
    }

    if (this.usingCdpConnection) {
      this.page = null;
      this.context = null;
      this.browser = null;
      return;
    }

    await this.context?.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  async fetchHtml(url: string): Promise<string> {
    const page = this.getPage();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      await this.waitTurn();

      try {
        const response = await page.goto(url, {
          timeout: BROWSER_TIMEOUT_MS,
          waitUntil: "domcontentloaded",
        });
        if (!response) {
          throw new Error(`No response for ${url}`);
        }

        const status = response.status();
        if (status >= 400 && !RETRYABLE_STATUSES.has(status)) {
          if (status === 403 && !this.headless) {
            await this.waitForManualClearance(page, url);
            const html = await this.waitForResolvedHtml(page, url);
            await this.persistStorageState();
            return html;
          }

          throw new Error(
            `HTTP ${status} for ${url}. If TCDB is still challenging the browser, try TCDB_HEADLESS=false and solve the page once.`,
          );
        }
        if (status >= 400) {
          throw new Error(`HTTP ${status} for ${url}`);
        }

        let html: string;
        try {
          html = await this.waitForResolvedHtml(page, url);
        } catch (error) {
          if (this.headless) {
            throw error;
          }

          await this.waitForManualClearance(page, url);
          html = await this.waitForResolvedHtml(page, url);
        }
        await this.persistStorageState();
        return html;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === MAX_RETRIES) {
          break;
        }

        await sleep(500 * attempt);
      }
    }

    throw lastError ?? new Error(`Unknown TCDB page fetch failure for ${url}`);
  }

  async fetchImage(url: string): Promise<Buffer | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      await this.waitTurn();

      try {
        const result = await this.getPage().evaluate(async (imageUrl) => {
          const response = await fetch(imageUrl, {
            credentials: "include",
          });
          const contentType = response.headers.get("content-type") ?? "";

          if (response.status === 404) {
            return {
              status: 404,
              contentType,
              bytes: null,
            };
          }

          if (!response.ok) {
            return {
              status: response.status,
              contentType,
              bytes: null,
            };
          }

          const bytes = Array.from(
            new Uint8Array(await response.arrayBuffer()),
          );

          return {
            status: response.status,
            contentType,
            bytes,
          };
        }, url);

        if (result.status === 404) {
          return null;
        }
        if (
          result.status >= 400 &&
          !RETRYABLE_STATUSES.has(result.status)
        ) {
          throw new Error(`HTTP ${result.status} for ${url}`);
        }
        if (result.status >= 400) {
          throw new Error(`HTTP ${result.status} for ${url}`);
        }
        if (!result.contentType.startsWith("image/") || !result.bytes) {
          return null;
        }

        return Buffer.from(result.bytes);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === MAX_RETRIES) {
          break;
        }

        await sleep(300 * attempt);
      }
    }

    if (lastError) {
      console.warn(`Image fetch failed for ${url}: ${lastError.message}`);
    }

    return null;
  }

  private getPage(): Page {
    if (!this.page) {
      throw new Error("TCDB browser page is not initialized.");
    }

    return this.page;
  }

  private async launchPersistentContext(): Promise<BrowserContext> {
    const launchOptions = {
      headless: this.headless,
      locale: "en-US",
      slowMo: this.slowMo,
      userAgent: process.env.TCDB_USER_AGENT ?? DEFAULT_USER_AGENT,
    } as const;

    const preferredChannel = process.env.TCDB_BROWSER_CHANNEL ?? "chrome";
    try {
      return await chromium.launchPersistentContext(persistentProfilePath, {
        ...launchOptions,
        channel: preferredChannel,
      });
    } catch (error) {
      console.warn(
        `Unable to launch Playwright with channel="${preferredChannel}". Falling back to bundled Chromium. ${formatErrorMessage(
          error,
        )}`,
      );
      return chromium.launchPersistentContext(persistentProfilePath, launchOptions);
    }
  }

  private async connectOverCdp(endpoint: string) {
    this.usingCdpConnection = true;
    this.browser = await chromium.connectOverCDP(endpoint);
    this.context = this.browser.contexts()[0] ?? null;

    if (!this.context) {
      throw new Error(
        `Connected to Chrome over CDP at ${endpoint}, but no default browser context was available.`,
      );
    }

    const existingPage = this.context.pages()[0];
    this.page = existingPage ?? (await this.context.newPage());
  }

  private async waitForResolvedHtml(page: Page, url: string): Promise<string> {
    const deadline = Date.now() + CHALLENGE_WAIT_MS;

    while (Date.now() < deadline) {
      const html = await page.content();
      if (!containsChallengePage(html)) {
        return html;
      }

      await page.waitForTimeout(1000);
    }

    throw new Error(
      `TCDB stayed on the challenge page for ${url}. Try running with TCDB_HEADLESS=false so the browser can complete the challenge visibly.`,
    );
  }

  private async waitForManualClearance(page: Page, url: string) {
    await page.bringToFront().catch(() => {});
    console.warn(
      `TCDB blocked ${url}. Complete any visible tcdb.com challenge in the browser window, then press Enter here to continue.`,
    );
    await promptForEnter("Press Enter after tcdb.com is cleared");
  }

  private async persistStorageState() {
    if (!this.context) {
      return;
    }

    await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
    await this.context.storageState({ path: storageStatePath }).catch(() => {});
  }

  private async waitTurn() {
    const now = Date.now();
    const waitMs = Math.max(this.nextAllowedRequestAt - now, 0);
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    this.nextAllowedRequestAt =
      Date.now() +
      REQUEST_DELAY_MS +
      Math.floor(Math.random() * REQUEST_JITTER_MS);
  }
}

function containsChallengePage(html: string): boolean {
  return HTML_CHALLENGE_MARKERS.some((marker) => html.includes(marker));
}

function parseCookieHeader(headerValue: string): Array<{
  name: string;
  value: string;
}> {
  return headerValue
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) {
        return null;
      }

      return {
        name: pair.slice(0, separatorIndex).trim(),
        value: pair.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((cookie): cookie is { name: string; value: string } =>
      Boolean(cookie?.name),
    );
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function promptForEnter(message: string) {
  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(`${message}\n`);
  } finally {
    rl.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
