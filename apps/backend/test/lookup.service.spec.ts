import { ConfigService } from "@nestjs/config";
import { LookupService } from "../src/lookup/lookup.service";

describe("LookupService", () => {
  function createConfigService(values: Record<string, string | undefined>) {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  it("survives a partial provider failure and returns surviving lookup hints", async () => {
    const service = new LookupService(
      createConfigService({
        LOOKUP_PROVIDERS: "google_vision,duckduckgo",
      }),
    );

    jest.spyOn(service as never, "hasGoogleCredentials").mockReturnValue(true);
    jest
      .spyOn(service as never, "lookupWithGoogleVision")
      .mockRejectedValue(new Error("vision unavailable"));
    jest.spyOn(service as never, "lookupWithDuckDuckGo").mockResolvedValue({
      corpus: "1993 upper deck michael jordan 466",
      hints: [
        {
          source: "web_lookup",
          provider: "duckduckgo",
          title: "1993 Upper Deck #466 Michael Jordan",
          url: "https://example.com/jordan",
          score: 0.58,
        },
      ],
    });

    const result = await service.lookup({
      frontBuffer: Buffer.from("front"),
      ocrText: "1993 upper deck michael jordan 466",
      hints: {
        years: [1993],
        seasons: [],
        cardNumbers: ["466"],
        brands: ["upper deck"],
        subsets: [],
      },
    });

    expect(result.hints).toHaveLength(1);
    expect(result.corpus).toContain("michael jordan");
  });
});
