import { describe, expect, it } from "vitest";
import type { DetectionKind } from "../src/core/detection";
import { detectSensitiveData } from "../src/detectors/sensitive-data";
import { detectStructuredSensitiveData } from "../src/detectors/structured-sensitive-data";

const expectedDetection = (
  text: string,
  kind: DetectionKind,
  value: string,
) => {
  const start = text.indexOf(value);
  return { kind, start, end: start + value.length, value };
};

describe("structured sensitive-data field detector", () => {
  it("detects exact patient name fields and patientId values in JSON", () => {
    const text =
      '{"patientName":"Żaneta Próba","patientFirstName":"Iga","patientLastName":"Modelowa","patientId":"PT-Z19-44"}';

    expect(detectStructuredSensitiveData(text)).toEqual([
      expectedDetection(text, "PATIENT_NAME", "Żaneta Próba"),
      expectedDetection(text, "PATIENT_FIRST_NAME", "Iga"),
      expectedDetection(text, "PATIENT_LAST_NAME", "Modelowa"),
      expectedDetection(text, "PATIENT_ID", "PT-Z19-44"),
    ]);
  });

  it("detects quoted names and quoted or bare identifiers in assignments", () => {
    const text =
      "patientName='Łukasz Modelowy'; patientFirstName='Iga'; patientLastName=\"Modelowa\"; patientId=PAT-A7F2-009";

    expect(detectStructuredSensitiveData(text)).toEqual([
      expectedDetection(text, "PATIENT_NAME", "Łukasz Modelowy"),
      expectedDetection(text, "PATIENT_FIRST_NAME", "Iga"),
      expectedDetection(text, "PATIENT_LAST_NAME", "Modelowa"),
      expectedDetection(text, "PATIENT_ID", "PAT-A7F2-009"),
    ]);
  });

  it("detects password values without including the JSON key or quotes", () => {
    const text =
      '{"patientName":"Żaneta Próba","password":"P@ss-demo-7!Q","error":"AUTH_FAILED"}';

    expect(detectStructuredSensitiveData(text)).toEqual([
      expectedDetection(text, "PATIENT_NAME", "Żaneta Próba"),
      expectedDetection(text, "PASSWORD", "P@ss-demo-7!Q"),
    ]);
  });

  it("detects the reported JSON password without changing the current e-mail boundary", () => {
    const text =
      '{"patientName":"Żaneta Próba","password":"P@ss-demo-7!Q","error":"AUTH_FAILED"}\nA email=ada.one@example.net';

    expect(detectSensitiveData(text)).toEqual([
      expectedDetection(text, "PATIENT_NAME", "Żaneta Próba"),
      expectedDetection(text, "PASSWORD", "P@ss-demo-7!Q"),
      expectedDetection(text, "EMAIL", "email=ada.one@example.net"),
    ]);
  });

  it("detects quoted and bare password assignments", () => {
    const text = "password=Tmp!Pass-44; password='Second-demo_8'";

    expect(detectStructuredSensitiveData(text)).toEqual([
      expectedDetection(text, "PASSWORD", "Tmp!Pass-44"),
      expectedDetection(text, "PASSWORD", "Second-demo_8"),
    ]);
  });

  it("does not guess names in prose or accept ambiguous bare name values", () => {
    expect(
      detectStructuredSensitiveData(
        "Pacjentka Żaneta Próba; patientName=Jan Testowy; patientFirstName=Jan; patientLastName=Testowy",
      ),
    ).toEqual([]);
  });

  it.each([
    '{"patientName":"[DANE_1]"}',
    '{"patientName":"Jan\\nTestowy"}',
    '{"patientName":null}',
    '{"patientId":"with space"}',
    '{"password":"[PASSWORD_1]"}',
    '{"password":null}',
    "password passwd='secret' notpatientId=PT-1 patientIdExtra=PT-2",
  ])("rejects unsupported or already masked structure: %s", (text) => {
    expect(detectStructuredSensitiveData(text)).toEqual([]);
  });

  it("prefers an explicit patientId over the phone heuristic", () => {
    const text = '{"patientId":"731204589"}';

    expect(detectSensitiveData(text)).toEqual([
      expectedDetection(text, "PATIENT_ID", "731204589"),
    ]);
  });

  it("prefers an explicit password over the e-mail heuristic", () => {
    const text = '{"password":"demo@example.com"}';

    expect(detectSensitiveData(text)).toEqual([
      expectedDetection(text, "PASSWORD", "demo@example.com"),
    ]);
  });

  it("rejects overlong values instead of returning a partial range", () => {
    expect(
      detectStructuredSensitiveData(`patientId=${"A".repeat(65)}`),
    ).toEqual([]);
    expect(
      detectStructuredSensitiveData(
        `{"patientName":"${"Ż".repeat(81)}"}`,
      ),
    ).toEqual([]);
    expect(
      detectStructuredSensitiveData(`password=${"x".repeat(129)}`),
    ).toEqual([]);
  });

  it("handles many unterminated near-matches within the input limit", () => {
    const text = Array.from(
      { length: 100 },
      () => `patientName="${"A".repeat(80)}`,
    ).join(";");

    expect(text.length).toBeLessThan(12_000);
    expect(detectStructuredSensitiveData(text)).toEqual([]);
  });
});
