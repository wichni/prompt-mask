import { describe, expect, it } from "vitest";
import {
  createMaskedPreview,
  createMaskingPlan,
  createManualMaskingPlan,
  createPlaceholder,
  replaceDetection,
} from "../src/core/masking";
import { detectSensitiveData } from "../src/detectors/sensitive-data";

describe("masking helpers", () => {
  it("creates a redacted preview instead of returning the original", () => {
    const preview = createMaskedPreview({
      kind: "EMAIL",
      start: 0,
      end: 21,
      value: "anna.test@example.com",
    });

    expect(preview).toBe("a•••@e•••.com");
    expect(preview).not.toContain("anna.test");
  });

  it("increments placeholders already present in the draft", () => {
    expect(createPlaceholder("PHONE", "Kontakt [PHONE_1] i [PHONE_3]")).toBe(
      "[PHONE_4]",
    );
  });

  it("replaces only the exact current range", () => {
    const detection = {
      kind: "PHONE" as const,
      start: 8,
      end: 17,
      value: "500600700",
    };

    expect(replaceDetection("Telefon 500600700", detection, "[PHONE_1]")).toBe(
      "Telefon [PHONE_1]",
    );
    expect(replaceDetection("Telefon 600600700", detection, "[PHONE_1]")).toBeNull();
  });

  it("builds one plan for mixed findings without changing surrounding text", () => {
    const text = [
      "Wcześniej [EMAIL_2].",
      "🙂 anna.test@example.com | +48 500 600 700 | 02070803628!",
    ].join("\n");
    const expected = [
      "Wcześniej [EMAIL_2].",
      "🙂 [EMAIL_3] | [PHONE_1] | [PESEL_1]!",
    ].join("\n");

    expect(createMaskingPlan(text, detectSensitiveData(text))).toEqual({
      text: expected,
      caret: expected.length - 1,
      edits: [
        {
          range: { start: 24, end: 45 },
          replacement: "[EMAIL_3]",
        },
        {
          range: { start: 48, end: 63 },
          replacement: "[PHONE_1]",
        },
        {
          range: { start: 66, end: 77 },
          replacement: "[PESEL_1]",
        },
      ],
    });
  });

  it("rejects the whole plan when a range is stale or overlaps another", () => {
    const current = "500600700";
    const phone = {
      kind: "PHONE" as const,
      start: 0,
      end: 9,
      value: current,
    };
    const overlap = {
      kind: "PHONE" as const,
      start: 1,
      end: 9,
      value: current.slice(1),
    };

    expect(createMaskingPlan("600700800", [phone])).toBeNull();
    expect(createMaskingPlan(current, [phone, overlap])).toBeNull();
  });

  it("masks exactly one manual UTF-16 range and increments DANE placeholders", () => {
    const text = "🙂 Jan Testowy i [DANE_3] oraz Jan Testowy";
    const start = text.lastIndexOf("Jan Testowy");
    const result = createManualMaskingPlan(text, {
      start,
      end: start + "Jan Testowy".length,
    });

    expect(result).toEqual({
      status: "READY",
      plan: {
        text: "🙂 Jan Testowy i [DANE_3] oraz [DANE_4]",
        caret: "🙂 Jan Testowy i [DANE_3] oraz [DANE_4]".length,
        edits: [
          {
            range: { start, end: start + "Jan Testowy".length },
            replacement: "[DANE_4]",
          },
        ],
      },
    });
  });

  it("rejects empty, whitespace-only and generated-placeholder overlaps", () => {
    expect(createManualMaskingPlan("abc", { start: 1, end: 1 })).toEqual({
      status: "INVALID",
    });
    expect(createManualMaskingPlan("a \n b", { start: 1, end: 4 })).toEqual({
      status: "INVALID",
    });
    expect(
      createManualMaskingPlan("x [EMAIL_1] y", { start: 4, end: 10 }),
    ).toEqual({ status: "PLACEHOLDER_OVERLAP" });
    expect(createManualMaskingPlan("x [JSON] y", { start: 2, end: 8 })).toMatchObject({
      status: "READY",
    });
  });
});
