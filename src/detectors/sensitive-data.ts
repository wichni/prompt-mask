import {
  overlaps,
  type DetectionKind,
  type SensitiveDetection,
} from "../core/detection";
import { detectStructuredSensitiveData } from "./structured-sensitive-data";
import { detectContextualSecrets } from "./contextual-secret-data";

const EMAIL_PATTERN = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/giu;
const PESEL_PATTERN = /\d{11}/gu;
const PHONE_PATTERN = /(?:\+48[ -]?)?[1-9](?:[ -]?\d){8}/gu;
const TOKEN_BOUNDARY = /[\p{L}\p{N}+_@-]/u;
// A match after `scheme://user:` is URI credential data, not an e-mail.
const URI_PASSWORD_PREFIX = /[a-z][a-z0-9+.-]*:\/\/[^\s/@]*:$/iu;
const URI_SCHEME_PREFIX = /[a-z][a-z0-9+.-]*:$/iu;

const isBounded = (text: string, start: number, end: number): boolean =>
  !TOKEN_BOUNDARY.test(text[start - 1] ?? "") &&
  !TOKEN_BOUNDARY.test(text[end] ?? "");

const isEmailBounded = (text: string, start: number, end: number): boolean =>
  !/[\p{L}\p{N}.+_@-]/u.test(text[start - 1] ?? "") &&
  !TOKEN_BOUNDARY.test(text[end] ?? "");

const isUriUserInfoCandidate = (
  text: string,
  start: number,
  candidate: string,
  valueOffset: number,
): boolean =>
  URI_PASSWORD_PREFIX.test(text.slice(0, start)) ||
  (valueOffset === 0 &&
    candidate.startsWith("//") &&
    URI_SCHEME_PREFIX.test(text.slice(0, start)));

const emailValueOffset = (candidate: string): number => {
  const assignment = /(?:^|[?&])email=/iu.exec(candidate);
  return assignment ? assignment.index + assignment[0].length : 0;
};

const isValidDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const decodePeselDate = (
  value: string,
): { year: number; month: number; day: number } | null => {
  const shortYear = Number(value.slice(0, 2));
  const encodedMonth = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const centuries = [
    { from: 1, to: 12, year: 1900, offset: 0 },
    { from: 21, to: 32, year: 2000, offset: 20 },
    { from: 41, to: 52, year: 2100, offset: 40 },
    { from: 61, to: 72, year: 2200, offset: 60 },
    { from: 81, to: 92, year: 1800, offset: 80 },
  ];
  const century = centuries.find(
    ({ from, to }) => encodedMonth >= from && encodedMonth <= to,
  );
  if (!century) return null;
  return {
    year: century.year + shortYear,
    month: encodedMonth - century.offset,
    day,
  };
};

export const isValidPesel = (value: string): boolean => {
  if (!/^\d{11}$/u.test(value)) return false;
  const date = decodePeselDate(value);
  if (!date || !isValidDate(date.year, date.month, date.day)) return false;

  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = weights.reduce(
    (total, weight, index) => total + Number(value[index]) * weight,
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(value[10]);
};

const collectMatches = (
  text: string,
  pattern: RegExp,
  kind: DetectionKind,
  validate: (value: string) => boolean = () => true,
  hasValidBoundary: (text: string, start: number, end: number) => boolean =
    isBounded,
): SensitiveDetection[] =>
  [...text.matchAll(pattern)]
    .filter((match) => match.index !== undefined)
    .map((match) => ({
      kind,
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
    }))
    .filter(
      (detection) =>
        hasValidBoundary(text, detection.start, detection.end) &&
        validate(detection.value),
    );

const collectEmailMatches = (text: string): SensitiveDetection[] =>
  [...text.matchAll(EMAIL_PATTERN)]
    .flatMap((match) => {
      if (match.index === undefined) return [];
      const offset = emailValueOffset(match[0]);
      if (isUriUserInfoCandidate(text, match.index, match[0], offset)) return [];
      const value = match[0].slice(offset);
      const start = match.index + offset;
      return [
        { kind: "EMAIL" as const, start, end: start + value.length, value },
      ];
    })
    .filter((detection) =>
      isEmailBounded(text, detection.start, detection.end),
    );

// An exact password field is a trusted structural container, so it must hide
// any heuristic PESEL, e-mail or phone match inside its complete value. This is
// deliberately contextual; range length alone never decides a conflict.
const priority: Record<DetectionKind, number> = {
  PASSWORD: 0,
  SECRET: 0,
  PESEL: 1,
  PATIENT_NAME: 2,
  PATIENT_FIRST_NAME: 2,
  PATIENT_LAST_NAME: 2,
  PATIENT_ID: 2,
  EMAIL: 3,
  PHONE: 4,
};

export const detectSensitiveData = (text: string): SensitiveDetection[] => {
  const candidates = [
    ...collectMatches(text, PESEL_PATTERN, "PESEL", isValidPesel),
    ...detectStructuredSensitiveData(text),
    ...detectContextualSecrets(text),
    ...collectEmailMatches(text),
    ...collectMatches(text, PHONE_PATTERN, "PHONE"),
  ].sort(
    (left, right) =>
      priority[left.kind] - priority[right.kind] || left.start - right.start,
  );
  const accepted: SensitiveDetection[] = [];
  candidates.forEach((candidate) => {
    if (!accepted.some((detection) => overlaps(detection, candidate))) {
      accepted.push(candidate);
    }
  });
  return accepted.sort((left, right) => left.start - right.start);
};
