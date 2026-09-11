import type { SensitiveDetection } from "../core/detection";

const MAX_SECRET_LENGTH = 128;
const GENERATED_PLACEHOLDER = /^\[[A-Z_]+_\d+\]$/u;
const BEARER_PATTERN = new RegExp(
  `(?:^|[^\\p{L}\\p{N}_-])Authorization[ \\t]{0,16}:[ \\t]{0,16}Bearer[ \\t]+([^\\s,;}]{1,${MAX_SECRET_LENGTH}})(?=$|[\\s,;}])`,
  "giu",
);
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

const bearerValueOffset = (match: RegExpMatchArray, value: string): number =>
  match[0].length - value.length;

const uriPasswordOffset = (match: RegExpMatchArray): number => {
  const authorityStart = match[0].indexOf("://") + 3;
  const passwordSeparator = match[0].indexOf(":", authorityStart);
  return passwordSeparator < authorityStart ? -1 : passwordSeparator + 1;
};

export const detectContextualSecrets = (
  text: string,
): SensitiveDetection[] =>
  [
    ...collectCapturedValues(text, BEARER_PATTERN, bearerValueOffset),
    ...collectCapturedValues(text, URI_PASSWORD_PATTERN, uriPasswordOffset),
  ].sort((left, right) => left.start - right.start);
