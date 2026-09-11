import type { DetectionKind } from "../../src/core/detection";
import type {
  MedicalCase,
  ProtectedCategory,
  ProtectedSpan,
} from "../fixtures/medical-cases";

export interface EvaluatedDetection {
  kind: DetectionKind;
  start: number;
  end: number;
}

export interface EvaluationCounts {
  truePositive: number;
  falseNegative: number;
  falsePositive: number;
}

export interface RangeMismatch {
  expectedCategory: ProtectedCategory;
  detectedCategory: DetectionKind;
  expectedStart: number;
  expectedEnd: number;
  detectedStart: number;
  detectedEnd: number;
  reason: "PARTIAL_RANGE" | "WRONG_CATEGORY";
}

export interface CaseEvaluation extends EvaluationCounts {
  id: string;
  missedCategories: ProtectedCategory[];
  mismatches: RangeMismatch[];
}

export interface MetricSummary extends EvaluationCounts {
  sensitivity: number | null;
  precision: number | null;
}

export interface CorpusEvaluation {
  cases: CaseEvaluation[];
  byCategory: Record<ProtectedCategory, MetricSummary>;
  supportedCategories: MetricSummary;
  fullScope: MetricSummary;
  negativeCasesWithFalsePositive: number;
  negativeCaseCount: number;
}

interface MatchedCase {
  truePositives: ProtectedSpan[];
  missed: ProtectedSpan[];
  falsePositives: EvaluatedDetection[];
}

const categories: ProtectedCategory[] = [
  "PESEL",
  "EMAIL",
  "PHONE",
  "PATIENT_NAME",
  "PATIENT_FIRST_NAME",
  "PATIENT_LAST_NAME",
  "PATIENT_ID",
  "PASSWORD",
  "SECRET",
];

const emptyCounts = (): EvaluationCounts => ({
  truePositive: 0,
  falseNegative: 0,
  falsePositive: 0,
});

const addCounts = (
  target: EvaluationCounts,
  source: EvaluationCounts,
): void => {
  target.truePositive += source.truePositive;
  target.falseNegative += source.falseNegative;
  target.falsePositive += source.falsePositive;
};

const toMetrics = (counts: EvaluationCounts): MetricSummary => ({
  ...counts,
  sensitivity:
    counts.truePositive + counts.falseNegative === 0
      ? null
      : counts.truePositive / (counts.truePositive + counts.falseNegative),
  precision:
    counts.truePositive + counts.falsePositive === 0
      ? null
      : counts.truePositive / (counts.truePositive + counts.falsePositive),
});

const isExactMatch = (
  expected: ProtectedSpan,
  detection: EvaluatedDetection,
): boolean =>
  expected.category === detection.kind &&
  expected.start === detection.start &&
  expected.end === detection.end;

const classifyMismatch = (
  expected: ProtectedSpan,
  detection: EvaluatedDetection,
): RangeMismatch | null => {
  const overlaps =
    expected.start < detection.end && detection.start < expected.end;
  const sameRange =
    expected.start === detection.start && expected.end === detection.end;
  if (!overlaps && !sameRange) return null;
  if (sameRange && expected.category !== detection.kind) {
    return {
      expectedCategory: expected.category,
      detectedCategory: detection.kind,
      expectedStart: expected.start,
      expectedEnd: expected.end,
      detectedStart: detection.start,
      detectedEnd: detection.end,
      reason: "WRONG_CATEGORY",
    };
  }
  if (!sameRange) {
    return {
      expectedCategory: expected.category,
      detectedCategory: detection.kind,
      expectedStart: expected.start,
      expectedEnd: expected.end,
      detectedStart: detection.start,
      detectedEnd: detection.end,
      reason: "PARTIAL_RANGE",
    };
  }
  return null;
};

const matchCase = (
  medicalCase: MedicalCase,
  detections: EvaluatedDetection[],
): MatchedCase => {
  const usedDetections = new Set<number>();
  const truePositives: ProtectedSpan[] = [];
  const missed: ProtectedSpan[] = [];

  medicalCase.protectedSpans.forEach((expected) => {
    const detectionIndex = detections.findIndex(
      (detection, index) =>
        !usedDetections.has(index) && isExactMatch(expected, detection),
    );
    if (detectionIndex < 0) missed.push(expected);
    else {
      usedDetections.add(detectionIndex);
      truePositives.push(expected);
    }
  });

  return {
    truePositives,
    missed,
    falsePositives: detections.filter(
      (_detection, index) => !usedDetections.has(index),
    ),
  };
};

const toCaseEvaluation = (
  medicalCase: MedicalCase,
  match: MatchedCase,
): CaseEvaluation => {
  const { truePositives, missed, falsePositives } = match;
  const mismatches = missed.flatMap((expected) =>
    falsePositives.flatMap((detection) => {
      const mismatch = classifyMismatch(expected, detection);
      return mismatch ? [mismatch] : [];
    }),
  );

  return {
    id: medicalCase.id,
    truePositive: truePositives.length,
    falseNegative: missed.length,
    falsePositive: falsePositives.length,
    missedCategories: missed.map(({ category }) => category),
    mismatches,
  };
};

export const evaluateCase = (
  medicalCase: MedicalCase,
  detections: EvaluatedDetection[],
): CaseEvaluation => toCaseEvaluation(medicalCase, matchCase(medicalCase, detections));

export const evaluateCorpus = (
  corpus: MedicalCase[],
  detectionsByCase: Record<string, EvaluatedDetection[]>,
): CorpusEvaluation => {
  const cases: CaseEvaluation[] = [];
  const countsByCategory = Object.fromEntries(
    categories.map((category) => [category, emptyCounts()]),
  ) as Record<ProtectedCategory, EvaluationCounts>;

  corpus.forEach((medicalCase) => {
    const detections = detectionsByCase[medicalCase.id] ?? [];
    const match = matchCase(medicalCase, detections);
    cases.push(toCaseEvaluation(medicalCase, match));
    match.truePositives.forEach(({ category }) => {
      countsByCategory[category].truePositive += 1;
    });
    match.missed.forEach(({ category }) => {
      countsByCategory[category].falseNegative += 1;
    });
    match.falsePositives.forEach(({ kind }) => {
      countsByCategory[kind].falsePositive += 1;
    });
  });

  const supportedCounts = emptyCounts();
  (
    [
      "PESEL",
      "EMAIL",
      "PHONE",
      "PATIENT_NAME",
      "PATIENT_FIRST_NAME",
      "PATIENT_LAST_NAME",
      "PATIENT_ID",
      "PASSWORD",
      "SECRET",
    ] as const
  ).forEach((category) =>
    addCounts(supportedCounts, countsByCategory[category]),
  );
  const fullCounts = emptyCounts();
  categories.forEach((category) => addCounts(fullCounts, countsByCategory[category]));
  const negativeCases = corpus.filter(
    ({ protectedSpans }) => protectedSpans.length === 0,
  );

  return {
    cases,
    byCategory: Object.fromEntries(
      categories.map((category) => [category, toMetrics(countsByCategory[category])]),
    ) as Record<ProtectedCategory, MetricSummary>,
    supportedCategories: toMetrics(supportedCounts),
    fullScope: toMetrics(fullCounts),
    negativeCasesWithFalsePositive: negativeCases.filter(
      ({ id }) => (detectionsByCase[id] ?? []).length > 0,
    ).length,
    negativeCaseCount: negativeCases.length,
  };
};
