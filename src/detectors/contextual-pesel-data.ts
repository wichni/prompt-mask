import type { SensitiveDetection } from "../core/detection";

const PESEL_KEY_PATTERN = /pesel/giu;
const IDENTIFIER_CHARACTER = /[\p{L}\p{N}_]/u;
const ASCII_PESEL_PATTERN = /^[0-9]{11}$/u;
const TEXT_WHITESPACE = /[ \t]/u;
const JSON_WHITESPACE = /[ \t\r\n]/u;
const VALUE_TERMINATOR = /[\s,;)\]}]/u;

interface ParsedPeselValue {
  start: number;
  end: number;
  value: string;
}

const hasKeyBoundary = (text: string, start: number, end: number): boolean =>
  !IDENTIFIER_CHARACTER.test(text[start - 1] ?? "") &&
  !IDENTIFIER_CHARACTER.test(text[end] ?? "");

const skipLimitedWhitespace = (
  text: string,
  start: number,
  maximum: number,
  pattern: RegExp,
): number | null => {
  let cursor = start;
  while (cursor < text.length && pattern.test(text[cursor] ?? "")) {
    cursor += 1;
    if (cursor - start > maximum) return null;
  }
  return cursor;
};

const hasValueTerminator = (text: string, index: number): boolean =>
  index === text.length || VALUE_TERMINATOR.test(text[index] ?? "");

const readPeselValue = (
  text: string,
  start: number,
  requiredQuote?: "\"" | "'",
): ParsedPeselValue | null => {
  const quote = requiredQuote ??
    (text[start] === "\"" || text[start] === "'" ? text[start] : undefined);
  const valueStart = quote ? start + 1 : start;
  const valueEnd = valueStart + 11;
  const value = text.slice(valueStart, valueEnd);

  if (!ASCII_PESEL_PATTERN.test(value)) return null;
  if (quote) {
    if (text[valueEnd] !== quote || !hasValueTerminator(text, valueEnd + 1)) {
      return null;
    }
  } else if (!hasValueTerminator(text, valueEnd)) {
    return null;
  }
  return { start: valueStart, end: valueEnd, value };
};

const readJsonValue = (
  text: string,
  keyStart: number,
  keyEnd: number,
): ParsedPeselValue | null => {
  if (text[keyStart - 1] !== "\"" || text[keyEnd] !== "\"") return null;
  const separator = skipLimitedWhitespace(
    text,
    keyEnd + 1,
    32,
    JSON_WHITESPACE,
  );
  if (separator === null || text[separator] !== ":") return null;
  const valueStart = skipLimitedWhitespace(
    text,
    separator + 1,
    32,
    JSON_WHITESPACE,
  );
  if (valueStart === null || text[valueStart] !== "\"") return null;
  return readPeselValue(text, valueStart, "\"");
};

const readTextValue = (
  text: string,
  keyEnd: number,
): ParsedPeselValue | null => {
  const separator = skipLimitedWhitespace(text, keyEnd, 16, TEXT_WHITESPACE);
  if (
    separator === null ||
    (text[separator] !== "=" && text[separator] !== ":")
  ) {
    return null;
  }
  const valueStart = skipLimitedWhitespace(
    text,
    separator + 1,
    16,
    TEXT_WHITESPACE,
  );
  return valueStart === null ? null : readPeselValue(text, valueStart);
};

export const detectContextualPesels = (
  text: string,
): SensitiveDetection[] =>
  [...text.matchAll(PESEL_KEY_PATTERN)].flatMap((match) => {
    if (match.index === undefined) return [];
    const keyStart = match.index;
    const keyEnd = keyStart + match[0].length;
    if (!hasKeyBoundary(text, keyStart, keyEnd)) return [];
    const parsed =
      readJsonValue(text, keyStart, keyEnd) ?? readTextValue(text, keyEnd);
    return parsed ? [{ kind: "PESEL", ...parsed }] : [];
  });
