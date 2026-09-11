import { describe, expect, it } from "vitest";
import { createManualMaskingPlan, createMaskingPlan } from "../src/core/masking";
import { detectSensitiveData } from "../src/detectors/sensitive-data";
import { medicalBaseline } from "./fixtures/medical-baseline";
import {
  MEDICAL_CORPUS_BASE_SHA,
  MEDICAL_CORPUS_VERSION,
  medicalCases,
  type MedicalCase,
} from "./fixtures/medical-cases";
import {
  evaluateCase,
  evaluateCorpus,
  type EvaluatedDetection,
} from "./helpers/medical-evaluation";

const detectionShape = (
  medicalCase: MedicalCase,
): EvaluatedDetection[] =>
  detectSensitiveData(medicalCase.text).map(({ kind, start, end }) => ({
    kind,
    start,
    end,
  }));

const caseById = (id: string): MedicalCase => {
  const result = medicalCases.find((medicalCase) => medicalCase.id === id);
  if (!result) throw new Error(`Missing medical case: ${id}`);
  return result;
};

const detectionsByCase = (): Record<string, EvaluatedDetection[]> =>
  Object.fromEntries(
    medicalCases.map((medicalCase) => [medicalCase.id, detectionShape(medicalCase)]),
  );

describe("MED-001 medical corpus integrity", () => {
  it("contains exactly 24 uniquely identified synthetic cases", () => {
    expect(MEDICAL_CORPUS_VERSION).toBe("MED-001-v1");
    expect(MEDICAL_CORPUS_BASE_SHA).toBe(
      "65e3a1d95af8e0b3ae25cb50e742ebbde6decc9d",
    );
    expect(medicalCases).toHaveLength(24);
    expect(new Set(medicalCases.map(({ id }) => id)).size).toBe(24);
    expect(
      medicalCases.reduce(
        (total, medicalCase) => total + medicalCase.protectedSpans.length,
        0,
      ),
    ).toBe(28);
    expect(medicalCases.every(({ protectedSpans }) => Array.isArray(protectedSpans))).toBe(true);
    expect(medicalCases.every(({ mustPreserve }) => mustPreserve.length > 0)).toBe(true);
    expect(
      medicalCases
        .flatMap(({ protectedSpans }) => protectedSpans)
        .filter(
          ({ category }) => category === "SECRET" || category === "PASSWORD",
        )
        .every(({ subtype }) => Boolean(subtype)),
    ).toBe(true);
  });

  it("keeps every UTF-16 annotation exact, valid and non-overlapping", () => {
    medicalCases.forEach((medicalCase) => {
      const sorted = [...medicalCase.protectedSpans].sort(
        (left, right) => left.start - right.start,
      );
      sorted.forEach((span, index) => {
        expect(Number.isSafeInteger(span.start), medicalCase.id).toBe(true);
        expect(Number.isSafeInteger(span.end), medicalCase.id).toBe(true);
        expect(span.start, medicalCase.id).toBeGreaterThanOrEqual(0);
        expect(span.end, medicalCase.id).toBeGreaterThan(span.start);
        expect(medicalCase.text.slice(span.start, span.end), medicalCase.id).toBe(
          span.value,
        );
        if (index > 0) {
          expect(sorted[index - 1]!.end, medicalCase.id).toBeLessThanOrEqual(
            span.start,
          );
        }
      });
      medicalCase.mustPreserve.forEach(({ value }) => {
        expect(medicalCase.text, medicalCase.id).toContain(value);
      });
    });
  });

  it("matches the reviewed baseline without regenerating it", () => {
    expect(detectionsByCase()).toEqual(medicalBaseline);
  });
});

describe("medical evaluation", () => {
  const sampleCase = (protectedSpans: MedicalCase["protectedSpans"]): MedicalCase => ({
    id: "UNIT",
    title: "Independent evaluation example",
    format: "LOG",
    text: "abcdefghij",
    protectedSpans,
    mustPreserve: [],
  });

  it("counts an exact match once and treats a duplicate as a false positive", () => {
    const expected = { category: "EMAIL" as const, start: 1, end: 4, value: "bcd", reason: "test" };
    expect(
      evaluateCase(sampleCase([expected]), [
        { kind: "EMAIL", start: 1, end: 4 },
        { kind: "EMAIL", start: 1, end: 4 },
      ]),
    ).toMatchObject({ truePositive: 1, falseNegative: 0, falsePositive: 1 });
  });

  it.each([
    [[], [], { truePositive: 0, falseNegative: 0, falsePositive: 0 }],
    [[{ category: "EMAIL" as const, start: 1, end: 4, value: "bcd", reason: "test" }], [], { truePositive: 0, falseNegative: 1, falsePositive: 0 }],
    [[], [{ kind: "PHONE" as const, start: 1, end: 4 }], { truePositive: 0, falseNegative: 0, falsePositive: 1 }],
  ])("calculates empty, missed and false-positive examples", (spans, detections, counts) => {
    expect(evaluateCase(sampleCase(spans), detections)).toMatchObject(counts);
  });

  it("reports a partial range and a wrong category as both FN and FP", () => {
    const expected = { category: "EMAIL" as const, start: 1, end: 5, value: "bcde", reason: "test" };
    const partial = evaluateCase(sampleCase([expected]), [
      { kind: "EMAIL", start: 1, end: 4 },
    ]);
    const wrongCategory = evaluateCase(sampleCase([expected]), [
      { kind: "PHONE", start: 1, end: 5 },
    ]);

    expect(partial).toMatchObject({ falseNegative: 1, falsePositive: 1 });
    expect(partial.mismatches[0]?.reason).toBe("PARTIAL_RANGE");
    expect(wrongCategory).toMatchObject({ falseNegative: 1, falsePositive: 1 });
    expect(wrongCategory.mismatches[0]?.reason).toBe("WRONG_CATEGORY");
  });

  it("uses not-applicable metrics for empty denominators", () => {
    const result = evaluateCorpus([sampleCase([])], { UNIT: [] });
    expect(result.fullScope.sensitivity).toBeNull();
    expect(result.fullScope.precision).toBeNull();
  });

  it("reports the reviewed current-engine totals", () => {
    const result = evaluateCorpus(medicalCases, detectionsByCase());
    expect(result.byCategory).toEqual({
      PESEL: {
        truePositive: 2,
        falseNegative: 2,
        falsePositive: 0,
        sensitivity: 1 / 2,
        precision: 1,
      },
      EMAIL: {
        truePositive: 5,
        falseNegative: 2,
        falsePositive: 3,
        sensitivity: 5 / 7,
        precision: 5 / 8,
      },
      PHONE: {
        truePositive: 4,
        falseNegative: 0,
        falsePositive: 1,
        sensitivity: 1,
        precision: 4 / 5,
      },
      PATIENT_NAME: {
        truePositive: 1,
        falseNegative: 2,
        falsePositive: 0,
        sensitivity: 1 / 3,
        precision: 1,
      },
      PATIENT_FIRST_NAME: {
        truePositive: 0,
        falseNegative: 0,
        falsePositive: 0,
        sensitivity: null,
        precision: null,
      },
      PATIENT_LAST_NAME: {
        truePositive: 0,
        falseNegative: 0,
        falsePositive: 0,
        sensitivity: null,
        precision: null,
      },
      PATIENT_ID: {
        truePositive: 2,
        falseNegative: 0,
        falsePositive: 0,
        sensitivity: 1,
        precision: 1,
      },
      PASSWORD: {
        truePositive: 2,
        falseNegative: 0,
        falsePositive: 0,
        sensitivity: 1,
        precision: 1,
      },
      SECRET: {
        truePositive: 0,
        falseNegative: 6,
        falsePositive: 0,
        sensitivity: 0,
        precision: null,
      },
    });
    expect(result.supportedCategories).toEqual({
      truePositive: 16,
      falseNegative: 6,
      falsePositive: 4,
      sensitivity: 16 / 22,
      precision: 16 / 20,
    });
    expect(result.fullScope).toEqual({
      truePositive: 16,
      falseNegative: 12,
      falsePositive: 4,
      sensitivity: 16 / 28,
      precision: 16 / 20,
    });
    expect(result.negativeCasesWithFalsePositive).toBe(1);
    expect(result.negativeCaseCount).toBe(6);
    expect(
      result.cases.filter(({ falsePositive }) => falsePositive > 0).map(({ id }) => id),
    ).toEqual(["SEC-04", "MIX-04", "NEG-04"]);
    expect(
      result.cases.find(({ id }) => id === "MIX-04")?.mismatches,
    ).toHaveLength(2);
  });
});

describe("medical-case masking controls", () => {
  it("changes only ranges returned by the current detector", () => {
    medicalCases.forEach((medicalCase) => {
      const detections = detectSensitiveData(medicalCase.text);
      if (detections.length === 0) return;
      const plan = createMaskingPlan(medicalCase.text, detections);
      expect(plan, medicalCase.id).not.toBeNull();
      let sourceCursor = 0;
      let expectedText = "";
      plan!.edits.forEach(({ range, replacement }) => {
        expectedText += medicalCase.text.slice(sourceCursor, range.start);
        expectedText += replacement;
        sourceCursor = range.end;
      });
      expectedText += medicalCase.text.slice(sourceCursor);
      expect(plan!.text, medicalCase.id).toBe(expectedText);
    });
  });

  it.each(["MED-04", "MIX-02", "MIX-04"])(
    "keeps JSON or record structure parseable for %s",
    (id) => {
      const medicalCase = caseById(id);
      const plan = createMaskingPlan(
        medicalCase.text,
        detectSensitiveData(medicalCase.text),
      );
      expect(plan).not.toBeNull();
      medicalCase.mustPreserve.forEach(({ value }) =>
        expect(plan?.text).toContain(value),
      );
      if (medicalCase.format === "JSON") expect(() => JSON.parse(plan!.text)).not.toThrow();
    },
  );

  it("preserves multiline separators while masking the detected phone", () => {
    const medicalCase = caseById("MIX-03");
    const plan = createMaskingPlan(
      medicalCase.text,
      detectSensitiveData(medicalCase.text),
    );
    expect(plan?.text).toBe(
      "Pacjent: Łukasz Modelowy\nTelefon: [PHONE_1]\nBłąd: ERR_M-204",
    );
  });

  it.each([
    ["MED-06", "PATIENT_NAME"],
    ["SEC-03", "SECRET"],
    ["SEC-04", "SECRET"],
    ["EDGE-02", "SECRET"],
  ] as const)("supports explicit manual masking for %s", (id, category) => {
    const medicalCase = caseById(id);
    const span = medicalCase.protectedSpans.find(
      (candidate) => candidate.category === category,
    );
    expect(span).toBeDefined();
    const result = createManualMaskingPlan(medicalCase.text, span!);
    expect(result.status).toBe("READY");
    if (result.status !== "READY") return;
    expect(result.plan.text).toContain("[DANE_1]");
    medicalCase.mustPreserve.forEach(({ value }) =>
      expect(result.plan.text).toContain(value),
    );
    if (medicalCase.format === "JSON") {
      expect(() => JSON.parse(result.plan.text)).not.toThrow();
    }
  });
});
