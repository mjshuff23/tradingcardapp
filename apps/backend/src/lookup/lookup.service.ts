import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { StructuredCardHints } from "../common/card-hints.util";
import { normalizeText, tokenize } from "../common/normalize.util";
import { SourceHint } from "../common/source-hint.type";

type LookupInput = {
  frontBuffer: Buffer;
  backBuffer?: Buffer;
  ocrText: string;
  hints: StructuredCardHints;
};

export type LookupResult = {
  corpus: string;
  hints: SourceHint[];
};

@Injectable()
export class LookupService implements OnModuleInit {
  private readonly logger = new Logger(LookupService.name);
  private visionClient: ImageAnnotatorClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.logger.log(
      `Active lookup providers: ${this.getProviders().join(", ") || "none"}`,
    );
  }

  async lookup(input: LookupInput): Promise<LookupResult> {
    const providers = this.getProviders();
    if (!providers.length) {
      return { corpus: "", hints: [] };
    }

    const chunks: LookupResult[] = [];

    for (const provider of providers) {
      try {
        if (provider === "google_vision") {
          chunks.push(await this.lookupWithGoogleVision(input));
        }

        if (provider === "duckduckgo") {
          chunks.push(await this.lookupWithDuckDuckGo(input));
        }
      } catch (error) {
        this.logger.warn(
          `Lookup provider ${provider} failed: ${(error as Error).message}`,
        );
      }
    }

    const allHints = chunks.flatMap((item) => item.hints);
    const dedupedHints = this.uniqueHints(allHints).slice(0, 8);
    const corpus = normalizeText(
      [
        ...chunks.map((item) => item.corpus),
        ...dedupedHints.map((hint) => hint.title),
      ]
        .filter(Boolean)
        .join(" "),
    );

    return {
      corpus,
      hints: dedupedHints,
    };
  }

  private getProviders(): string[] {
    const configured =
      this.configService.get<string>("LOOKUP_PROVIDERS") ?? "duckduckgo";
    const providers = new Set(
      configured
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .filter((value) => ["google_vision", "duckduckgo"].includes(value)),
    );

    providers.add("duckduckgo");

    if (this.hasGoogleCredentials()) {
      providers.add("google_vision");
    }

    return [...providers];
  }

  private async lookupWithGoogleVision(
    input: LookupInput,
  ): Promise<LookupResult> {
    if (!this.hasGoogleCredentials()) {
      return { corpus: "", hints: [] };
    }

    const client = this.getVisionClient();
    const targets = [input.frontBuffer, input.backBuffer].filter(Boolean);

    const hints: SourceHint[] = [];
    const corpusParts: string[] = [];

    for (const imageBuffer of targets) {
      const [response] = await client.webDetection({
        image: { content: imageBuffer },
      });

      const data = response.webDetection;
      if (!data) {
        continue;
      }

      const entities = (data.webEntities ?? [])
        .filter((entity) => !!entity.description)
        .slice(0, 8);

      for (const entity of entities) {
        const description = entity.description ?? "";
        const score = Number(entity.score ?? 0.2);
        corpusParts.push(description);

        hints.push({
          source: "web_lookup",
          provider: "google_vision",
          title: `Google Vision entity: ${description}`,
          url: `https://www.google.com/search?q=${encodeURIComponent(description)}`,
          score: Number((0.2 + Math.min(score, 1) * 0.8).toFixed(3)),
        });
      }

      const pages = (data.pagesWithMatchingImages ?? [])
        .filter((page) => !!page.url)
        .slice(0, 6);
      for (const page of pages) {
        const pageTitle = this.stripHtml(page.pageTitle ?? "Matching page");
        const pageUrl = page.url ?? "";
        if (!pageUrl) {
          continue;
        }

        corpusParts.push(pageTitle);
        hints.push({
          source: "web_lookup",
          provider: "google_vision",
          title: `Google Vision page: ${pageTitle}`,
          url: pageUrl,
          score: 0.55,
        });
      }
    }

    return {
      corpus: normalizeText(corpusParts.join(" ")),
      hints,
    };
  }

  private async lookupWithDuckDuckGo(
    input: LookupInput,
  ): Promise<LookupResult> {
    const query = this.buildQuery(input);
    if (!query) {
      return { corpus: "", hints: [] };
    }

    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(
        `DuckDuckGo lookup failed with status ${response.status}`,
      );
    }

    const html = await response.text();
    const matches = Array.from(
      html.matchAll(
        /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis,
      ),
    ).slice(0, 8);

    const hints: SourceHint[] = matches.map((match, index) => {
      const href = this.unwrapDuckDuckGoUrl(match[1]);
      const title = this.stripHtml(match[2]);
      const score = Number((0.6 - index * 0.04).toFixed(3));

      return {
        source: "web_lookup",
        provider: "duckduckgo",
        title,
        url: href,
        score: Math.max(0.3, score),
      };
    });

    return {
      corpus: normalizeText(hints.map((item) => item.title).join(" ")),
      hints,
    };
  }

  private buildQuery(input: LookupInput): string {
    const fromHints: string[] = [];

    if (input.hints.seasons.length) {
      fromHints.push(input.hints.seasons[0]);
    }

    if (input.hints.years.length) {
      fromHints.push(String(input.hints.years[0]));
    }

    if (input.hints.brands.length) {
      fromHints.push(input.hints.brands[0]);
    }

    if (input.hints.subsets.length) {
      fromHints.push(input.hints.subsets[0]);
    }

    if (input.hints.cardNumbers.length) {
      fromHints.push(`card ${input.hints.cardNumbers[0]}`);
    }

    const keyTokens = tokenize(input.ocrText)
      .filter((token) => token.length > 2)
      .slice(0, 8)
      .join(" ");

    return [...fromHints, keyTokens].filter(Boolean).join(" ").trim();
  }

  private hasGoogleCredentials(): boolean {
    return Boolean(
      this.configService.get<string>("GOOGLE_APPLICATION_CREDENTIALS") ||
      this.configService.get<string>("GOOGLE_CLOUD_PROJECT") ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_PROJECT,
    );
  }

  private getVisionClient(): ImageAnnotatorClient {
    if (!this.visionClient) {
      this.visionClient = new ImageAnnotatorClient();
    }

    return this.visionClient;
  }

  private stripHtml(value: string): string {
    return value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private unwrapDuckDuckGoUrl(value: string): string {
    try {
      if (value.startsWith("//duckduckgo.com/l/?")) {
        const asUrl = new URL(`https:${value}`);
        const uddg = asUrl.searchParams.get("uddg");
        if (uddg) {
          return decodeURIComponent(uddg);
        }
      }

      if (value.startsWith("/l/?")) {
        const asUrl = new URL(`https://duckduckgo.com${value}`);
        const uddg = asUrl.searchParams.get("uddg");
        if (uddg) {
          return decodeURIComponent(uddg);
        }
      }

      return value;
    } catch {
      return value;
    }
  }

  private uniqueHints(hints: SourceHint[]): SourceHint[] {
    const map = new Map<string, SourceHint>();

    for (const hint of hints) {
      const key = `${hint.provider ?? hint.source}|${hint.url}|${hint.title}`;
      const existing = map.get(key);
      if (!existing || hint.score > existing.score) {
        map.set(key, hint);
      }
    }

    return [...map.values()].sort((a, b) => b.score - a.score);
  }
}
