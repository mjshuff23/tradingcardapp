import { StructuredCardHints } from "../common/card-hints.util";

export type StructuredHintCounts = {
  years: number;
  seasons: number;
  cardNumbers: number;
  brands: number;
  subsets: number;
};

export type ImageQualityChecks = {
  width: number;
  height: number;
  aspectRatio: number | null;
  resolutionScore: number;
  aspectScore: number;
  blurScore: number;
  exposureScore: number;
  contrastScore: number;
  ocrYieldScore: number;
  exposureMean: number | null;
  exposureStdDev: number | null;
  ocrTextLength: number;
  structuredHintCount: number;
};

export type ImageQualityDiagnostics = {
  score: number;
  reasons: string[];
  checks: ImageQualityChecks;
};

export type ScanJobDiagnostics = {
  quality: {
    front: ImageQualityDiagnostics;
    back: ImageQualityDiagnostics | null;
    overall: number;
    reasons: string[];
    checks: {
      hasBackImage: boolean;
      totalOcrTextLength: number;
      structuredHintCounts: StructuredHintCounts;
    };
  };
  ocr: {
    frontTextLength: number;
    backTextLength: number;
    structuredHintCounts: StructuredHintCounts;
    provider: string;
    usedFallback: boolean;
  };
  lookup: {
    providersUsed: string[];
    hintCount: number;
  };
  timingsMs: {
    ocr: number;
    lookup: number;
    rank: number;
    total: number;
  };
  failedStage: string | null;
};

export type ScanCandidateDiagnostics = {
  reference: {
    source: string;
    fromDefinitionId: string | null;
  };
  ranking: {
    coverage: number;
    overlap: number;
    fuzzy: number;
    yearBonus: number;
    playerBonus: number;
    playerLockBonus: number;
    setBonus: number;
    numberBonus: number;
    lookupBonus: number;
    finalScore: number;
  };
  validation: {
    validationScore: number | null;
    hintCount: number;
  };
};

export function toStructuredHintCounts(
  hints: StructuredCardHints,
): StructuredHintCounts {
  return {
    years: hints.years.length,
    seasons: hints.seasons.length,
    cardNumbers: hints.cardNumbers.length,
    brands: hints.brands.length,
    subsets: hints.subsets.length,
  };
}

export function totalStructuredHintCount(counts: StructuredHintCounts): number {
  return (
    counts.years +
    counts.seasons +
    counts.cardNumbers +
    counts.brands +
    counts.subsets
  );
}

export function hasStrongStructuredHints(counts: StructuredHintCounts): boolean {
  if (counts.cardNumbers > 0) {
    return true;
  }

  return totalStructuredHintCount(counts) >= 2;
}

export function computeImageQualityFromSignals(input: {
  width: number | null;
  height: number | null;
  blurProxy: number | null;
  exposureMean: number | null;
  exposureStdDev: number | null;
  ocrTextLength: number;
  structuredHintCount: number;
}): ImageQualityDiagnostics {
  const width = input.width ?? 0;
  const height = input.height ?? 0;
  const aspectRatio =
    width > 0 && height > 0 ? Number((width / height).toFixed(3)) : null;
  const resolutionScore = clamp01(
    width && height ? Math.min(width, height) / 900 : 0,
  );
  const aspectScore =
    aspectRatio === null ? 0 : clamp01(1 - Math.abs(aspectRatio - 0.714) / 0.25);
  const blurScore = clamp01((input.blurProxy ?? 0) / 24);
  const exposureScore = clamp01(
    input.exposureMean === null
      ? 0
      : 1 - Math.abs(input.exposureMean - 150) / 105,
  );
  const contrastScore = clamp01((input.exposureStdDev ?? 0) / 48);
  const ocrYieldScore = clamp01(
    Math.min(input.ocrTextLength, 96) / 96 +
      Math.min(input.structuredHintCount, 4) * 0.1,
  );

  const score = Number(
    (
      resolutionScore * 0.2 +
      aspectScore * 0.15 +
      blurScore * 0.25 +
      exposureScore * 0.15 +
      contrastScore * 0.05 +
      ocrYieldScore * 0.2
    ).toFixed(3),
  );

  const reasons: string[] = [];

  if (Math.min(width, height) > 0 && Math.min(width, height) < 700) {
    reasons.push("low_resolution");
  }

  if (aspectRatio !== null && Math.abs(aspectRatio - 0.714) > 0.18) {
    reasons.push("poor_framing");
  }

  if (blurScore < 0.35) {
    reasons.push("blur_or_soft_focus");
  }

  if (input.exposureMean !== null && input.exposureMean < 70) {
    reasons.push("underexposed");
  }

  if (input.exposureMean !== null && input.exposureMean > 225) {
    reasons.push("overexposed_or_glare");
  }

  if (contrastScore < 0.2) {
    reasons.push("low_contrast");
  }

  if (input.ocrTextLength < 20) {
    reasons.push("weak_ocr_yield");
  }

  if (input.structuredHintCount === 0) {
    reasons.push("no_structured_hints");
  }

  return {
    score,
    reasons,
    checks: {
      width,
      height,
      aspectRatio,
      resolutionScore: Number(resolutionScore.toFixed(3)),
      aspectScore: Number(aspectScore.toFixed(3)),
      blurScore: Number(blurScore.toFixed(3)),
      exposureScore: Number(exposureScore.toFixed(3)),
      contrastScore: Number(contrastScore.toFixed(3)),
      ocrYieldScore: Number(ocrYieldScore.toFixed(3)),
      exposureMean:
        input.exposureMean === null
          ? null
          : Number(input.exposureMean.toFixed(3)),
      exposureStdDev:
        input.exposureStdDev === null
          ? null
          : Number(input.exposureStdDev.toFixed(3)),
      ocrTextLength: input.ocrTextLength,
      structuredHintCount: input.structuredHintCount,
    },
  };
}

export function computeOverallQuality(
  front: ImageQualityDiagnostics,
  back: ImageQualityDiagnostics | null,
): number {
  if (!back) {
    return front.score;
  }

  return Number((((front.score * 0.65) + (back.score * 0.35))).toFixed(3));
}

export function computePersistedConfidence(input: {
  score: number;
  validationScore: number | null;
  overallQuality: number;
  frontTextLength: number;
  backTextLength: number;
  structuredHintCounts: StructuredHintCounts;
}): number {
  const baseConfidence =
    (input.score + (input.validationScore ?? input.score)) / 2;
  const qualityMultiplier = 0.55 + 0.45 * clamp01(input.overallQuality);
  let confidence = Number((baseConfidence * qualityMultiplier).toFixed(3));

  const totalOcrLength = input.frontTextLength + input.backTextLength;
  if (totalOcrLength < 24 && !hasStrongStructuredHints(input.structuredHintCounts)) {
    confidence = Math.min(confidence, 0.6);
  }

  return Number(confidence.toFixed(3));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}
