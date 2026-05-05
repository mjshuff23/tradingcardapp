import { tavily } from "@tavily/core";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseHTML } from "linkedom";
import {
  inferBrand,
  inferCardNumber,
  normalizeNullableText,
} from "../common/catalog-normalization.util";
import { tokenize } from "../common/normalize.util";
import { inferTaxonomyFromText } from "../catalog/card-taxonomy";
import {
  NormalizedTitleFields,
  TitleNormalizationService,
} from "../catalog/title-normalization.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfirmScanDraftDto } from "./dto/confirm-scan.dto";

type CandidateRow = {
  id: number;
  name: string;
  set: string | null;
  setName: string | null;
  legacySetText: string | null;
  brand: string | null;
  year: number | null;
  season: string | null;
  cardNumber: string | null;
  player: string | null;
  variant: string | null;
  sport: string | null;
  score: number;
  validationScore: number | null;
  scanJob: {
    id: number;
    ocrText: string | null;
  };
};

type EvidenceSource = {
  provider: string;
  query: string;
  url: string;
  title: string;
  snippet: string | null;
  score: number;
  content: string;
  rawContent: string | null;
};

type EnrichmentFields = Partial<
  Pick<
    ConfirmScanDraftDto,
    | "name"
    | "set"
    | "setName"
    | "brand"
    | "year"
    | "player"
    | "variant"
    | "sport"
    | "cardNumber"
    | "season"
    | "category"
    | "subcategory"
    | "hasAutographVariant"
    | "isVintage"
  >
>;

@Injectable()
export class ScanEnrichmentService {
  private readonly logger = new Logger(ScanEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly titleNormalizationService: TitleNormalizationService,
  ) {}

  async enrichCandidate(
    scanId: number,
    candidateId: number,
    userId: string,
    draft?: ConfirmScanDraftDto,
  ) {
    const candidate = await this.prisma.scanCandidate.findFirst({
      where: {
        id: candidateId,
        scanJobId: scanId,
        scanJob: {
          is: {
            userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        set: true,
        setName: true,
        legacySetText: true,
        brand: true,
        year: true,
        season: true,
        cardNumber: true,
        player: true,
        variant: true,
        sport: true,
        score: true,
        validationScore: true,
        scanJob: {
          select: {
            id: true,
            ocrText: true,
          },
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException("Scan candidate not found.");
    }

    const queries = this.buildQueries(candidate, draft);
    const providerOrder = this.getProviderOrder();
    const maxResults = this.getMaxResults();
    const providerHits = new Set<string>();

    let sources: EvidenceSource[] = [];

    for (const provider of providerOrder) {
      const next =
        provider === "tavily"
          ? await this.searchWithTavily(queries, candidate, maxResults)
          : await this.searchWithDuckDuckGo(queries, candidate, maxResults);

      if (next.length) {
        providerHits.add(provider);
        sources = this.mergeEvidenceSources(sources, next).slice(0, maxResults);
      }

      if (sources.length >= Math.min(4, maxResults)) {
        break;
      }
    }

    const deterministic = this.extractDeterministicFields(
      candidate,
      draft,
      sources,
    );
    const refined = await this.refineWithAiIfEnabled(
      candidate,
      deterministic,
      sources,
    );
    const fields = this.toDraftFields(candidate, refined.fields);

    return {
      fields,
      fieldConfidence: this.toDraftConfidenceMap(
        refined.fieldConfidence,
        fields,
      ),
      confidence: refined.confidence,
      usedAi: refined.usedAi,
      provider:
        providerHits.size > 1
          ? "mixed"
          : providerHits.size === 1
            ? [...providerHits][0]
            : "none",
      queries,
      sources: sources.map((source) => ({
        provider: source.provider,
        query: source.query,
        url: source.url,
        title: source.title,
        snippet: source.snippet,
        score: source.score,
      })),
      debug: {
        scanId,
        candidateId,
        sourceCount: sources.length,
        topTitles: sources.slice(0, 5).map((source) => source.title),
      },
    };
  }

  private getProviderOrder() {
    const configured =
      this.configService.get<string>(
        "CARD_METADATA_ENRICHMENT_PROVIDER_ORDER",
      ) ?? "tavily,duckduckgo";
    const requested = configured
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value === "tavily" || value === "duckduckgo");
    const providers = requested.length ? requested : ["tavily", "duckduckgo"];

    return providers.filter((provider) =>
      provider === "tavily"
        ? Boolean(this.configService.get<string>("TAVILY_API_KEY"))
        : true,
    );
  }

  private getMaxResults() {
    const raw = Number(
      this.configService.get<string>("CARD_METADATA_ENRICHMENT_MAX_RESULTS") ??
        5,
    );
    if (!Number.isFinite(raw) || raw <= 0) {
      return 5;
    }

    return Math.max(3, Math.min(8, Math.trunc(raw)));
  }

  private buildQueries(candidate: CandidateRow, draft?: ConfirmScanDraftDto) {
    const identityBits = [
      draft?.season ?? candidate.season ?? draft?.year ?? candidate.year,
      draft?.brand ?? candidate.brand,
      draft?.player ?? candidate.player,
      draft?.name ?? candidate.name,
      draft?.setName ??
        draft?.set ??
        candidate.setName ??
        candidate.legacySetText ??
        candidate.set,
      (draft?.cardNumber ?? candidate.cardNumber)
        ? `#${draft?.cardNumber ?? candidate.cardNumber}`
        : null,
      draft?.variant ?? candidate.variant,
      draft?.sport ?? candidate.sport,
      "trading card",
    ].filter(Boolean);

    const queries = [
      identityBits.join(" "),
      [
        draft?.player ?? candidate.player,
        draft?.brand ?? candidate.brand,
        draft?.setName ??
          candidate.setName ??
          candidate.legacySetText ??
          candidate.set,
        (draft?.cardNumber ?? candidate.cardNumber)
          ? `card ${draft?.cardNumber ?? candidate.cardNumber}`
          : null,
        draft?.season ?? candidate.season ?? draft?.year ?? candidate.year,
        "checklist",
      ]
        .filter(Boolean)
        .join(" "),
      [
        draft?.player ?? candidate.player,
        draft?.name ?? candidate.name,
        draft?.brand ?? candidate.brand,
        draft?.variant ?? candidate.variant,
        draft?.sport ?? candidate.sport,
      ]
        .filter(Boolean)
        .join(" "),
    ]
      .map((query) => query.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    return [...new Set(queries)];
  }

  private async searchWithTavily(
    queries: string[],
    candidate: CandidateRow,
    maxResults: number,
  ): Promise<EvidenceSource[]> {
    const apiKey = this.configService.get<string>("TAVILY_API_KEY");
    if (!apiKey) {
      return [];
    }

    const client = tavily({ apiKey });
    const merged = new Map<string, EvidenceSource>();

    for (const query of queries) {
      try {
        const response = await client.search(query, {
          topic: "general",
          searchDepth: "basic",
          maxResults,
          includeRawContent: "text",
          includeAnswer: false,
          timeout: 8000,
        });

        for (const result of response.results) {
          const scored = this.scoreEvidenceSource(candidate, query, {
            provider: "tavily",
            query,
            url: result.url,
            title: result.title,
            snippet: normalizeNullableText(result.content),
            score: result.score ?? 0,
            content: [result.title, result.content, result.rawContent]
              .filter(Boolean)
              .join("\n"),
            rawContent: result.rawContent ?? null,
          });

          const existing = merged.get(scored.url);
          if (!existing || scored.score > existing.score) {
            merged.set(scored.url, scored);
          }
        }
      } catch (error) {
        this.logger.warn(
          `Tavily search failed for "${query}": ${(error as Error).message}`,
        );
      }
    }

    const top = [...merged.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, maxResults);

    if (!top.length) {
      return [];
    }

    try {
      const extract = await client.extract(
        top.map((source) => source.url),
        {
          format: "text",
          extractDepth: "basic",
          timeout: 8000,
        },
      );
      const extractedByUrl = new Map(
        extract.results.map((result) => [result.url, result]),
      );

      return top.map((source) => {
        const extracted = extractedByUrl.get(source.url);
        if (!extracted) {
          return source;
        }

        return this.scoreEvidenceSource(candidate, source.query, {
          ...source,
          title: extracted.title ?? source.title,
          content: [source.title, source.snippet, extracted.rawContent]
            .filter(Boolean)
            .join("\n"),
          rawContent: extracted.rawContent,
        });
      });
    } catch (error) {
      this.logger.warn(`Tavily extract failed: ${(error as Error).message}`);
      return top;
    }
  }

  private async searchWithDuckDuckGo(
    queries: string[],
    candidate: CandidateRow,
    maxResults: number,
  ): Promise<EvidenceSource[]> {
    const merged = new Map<string, EvidenceSource>();

    for (const query of queries) {
      try {
        const response = await fetch(
          `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
            },
          },
        );

        if (!response.ok) {
          continue;
        }

        const html = await response.text();
        const matches = Array.from(
          html.matchAll(
            /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gis,
          ),
        ).slice(0, maxResults);

        for (const [index, match] of matches.entries()) {
          const url = this.unwrapDuckDuckGoUrl(match[1]);
          const title = this.stripHtml(match[2]);
          if (!url || !title) {
            continue;
          }

          const fetched = await this.fetchPageEvidence(url);
          const scored = this.scoreEvidenceSource(candidate, query, {
            provider: "duckduckgo",
            query,
            url,
            title: fetched?.title ?? title,
            snippet: fetched?.snippet ?? title,
            score: Math.max(0.25, 0.62 - index * 0.05),
            content: fetched?.content ?? title,
            rawContent: fetched?.rawContent ?? null,
          });

          const existing = merged.get(scored.url);
          if (!existing || scored.score > existing.score) {
            merged.set(scored.url, scored);
          }
        }
      } catch (error) {
        this.logger.warn(
          `DuckDuckGo search failed for "${query}": ${(error as Error).message}`,
        );
      }
    }

    return [...merged.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, maxResults);
  }

  private async fetchPageEvidence(url: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        },
      });

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("html")) {
        return null;
      }

      const html = await response.text();
      const title =
        this.extractMetaContent(html, "property", "og:title") ??
        this.extractTagText(html, "title") ??
        this.extractTagText(html, "h1") ??
        url;
      const description =
        this.extractMetaContent(html, "name", "description") ??
        this.extractMetaContent(html, "property", "og:description");
      const h1 = this.extractTagText(html, "h1");
      const jsonLd = Array.from(
        html.matchAll(
          /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
        ),
      )
        .map((match) => match[1])
        .join(" ");
      const { document } = parseHTML(html);
      for (const element of Array.from(
        document.querySelectorAll("script,style"),
      )) {
        element.remove();
      }
      const sanitizedHtmlWithoutScriptsAndStyles =
        document.documentElement?.outerHTML ?? html;
      const plainText = this.stripHtml(sanitizedHtmlWithoutScriptsAndStyles)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3200);

      return {
        title,
        snippet: normalizeNullableText(description ?? h1 ?? null),
        content: [title, description, h1, this.stripHtml(jsonLd), plainText]
          .filter(Boolean)
          .join("\n"),
        rawContent: plainText,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractDeterministicFields(
    candidate: CandidateRow,
    draft: ConfirmScanDraftDto | undefined,
    sources: EvidenceSource[],
  ) {
    const seeded = {
      name: normalizeNullableText(draft?.name) ?? candidate.name,
      player: normalizeNullableText(draft?.player) ?? candidate.player,
      brand: normalizeNullableText(draft?.brand) ?? candidate.brand,
      setName:
        normalizeNullableText(draft?.setName) ??
        normalizeNullableText(draft?.set) ??
        candidate.setName ??
        candidate.legacySetText ??
        candidate.set,
      yearManufactured: draft?.year ?? candidate.year ?? undefined,
      season: normalizeNullableText(draft?.season) ?? candidate.season,
      cardNumber:
        normalizeNullableText(draft?.cardNumber) ?? candidate.cardNumber,
      sport: normalizeNullableText(draft?.sport) ?? candidate.sport,
      variant: normalizeNullableText(draft?.variant) ?? candidate.variant,
      category: normalizeNullableText(draft?.category),
      subcategory: normalizeNullableText(draft?.subcategory),
      hasAutographVariant: draft?.hasAutographVariant ?? undefined,
      isVintage: draft?.isVintage ?? undefined,
    } satisfies NormalizedTitleFields;

    const condensed = [
      this.buildCandidateIdentityString(candidate, draft),
      ...sources.slice(0, 5).map((source) => source.title),
      ...sources.slice(0, 3).map((source) => source.snippet),
    ]
      .filter(Boolean)
      .join(" ");

    const deterministic = this.titleNormalizationService.parseDeterministic(
      condensed,
      seeded,
    );
    const evidenceText = [
      condensed,
      candidate.scanJob.ocrText ?? "",
      ...sources.slice(0, 5).map((source) => source.content),
    ]
      .filter(Boolean)
      .join(" ");

    if (!deterministic.fields.brand) {
      const inferredBrand = inferBrand(evidenceText);
      if (inferredBrand) {
        deterministic.fields.brand = inferredBrand;
        deterministic.fieldConfidence.brand = 0.72;
      }
    }

    if (!deterministic.fields.cardNumber) {
      const inferredCardNumber = inferCardNumber(
        normalizeNullableText(draft?.cardNumber),
        candidate.cardNumber,
        evidenceText,
      );
      if (inferredCardNumber) {
        deterministic.fields.cardNumber = inferredCardNumber;
        deterministic.fieldConfidence.cardNumber = 0.8;
      }
    }

    if (!deterministic.fields.sport && candidate.sport) {
      deterministic.fields.sport = candidate.sport;
      deterministic.fieldConfidence.sport = Math.max(
        deterministic.fieldConfidence.sport ?? 0,
        0.7,
      );
    }

    if (!deterministic.fields.category || !deterministic.fields.subcategory) {
      const taxonomy = inferTaxonomyFromText(
        evidenceText,
        deterministic.fields.sport ?? candidate.sport ?? null,
      );

      if (!deterministic.fields.category && taxonomy.category) {
        deterministic.fields.category = taxonomy.category;
        deterministic.fieldConfidence.category = 0.7;
      }

      if (!deterministic.fields.subcategory && taxonomy.subcategory) {
        deterministic.fields.subcategory = taxonomy.subcategory;
        deterministic.fieldConfidence.subcategory = 0.72;
      }
    }

    const confidenceValues = Object.values(deterministic.fieldConfidence);
    deterministic.confidence =
      confidenceValues.length > 0
        ? Number(
            (
              confidenceValues.reduce((sum, value) => sum + value, 0) /
              confidenceValues.length
            ).toFixed(3),
          )
        : deterministic.confidence;

    return deterministic;
  }

  private async refineWithAiIfEnabled(
    candidate: CandidateRow,
    deterministic: ReturnType<TitleNormalizationService["parseDeterministic"]>,
    sources: EvidenceSource[],
  ) {
    const enabled =
      this.configService.get<string>("CARD_METADATA_ENRICHMENT_ENABLED") ===
      "true";
    const model = this.configService.get<string>(
      "CARD_METADATA_ENRICHMENT_MODEL",
    );
    const apiKey = this.configService.get<string>("OPENAI_API_KEY");

    if (
      !enabled ||
      !model ||
      !apiKey ||
      deterministic.confidence >= 0.92 ||
      !sources.length
    ) {
      return deterministic;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You extract likely structured metadata for a trading card from web evidence. Return only valid JSON.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  candidate: {
                    name: candidate.name,
                    player: candidate.player,
                    brand: candidate.brand,
                    setName:
                      candidate.setName ??
                      candidate.legacySetText ??
                      candidate.set,
                    year: candidate.year,
                    season: candidate.season,
                    cardNumber: candidate.cardNumber,
                    variant: candidate.variant,
                    sport: candidate.sport,
                  },
                  deterministic: deterministic.fields,
                  evidence: sources.slice(0, 5).map((source) => ({
                    title: source.title,
                    url: source.url,
                    content: source.content.slice(0, 1800),
                  })),
                  schema:
                    'Return {"fields":{"name":string|null,"set":string|null,"setName":string|null,"brand":string|null,"year":number|null,"player":string|null,"variant":string|null,"sport":string|null,"cardNumber":string|null,"season":string|null,"category":string|null,"subcategory":string|null,"hasAutographVariant":boolean|null,"isVintage":boolean|null},"fieldConfidence":{"field":0-1}}',
                }),
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`OpenAI enrichment request failed: ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        return deterministic;
      }

      const parsed = JSON.parse(content) as {
        fields?: EnrichmentFields;
        fieldConfidence?: Record<string, number>;
      };

      const mappedFields = this.fromDraftFields(
        parsed.fields ?? {},
        deterministic.fields,
      );
      const mergedConfidence = {
        ...deterministic.fieldConfidence,
      };

      for (const [field, value] of Object.entries(
        parsed.fieldConfidence ?? {},
      )) {
        if (typeof value === "number" && Number.isFinite(value)) {
          const mappedField = field === "year" ? "yearManufactured" : field;
          mergedConfidence[mappedField] = Number(value.toFixed(3));
        }
      }

      const mergedFields = {
        ...deterministic.fields,
        ...Object.fromEntries(
          Object.entries(mappedFields).filter(
            ([, value]) => value !== null && value !== undefined,
          ),
        ),
      };

      const confidenceValues = Object.values(mergedConfidence);
      return {
        ...deterministic,
        fields: mergedFields,
        fieldConfidence: mergedConfidence,
        confidence:
          confidenceValues.length > 0
            ? Number(
                (
                  confidenceValues.reduce((sum, value) => sum + value, 0) /
                  confidenceValues.length
                ).toFixed(3),
              )
            : deterministic.confidence,
        usedAi: true,
      };
    } catch (error) {
      this.logger.warn(
        `OpenAI enrichment failed, using deterministic fallback: ${(error as Error).message}`,
      );
      return deterministic;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private toDraftFields(
    candidate: CandidateRow,
    fields: NormalizedTitleFields,
  ): EnrichmentFields {
    const setText =
      normalizeNullableText(fields.setName) ??
      candidate.setName ??
      candidate.legacySetText ??
      candidate.set;

    return {
      name: normalizeNullableText(fields.name),
      set: setText,
      setName: normalizeNullableText(fields.setName) ?? setText,
      brand: normalizeNullableText(fields.brand),
      year:
        typeof fields.yearManufactured === "number"
          ? fields.yearManufactured
          : null,
      player: normalizeNullableText(fields.player),
      variant: normalizeNullableText(fields.variant),
      sport: normalizeNullableText(fields.sport),
      cardNumber: normalizeNullableText(fields.cardNumber),
      season: normalizeNullableText(fields.season),
      category: normalizeNullableText(fields.category),
      subcategory: normalizeNullableText(fields.subcategory),
      hasAutographVariant:
        fields.hasAutographVariant === undefined
          ? null
          : Boolean(fields.hasAutographVariant),
      isVintage:
        fields.isVintage === undefined ? null : Boolean(fields.isVintage),
    };
  }

  private fromDraftFields(
    fields: EnrichmentFields,
    fallback: NormalizedTitleFields,
  ): NormalizedTitleFields {
    return {
      ...fallback,
      name: normalizeNullableText(fields.name) ?? fallback.name,
      player: normalizeNullableText(fields.player) ?? fallback.player,
      brand: normalizeNullableText(fields.brand) ?? fallback.brand,
      setName:
        normalizeNullableText(fields.setName) ??
        normalizeNullableText(fields.set) ??
        fallback.setName,
      yearManufactured: fields.year ?? fallback.yearManufactured,
      season: normalizeNullableText(fields.season) ?? fallback.season,
      cardNumber:
        normalizeNullableText(fields.cardNumber) ?? fallback.cardNumber,
      sport: normalizeNullableText(fields.sport) ?? fallback.sport,
      variant: normalizeNullableText(fields.variant) ?? fallback.variant,
      category: normalizeNullableText(fields.category) ?? fallback.category,
      subcategory:
        normalizeNullableText(fields.subcategory) ?? fallback.subcategory,
      hasAutographVariant:
        fields.hasAutographVariant === null ||
        fields.hasAutographVariant === undefined
          ? fallback.hasAutographVariant
          : Boolean(fields.hasAutographVariant),
      isVintage:
        fields.isVintage === null || fields.isVintage === undefined
          ? fallback.isVintage
          : Boolean(fields.isVintage),
    };
  }

  private toDraftConfidenceMap(
    fieldConfidence: Record<string, number>,
    fields: EnrichmentFields,
  ) {
    const mapped: Record<string, number> = {};

    for (const key of Object.keys(fields)) {
      const confidenceKey = key === "year" ? "yearManufactured" : key;
      const confidence = fieldConfidence[confidenceKey];
      if (typeof confidence === "number" && Number.isFinite(confidence)) {
        mapped[key] = confidence;
      }
    }

    return mapped;
  }

  private buildCandidateIdentityString(
    candidate: CandidateRow,
    draft?: ConfirmScanDraftDto,
  ) {
    return [
      draft?.season ?? candidate.season ?? draft?.year ?? candidate.year,
      draft?.brand ?? candidate.brand,
      draft?.player ?? candidate.player,
      draft?.name ?? candidate.name,
      draft?.setName ??
        draft?.set ??
        candidate.setName ??
        candidate.legacySetText ??
        candidate.set,
      (draft?.cardNumber ?? candidate.cardNumber)
        ? `#${draft?.cardNumber ?? candidate.cardNumber}`
        : null,
      draft?.variant ?? candidate.variant,
      draft?.sport ?? candidate.sport,
    ]
      .filter(Boolean)
      .join(" ");
  }

  private mergeEvidenceSources(
    current: EvidenceSource[],
    next: EvidenceSource[],
  ) {
    const merged = new Map(current.map((source) => [source.url, source]));

    for (const source of next) {
      const existing = merged.get(source.url);
      if (!existing || source.score > existing.score) {
        merged.set(source.url, source);
      }
    }

    return [...merged.values()].sort((left, right) => right.score - left.score);
  }

  private scoreEvidenceSource(
    candidate: CandidateRow,
    query: string,
    source: EvidenceSource,
  ): EvidenceSource {
    const identityTokens = tokenize(
      this.buildCandidateIdentityString(candidate) + " " + query,
    );
    const sourceTokens = tokenize(
      `${source.title} ${source.snippet ?? ""} ${source.content}`,
    );
    const overlap =
      identityTokens.length > 0
        ? identityTokens.filter((token) => sourceTokens.includes(token))
            .length / identityTokens.length
        : 0;

    const domainBonus = [
      "ebay.",
      "psacard.",
      "beckett.",
      "tcdb.",
      "comc.",
      "collx.app",
      "sportscardspro.",
      "cardboardconnection.",
    ].some((domain) => source.url.toLowerCase().includes(domain))
      ? 0.12
      : 0;
    const cardSignal =
      /\b(card|rookie|autograph|auto|refractor|parallel|prizm|deck|topps|panini)\b/i.test(
        `${source.title} ${source.snippet ?? ""} ${source.content}`,
      )
        ? 0.08
        : -0.04;

    return {
      ...source,
      score: Number(
        Math.max(
          0.05,
          Math.min(
            0.99,
            source.score * 0.4 + overlap * 0.45 + domainBonus + cardSignal,
          ),
        ).toFixed(3),
      ),
    };
  }

  private extractMetaContent(
    html: string,
    attribute: "name" | "property",
    value: string,
  ) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `<meta[^>]*${attribute}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "i",
    );
    return normalizeNullableText(
      this.stripHtml(html.match(pattern)?.[1] ?? ""),
    );
  }

  private extractTagText(html: string, tag: "title" | "h1") {
    const match = html.match(
      new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
    );
    return normalizeNullableText(this.stripHtml(match?.[1] ?? ""));
  }

  private stripHtml(value: string) {
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
    } catch {
      return value;
    }

    return value;
  }
}
