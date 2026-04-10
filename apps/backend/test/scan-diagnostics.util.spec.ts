import {
  computeImageQualityFromSignals,
  computePersistedConfidence,
} from "../src/scan/scan-diagnostics.util";

describe("scan-diagnostics.util", () => {
  it("produces strong quality and confidence for a clear scan with structured hints", () => {
    const quality = computeImageQualityFromSignals({
      width: 1600,
      height: 2240,
      blurProxy: 38,
      exposureMean: 148,
      exposureStdDev: 58,
      ocrTextLength: 140,
      structuredHintCount: 4,
    });

    const confidence = computePersistedConfidence({
      score: 0.91,
      validationScore: 0.86,
      overallQuality: quality.score,
      frontTextLength: 96,
      backTextLength: 44,
      structuredHintCounts: {
        years: 2,
        seasons: 1,
        cardNumbers: 1,
        brands: 1,
        subsets: 0,
      },
    });

    expect(quality.score).toBeGreaterThan(0.85);
    expect(quality.reasons).not.toContain("weak_ocr_yield");
    expect(confidence).toBeGreaterThan(0.75);
  });

  it("caps confidence for weak scans without strong structured hints", () => {
    const quality = computeImageQualityFromSignals({
      width: 420,
      height: 560,
      blurProxy: 6,
      exposureMean: 238,
      exposureStdDev: 10,
      ocrTextLength: 8,
      structuredHintCount: 0,
    });

    const confidence = computePersistedConfidence({
      score: 0.94,
      validationScore: 0.88,
      overallQuality: quality.score,
      frontTextLength: 7,
      backTextLength: 4,
      structuredHintCounts: {
        years: 0,
        seasons: 0,
        cardNumbers: 0,
        brands: 0,
        subsets: 0,
      },
    });

    expect(quality.score).toBeLessThan(0.45);
    expect(quality.reasons).toEqual(
      expect.arrayContaining([
        "low_resolution",
        "blur_or_soft_focus",
        "weak_ocr_yield",
      ]),
    );
    expect(confidence).toBeLessThanOrEqual(0.6);
  });

  it("keeps ambiguous scans in a moderate confidence band", () => {
    const quality = computeImageQualityFromSignals({
      width: 980,
      height: 1380,
      blurProxy: 18,
      exposureMean: 132,
      exposureStdDev: 31,
      ocrTextLength: 32,
      structuredHintCount: 1,
    });

    const confidence = computePersistedConfidence({
      score: 0.66,
      validationScore: 0.58,
      overallQuality: quality.score,
      frontTextLength: 24,
      backTextLength: 8,
      structuredHintCounts: {
        years: 1,
        seasons: 0,
        cardNumbers: 0,
        brands: 0,
        subsets: 0,
      },
    });

    expect(quality.score).toBeGreaterThan(0.45);
    expect(quality.score).toBeLessThan(0.8);
    expect(confidence).toBeGreaterThan(0.3);
    expect(confidence).toBeLessThan(0.65);
  });
});
