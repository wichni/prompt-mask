import { describe, expect, it } from "vitest";
import { createMaskingPlan } from "../src/core/masking";
import { detectSensitiveData } from "../src/detectors/sensitive-data";

const maskAll = (text: string): string =>
  createMaskingPlan(text, detectSensitiveData(text))?.text ?? text;

describe("MED-005 Bearer boundaries", () => {
  it.each([
    {
      name: "double-quoted curl header",
      input:
        'curl -H "Authorization: Bearer demo.jwt.token-7X" https://example.invalid',
      expected:
        'curl -H "Authorization: Bearer [SECRET_1]" https://example.invalid',
    },
    {
      name: "single-quoted curl header",
      input:
        "curl -H 'Authorization: Bearer demo.jwt.token-7X' https://example.invalid",
      expected:
        "curl -H 'Authorization: Bearer [SECRET_1]' https://example.invalid",
    },
    {
      name: "JSON string value",
      input: '{"header":"Authorization: Bearer demo.jwt.token-7X"}',
      expected: '{"header":"Authorization: Bearer [SECRET_1]"}',
    },
  ])("masks only the token in a $name", ({ input, expected }) => {
    const [detection] = detectSensitiveData(input);
    const value = "demo.jwt.token-7X";

    expect(detection).toEqual({
      kind: "SECRET",
      start: input.indexOf(value),
      end: input.indexOf(value) + value.length,
      value,
    });
    expect(maskAll(input)).toBe(expected);
    if (input.startsWith("{")) {
      expect(JSON.parse(expected)).toEqual({
        header: "Authorization: Bearer [SECRET_1]",
      });
    }
  });

  it.each([
    'curl -H "Authorization: Bearer [SECRET_1]" https://example.invalid',
    '{"header":"Authorization: Bearer [SECRET_1]"}',
    "(Authorization: Bearer [SECRET_1])",
  ])("does not remask an existing placeholder: %s", (text) => {
    expect(detectSensitiveData(text)).toEqual([]);
    expect(maskAll(text)).toBe(text);
  });

  it.each([
    {
      input: "Authorization: Bearer final-token_7",
      value: "final-token_7",
    },
    {
      input: "Authorization: Bearer line-token_8\nstatus=401",
      value: "line-token_8",
    },
    {
      input: "Authorization: Bearer field-token_9; status=401",
      value: "field-token_9",
    },
    {
      input: "Authorization: Bearer Ab9._~+/-==",
      value: "Ab9._~+/-==",
    },
  ])("preserves the terminator after $value", ({ input, value }) => {
    expect(detectSensitiveData(input)).toEqual([
      {
        kind: "SECRET",
        start: input.indexOf(value),
        end: input.indexOf(value) + value.length,
        value,
      },
    ]);
  });

  it.each([
    "Authorization: Bearer",
    "Authorization: Bearer bad%token",
    "Authorization: Bearer bad=token",
    `Authorization: Bearer ${"x".repeat(129)}; status=401`,
    "X-Authorization: Bearer demo.jwt.token-7X",
    "Bearer demo.jwt.token-7X",
  ])("rejects an incomplete or unsupported candidate: %s", (text) => {
    expect(detectSensitiveData(text)).toEqual([]);
  });
});

describe("MED-005 email assignment boundaries", () => {
  it.each([
    {
      input: "email=qa=demo@example.com status=422",
      value: "qa=demo@example.com",
      expected: "email=[EMAIL_1] status=422",
    },
    {
      input: "qa=demo@example.com",
      value: "qa=demo@example.com",
      expected: "[EMAIL_1]",
    },
    {
      input: "email=ada.one@example.net",
      value: "ada.one@example.net",
      expected: "email=[EMAIL_1]",
    },
    {
      input:
        "https://example.invalid/callback?email=qa=demo@example.com&mode=test",
      value: "qa=demo@example.com",
      expected:
        "https://example.invalid/callback?email=[EMAIL_1]&mode=test",
    },
    {
      input:
        "https://example.invalid/callback?mode=test&email=qa=demo@example.com",
      value: "qa=demo@example.com",
      expected:
        "https://example.invalid/callback?mode=test&email=[EMAIL_1]",
    },
  ])("keeps the supported context for $input", ({ input, value, expected }) => {
    expect(detectSensitiveData(input)).toEqual([
      {
        kind: "EMAIL",
        start: input.indexOf(value),
        end: input.indexOf(value) + value.length,
        value,
      },
    ]);
    expect(maskAll(input)).toBe(expected);
  });

  it("preserves a plain label and still rejects URI credentials", () => {
    const text =
      "E-mail: qa=demo@example.com postgresql://tester:qa=demo@db.invalid/clinic";

    expect(detectSensitiveData(text)).toEqual([
      {
        kind: "EMAIL",
        start: text.indexOf("qa=demo@example.com"),
        end: text.indexOf("qa=demo@example.com") + "qa=demo@example.com".length,
        value: "qa=demo@example.com",
      },
      {
        kind: "SECRET",
        start: text.indexOf("qa=demo@db.invalid"),
        end: text.indexOf("qa=demo@db.invalid") + "qa=demo".length,
        value: "qa=demo",
      },
    ]);
  });

  it("uses exact UTF-16 ranges for repeated findings", () => {
    const bearer = "demo.jwt.token-7X";
    const email = "qa=demo@example.com";
    const text =
      `🙂 Żółć Authorization: Bearer ${bearer}; ` +
      `email=${email}\nAuthorization: Bearer ${bearer}; email=${email}`;
    const detections = detectSensitiveData(text);

    expect(detections.map(({ kind, start, end, value }) => ({
      kind,
      start,
      end,
      value,
      slice: text.slice(start, end),
    }))).toEqual([
      expect.objectContaining({ kind: "SECRET", value: bearer, slice: bearer }),
      expect.objectContaining({ kind: "EMAIL", value: email, slice: email }),
      expect.objectContaining({ kind: "SECRET", value: bearer, slice: bearer }),
      expect.objectContaining({ kind: "EMAIL", value: email, slice: email }),
    ]);

    const firstOnly = createMaskingPlan(text, [detections[0]!])?.text;
    expect(firstOnly).toContain(`Authorization: Bearer ${bearer}; email=${email}`);
    expect(firstOnly).toMatch(/^🙂 Żółć Authorization: Bearer \[SECRET_1\]/u);
  });
});
