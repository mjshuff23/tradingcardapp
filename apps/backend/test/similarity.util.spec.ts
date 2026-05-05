import {
  levenshteinSimilarity,
  tokenCoverageScore,
} from "../src/common/similarity.util";

describe("similarity.util", () => {
  it("returns high similarity for close strings", () => {
    const score = levenshteinSimilarity("michael jordan", "michael jordon");
    expect(score).toBeGreaterThan(0.85);
  });

  it("computes token coverage score", () => {
    const coverage = tokenCoverageScore(
      "1993 michael jordan upper deck",
      "michael jordan upper deck",
    );
    expect(coverage).toBeCloseTo(1, 5);
  });
});
