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
