import type { SensitiveDetection } from "../core/detection";

const MAX_SECRET_LENGTH = 128;
const GENERATED_PLACEHOLDER_PATTERN = "\\[[A-Z_]+_\\d+\\]";
const GENERATED_PLACEHOLDER = new RegExp(
  `^${GENERATED_PLACEHOLDER_PATTERN}$`,
  "u",
);
const GENERATED_PLACEHOLDER_PREFIX = new RegExp(
  `^${GENERATED_PLACEHOLDER_PATTERN}`,
  "u",
);
const BEARER_PREFIX_PATTERN =
  /(?:^|[^\p{L}\p{N}_-])Authorization[ \t]{0,16}:[ \t]{0,16}Bearer[ \t]+/giu;
const BEARER_VALUE_PATTERN = /^[a-z0-9._~+/-]+={0,}$/iu;
const BEARER_TERMINATOR = /[\s,;}\]'"\)]/u;
const URI_PASSWORD_PATTERN = new RegExp(
  `\\b[a-z][a-z0-9+.-]*:\\/\\/[^:@/\\s]{1,128}:([^@/\\s]{1,${MAX_SECRET_LENGTH}})@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?=$|[/:?#\\s])`,
  "giu",
);

const isSecretValue = (value: string): boolean =>
  value.length > 0 &&
  value.length <= MAX_SECRET_LENGTH &&
  !GENERATED_PLACEHOLDER.test(value);

const collectCapturedValues = (
  text: string,
  pattern: RegExp,
  valueOffset: (match: RegExpMatchArray, value: string) => number,
): SensitiveDetection[] =>
  [...text.matchAll(pattern)].flatMap((match) => {
    const value = match[1];
    if (match.index === undefined || !value || !isSecretValue(value)) return [];
    const offset = valueOffset(match, value);
    if (offset < 0) return [];
    const start = match.index + offset;
    return [{ kind: "SECRET", start, end: start + value.length, value }];
  });

const readBearerValue = (
  text: string,
  start: number,
): SensitiveDetection | null => {
  const placeholder = GENERATED_PLACEHOLDER_PREFIX.exec(text.slice(start))?.[0];
  if (
    placeholder &&
    (start + placeholder.length === text.length ||
      BEARER_TERMINATOR.test(text[start + placeholder.length] ?? ""))
  ) {
    return null;
  }
  let end = start;
  while (end < text.length && !BEARER_TERMINATOR.test(text[end] ?? "")) {
    end += 1;
  }
  const value = text.slice(start, end);
  if (!isSecretValue(value) || !BEARER_VALUE_PATTERN.test(value)) return null;
  return { kind: "SECRET", start, end, value };
};

const collectBearerValues = (text: string): SensitiveDetection[] =>
  [...text.matchAll(BEARER_PREFIX_PATTERN)].flatMap((match) => {
    if (match.index === undefined) return [];
    const start = match.index + match[0].length;
    const detection = readBearerValue(text, start);
    return detection ? [detection] : [];
  });

const uriPasswordOffset = (match: RegExpMatchArray): number => {
  const authorityStart = match[0].indexOf("://") + 3;
  const passwordSeparator = match[0].indexOf(":", authorityStart);
  return passwordSeparator < authorityStart ? -1 : passwordSeparator + 1;
};

export const detectContextualSecrets = (
  text: string,
): SensitiveDetection[] =>
  [
    ...collectBearerValues(text),
    ...collectCapturedValues(text, URI_PASSWORD_PATTERN, uriPasswordOffset),
  ].sort((left, right) => left.start - right.start);
