import { describe, expect, it } from "vitest";
import { createMaskingPlan } from "../src/core/masking";
import { detectContextualPesels } from "../src/detectors/contextual-pesel-data";
import {
  detectSensitiveData,
  isValidPesel,
} from "../src/detectors/sensitive-data";

const detectionAt = (text: string, value: string, fromIndex = 0) => {
  const start = text.indexOf(value, fromIndex);
  return { kind: "PESEL" as const, start, end: start + value.length, value };
};

describe("contextual PESEL detector", () => {
  it.each([
    "pesel=02070803627",
    "PESEL = 02070803627",
    "Pesel: 02070803627",
    'pesel="02070803627"',
    "pesel='02070803627'",
    'PESEL: "02070803627"',
    "pesel=00000000000",
  ])("detects exactly 11 ASCII digits in an explicit field: %s", (text) => {
    const value = /[0-9]{11}/u.exec(text)![0];
    expect(detectContextualPesels(text)).toEqual([detectionAt(text, value)]);
  });

  it("detects case-insensitive JSON string fields and keeps UTF-16 offsets", () => {
    const text =
      '🙂 {"pesel":"02070803627","PESEL"  :\t"02323203627"}';
    const secondStart = text.indexOf("02323203627");

    expect(detectContextualPesels(text)).toEqual([
      detectionAt(text, "02070803627"),
      detectionAt(text, "02323203627", secondStart),
    ]);
  });

  it("returns two independent ranges in separate records", () => {
    const text = "pesel=02070803627\nPESEL: 02323203627";
    const secondStart = text.indexOf("02323203627");

    expect(detectContextualPesels(text)).toEqual([
      detectionAt(text, "02070803627"),
      detectionAt(text, "02323203627", secondStart),
    ]);
  });

  it.each(["", " ", ",tail", ";tail", ")tail", "]tail", "}tail"])(
    "accepts a complete bare value before terminator %j",
    (suffix) => {
      const text = `pesel=02070803627${suffix}`;
      expect(detectContextualPesels(text)).toEqual([
        detectionAt(text, "02070803627"),
      ]);
    },
  );

  it("honors the text and JSON whitespace limits", () => {
    const textAtLimit = `pesel${" ".repeat(16)}=${"\t".repeat(16)}02070803627`;
    const jsonAtLimit = `{"pesel"${" ".repeat(32)}:${"\n".repeat(32)}"02070803627"}`;

    expect(detectContextualPesels(textAtLimit)).toEqual([
      detectionAt(textAtLimit, "02070803627"),
    ]);
    expect(detectContextualPesels(jsonAtLimit)).toEqual([
      detectionAt(jsonAtLimit, "02070803627"),
    ]);
    expect(
      detectContextualPesels(`pesel${" ".repeat(17)}=02070803627`),
    ).toEqual([]);
    expect(
      detectContextualPesels(`{"pesel"${" ".repeat(33)}:"02070803627"}`),
    ).toEqual([]);
  });

  it.each([
    "02070803627",
    "02323203627",
    "pesel=0207080362",
    "pesel=020708036270",
    "pesel=02070803627x",
    "patientPesel=02070803627",
    "peselExtra=02070803627",
    "my_pesel=02070803627",
    "żpesel=02070803627",
    "pesel=[PESEL_1]",
    "pesel=null",
    "pesel=020 708 036 27",
    "pesel=020708-03627",
    "pesel=02070803627pesel=02320803622",
    'pesel="02070803627',
    "pesel='02070803627",
    'pesel="02070803627\\"',
    'pesel="02070803627x"',
    "pesel='02070803627\"",
    "pesel=\n02070803627",
    '{"pesel":02070803627}',
  ])("rejects unsupported or partial candidate: %s", (text) => {
    expect(detectContextualPesels(text)).toEqual([]);
  });

  it("does not turn an invalid unlabelled value into a PESEL detection", () => {
    expect(detectSensitiveData("02070803627")).toEqual([]);
    expect(detectSensitiveData("02323203627")).toEqual([]);
  });

  it("keeps strict PESEL validation separate and deduplicates a valid value", () => {
    const text = "PESEL: 02070803628";

    expect(isValidPesel("02070803628")).toBe(true);
    expect(isValidPesel("02320803622")).toBe(true);
    expect(isValidPesel("02070803627")).toBe(false);
    expect(isValidPesel("02323203627")).toBe(false);
    expect(detectSensitiveData(text)).toEqual([
      detectionAt(text, "02070803628"),
    ]);
  });

  it("gives complete password and secret fields priority", () => {
    const text =
      'password="pesel=02070803627;tail"; ' +
      'client_secret="pesel=02323203627;tail"';

    expect(detectSensitiveData(text).map(({ kind, value }) => ({ kind, value })))
      .toEqual([
        { kind: "PASSWORD", value: "pesel=02070803627;tail" },
        { kind: "SECRET", value: "pesel=02323203627;tail" },
      ]);
  });

  it("masks only contextual values and preserves JSON syntax", () => {
    const text =
      '{"pesel":"02070803627","error":"CHECKSUM_INVALID"}';
    const plan = createMaskingPlan(text, detectSensitiveData(text));

    expect(plan?.text).toBe(
      '{"pesel":"[PESEL_1]","error":"CHECKSUM_INVALID"}',
    );
    expect(() => JSON.parse(plan!.text)).not.toThrow();
    expect(detectSensitiveData(plan!.text)).toEqual([]);
  });

  it("masks all approved ranges without changing record separators", () => {
    const text =
      "PESEL = 02070803627; status=CHECKSUM_INVALID\n" +
      "pesel='02323203627'; status=INVALID_BIRTH_DATE";

    expect(createMaskingPlan(text, detectSensitiveData(text))?.text).toBe(
      "PESEL = [PESEL_1]; status=CHECKSUM_INVALID\n" +
        "pesel='[PESEL_2]'; status=INVALID_BIRTH_DATE",
    );
  });
});
