import { describe, expect, it } from "vitest";
import {
  detectSensitiveData,
  isValidPesel,
} from "../src/detectors/sensitive-data";

describe("sensitive data detectors", () => {
  it("accepts a structurally valid synthetic PESEL", () => {
    expect(isValidPesel("02070803628")).toBe(true);
    expect(detectSensitiveData("PESEL: 02070803628")).toEqual([
      {
        kind: "PESEL",
        start: 7,
        end: 18,
        value: "02070803628",
      },
    ]);
  });

  it.each(["02070803627", "02320803625", "abcdefghijk"])(
    "rejects invalid PESEL candidate %s",
    (candidate) => {
      expect(isValidPesel(candidate)).toBe(false);
    },
  );

  it("detects a practical email address", () => {
    const [detection] = detectSensitiveData("Napisz do anna.test@example.com.");

    expect(detection).toMatchObject({
      kind: "EMAIL",
      value: "anna.test@example.com",
    });
    expect(detectSensitiveData("Napisz do qa=demo@example.com.")).toContainEqual(
      expect.objectContaining({ kind: "EMAIL", value: "qa=demo@example.com" }),
    );
  });

  it("excludes an assignment label from the email range", () => {
    const text = "A email=ada.one@example.net status=422";

    expect(detectSensitiveData(text)).toEqual([
      {
        kind: "EMAIL",
        start: text.indexOf("ada.one@example.net"),
        end: text.indexOf("ada.one@example.net") + "ada.one@example.net".length,
        value: "ada.one@example.net",
      },
    ]);
  });

  it("does not classify URI credentials as email addresses", () => {
    [
      "DB failed: postgresql://tester:demo-db-P4ss@db.invalid/clinic",
      "DB failed: postgresql://tester:email=demo@db.invalid/clinic",
    ].forEach((text) => {
      expect(detectSensitiveData(text).map(({ kind }) => kind)).not.toContain(
        "EMAIL",
      );
    });
  });

  it("detects exact Bearer and URI password values as contextual secrets", () => {
    const text =
      "Authorization: Bearer demo.jwt.token-7X; " +
      "db=postgresql://tester:demo-db-P4ss@db.invalid/clinic";

    expect(detectSensitiveData(text)).toEqual([
      {
        kind: "SECRET",
        start: text.indexOf("demo.jwt.token-7X"),
        end: text.indexOf("demo.jwt.token-7X") + "demo.jwt.token-7X".length,
        value: "demo.jwt.token-7X",
      },
      {
        kind: "SECRET",
        start: text.indexOf("demo-db-P4ss"),
        end: text.indexOf("demo-db-P4ss") + "demo-db-P4ss".length,
        value: "demo-db-P4ss",
      },
    ]);
  });

  it("uses the URI password position when the same value occurs in the host", () => {
    const text = "postgresql://demo:demo@demo.invalid/clinic";
    const passwordStart = text.indexOf(":demo@") + 1;

    expect(detectSensitiveData(text)).toEqual([
      {
        kind: "SECRET",
        start: passwordStart,
        end: passwordStart + "demo".length,
        value: "demo",
      },
    ]);
  });

  it.each([
    "Authorization: Bearer",
    "Opisuje nagłówek Authorization i słowo Bearer bez wartości.",
    "postgresql://tester@db.invalid/clinic",
    "Bearer demo.jwt.token-7X",
    "X-Authorization: Bearer demo.jwt.token-7X",
  ])("does not guess a contextual secret from incomplete prose: %s", (text) => {
    expect(detectSensitiveData(text)).toEqual([]);
  });

  it("rejects masked and overlong contextual secret values", () => {
    [
      "Authorization: Bearer [SECRET_1]",
      "postgresql://tester:[SECRET_1]@db.invalid/clinic",
      `Authorization: Bearer ${"x".repeat(129)}; status=401`,
      `postgresql://tester:${"x".repeat(129)}@db.invalid/clinic`,
    ].forEach((text) => expect(detectSensitiveData(text)).toEqual([]));
  });

  it.each([
    "E-mail:anna.test@example.com",
    "notification=https://example.invalid/callback?email=anna.test@example.com",
  ])("keeps a practical email in supported surrounding text: %s", (text) => {
    expect(detectSensitiveData(text)).toContainEqual(
      expect.objectContaining({ kind: "EMAIL", value: "anna.test@example.com" }),
    );
  });

  it.each([
    ".anna@example.com",
    "anna.@example.com",
    "anna..test@example.com",
    "anna@example-.com",
  ])("rejects malformed email %s", (email) => {
    expect(detectSensitiveData(email)).toEqual([]);
  });

  it.each(["+48 500 600 700", "500-600-700", "500600700"])(
    "detects Polish phone format %s",
    (phone) => {
      expect(detectSensitiveData(`Telefon: ${phone}.`)).toContainEqual(
        expect.objectContaining({ kind: "PHONE", value: phone }),
      );
    },
  );

  it("does not extract numbers from a longer identifier", () => {
    expect(detectSensitiveData("Kod: X500600700Y")).toEqual([]);
  });

  it("does not report a PESEL fragment again as a phone", () => {
    const detections = detectSensitiveData("02070803628");

    expect(detections).toHaveLength(1);
    expect(detections[0]?.kind).toBe("PESEL");
  });

  it("returns findings in source order", () => {
    const detections = detectSensitiveData(
      "500600700 oraz anna.test@example.com oraz 02070803628",
    );

    expect(detections.map(({ kind }) => kind)).toEqual([
      "PHONE",
      "EMAIL",
      "PESEL",
    ]);
  });
});
