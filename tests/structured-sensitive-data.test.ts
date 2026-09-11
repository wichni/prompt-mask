import { describe, expect, it } from "vitest";
import type { DetectionKind } from "../src/core/detection";
import { detectSensitiveData } from "../src/detectors/sensitive-data";
import { detectStructuredSensitiveData } from "../src/detectors/structured-sensitive-data";
import { createMaskingPlan } from "../src/core/masking";

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

  it("detects the reported JSON password with the corrected e-mail boundary", () => {
    const text =
      '{"patientName":"Żaneta Próba","password":"P@ss-demo-7!Q","error":"AUTH_FAILED"}\nA email=ada.one@example.net';

    expect(detectSensitiveData(text)).toEqual([
      expectedDetection(text, "PATIENT_NAME", "Żaneta Próba"),
      expectedDetection(text, "PASSWORD", "P@ss-demo-7!Q"),
      expectedDetection(text, "EMAIL", "ada.one@example.net"),
    ]);
  });

  it("detects quoted and bare password assignments", () => {
    const text = "password=Tmp!Pass-44; password='Second-demo_8'";

    expect(detectStructuredSensitiveData(text)).toEqual([
      expectedDetection(text, "PASSWORD", "Tmp!Pass-44"),
      expectedDetection(text, "PASSWORD", "Second-demo_8"),
    ]);
  });

  it("detects only values of exact structured secret fields", () => {
    const text =
      "client_secret=demo-client-Z8x!; api_key='sk_demo_A1b2C3d4'; " +
      '{"apiToken":"json-demo-K8x"}';

    expect(detectStructuredSensitiveData(text)).toEqual([
      expectedDetection(text, "SECRET", "demo-client-Z8x!"),
      expectedDetection(text, "SECRET", "sk_demo_A1b2C3d4"),
      expectedDetection(text, "SECRET", "json-demo-K8x"),
    ]);
  });

  it("gives a complete structured secret priority over contained heuristics", () => {
    const text =
      '{"apiToken":"02070803628","client_secret":"demo@example.com"} PESEL 02070803628';

    expect(detectSensitiveData(text)).toEqual([
      expectedDetection(text, "SECRET", "02070803628"),
      expectedDetection(text, "SECRET", "demo@example.com"),
      {
        ...expectedDetection(text, "PESEL", "02070803628"),
        start: text.lastIndexOf("02070803628"),
        end: text.lastIndexOf("02070803628") + "02070803628".length,
      },
    ]);
  });

  it.each([
    "client_secret",
    "api_key",
    "apiToken",
    "clientSecret=demo-client-Z8x!",
    "apiKey=sk_demo_A1b2C3d4",
    "token=json-demo-K8x",
    "client_secret=[SECRET_1]",
    '{"apiToken":"[DANE_1]"}',
    'api_key="unterminated',
    `client_secret=${"x".repeat(129)}`,
  ])("rejects absent, aliased, masked or invalid secret fields: %s", (text) => {
    expect(detectStructuredSensitiveData(text)).toEqual([]);
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

  it.each([
    '{"password":"demo:02070803628:tail"}',
    'password="demo:02070803628:tail"',
    '{"password":"02070803628"}',
    'password="500600700"',
  ])("prefers the complete password field over contained heuristics: %s", (text) => {
    const value = text.includes("demo:")
      ? "demo:02070803628:tail"
      : text.includes("02070803628")
        ? "02070803628"
        : "500600700";

    expect(detectSensitiveData(text)).toEqual([
      expectedDetection(text, "PASSWORD", value),
    ]);
  });

  it("keeps heuristic detections outside a complete password field", () => {
    const text =
      'password="demo:02070803628:tail"; patientPesel=02070803628';

    expect(detectSensitiveData(text)).toEqual([
      expectedDetection(text, "PASSWORD", "demo:02070803628:tail"),
      {
        ...expectedDetection(text, "PESEL", "02070803628"),
        start: text.lastIndexOf("02070803628"),
        end: text.lastIndexOf("02070803628") + "02070803628".length,
      },
    ]);
  });

  it.each([
    'password="alpha beta',
    "password='alpha beta",
    'password="alpha\\beta"',
    "password='alpha\\beta'",
    'password=""',
    "password=''",
  ])("rejects incomplete or unsupported quoted assignments: %s", (text) => {
    expect(detectStructuredSensitiveData(text)).toEqual([]);
  });

  it.each([
    "password=[PASSWORD_1]",
    'password="[PASSWORD_1]"',
    '{"password":"[PASSWORD_1]"}',
    "password=[PESEL_2]",
    "password=[DANE_3]",
    "client_secret=[SECRET_1]",
  ])("does not remask an existing generated placeholder: %s", (text) => {
    expect(detectStructuredSensitiveData(text)).toEqual([]);
    expect(detectSensitiveData(text)).toEqual([]);
  });

  it("does not detect a password again after masking an assignment", () => {
    const text = "password=Tmp!Pass-44; status=401";
    const detections = detectSensitiveData(text);
    const masked = createMaskingPlan(text, detections)?.text;

    expect(detections).toEqual([
      expectedDetection(text, "PASSWORD", "Tmp!Pass-44"),
    ]);
    expect(masked).toBe("password=[PASSWORD_1]; status=401");
    expect(detectSensitiveData(masked!)).toEqual([]);
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
    expect(
      detectStructuredSensitiveData(`password="${"x".repeat(129)}"`),
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
