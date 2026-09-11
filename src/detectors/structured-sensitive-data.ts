import type { DetectionKind, SensitiveDetection } from "../core/detection";

type StructuredField =
  | "patientName"
  | "patientFirstName"
  | "patientLastName"
  | "patientId"
  | "password"
  | "client_secret"
  | "api_key"
  | "apiToken";

const FIELD_NAMES =
  "patientName|patientFirstName|patientLastName|patientId|password|client_secret|api_key|apiToken";
const JSON_FIELD_PATTERN = new RegExp(
  `"(${FIELD_NAMES})"[ \\t\\r\\n]{0,32}:[ \\t\\r\\n]{0,32}"([^"\\\\\\r\\n]{1,128})"`,
  "gu",
);
const ASSIGNMENT_PREFIX_PATTERN = new RegExp(
  `\\b(${FIELD_NAMES})[ \\t]{0,16}=[ \\t]{0,16}`,
  "gu",
);
const MAX_VALUE_LENGTH = 128;
const VALUE_BOUNDARY = /[\s,;}\]]/u;
const PATIENT_NAME_PATTERN =
  /^\p{L}[\p{L}'’.\-]*(?:[ \t]+\p{L}[\p{L}'’.\-]*){0,4}$/u;
const PATIENT_ID_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:\-]{0,63}$/u;
const GENERATED_PLACEHOLDER = /^\[[A-Z_]+_\d+\]$/u;

interface ParsedValue {
  start: number;
  end: number;
  value: string;
  quoted: boolean;
}

const kindByField: Record<StructuredField, DetectionKind> = {
  patientName: "PATIENT_NAME",
  patientFirstName: "PATIENT_FIRST_NAME",
  patientLastName: "PATIENT_LAST_NAME",
  patientId: "PATIENT_ID",
  password: "PASSWORD",
  client_secret: "SECRET",
  api_key: "SECRET",
  apiToken: "SECRET",
};

const isStructuredField = (value: string): value is StructuredField =>
  Object.hasOwn(kindByField, value);

const isNameKind = (kind: DetectionKind): boolean =>
  kind === "PATIENT_NAME" ||
  kind === "PATIENT_FIRST_NAME" ||
  kind === "PATIENT_LAST_NAME";

const isValidValue = (kind: DetectionKind, value: string): boolean => {
  if (value !== value.trim() || GENERATED_PLACEHOLDER.test(value)) return false;
  if (isNameKind(kind)) {
    return value.length <= 80 && PATIENT_NAME_PATTERN.test(value);
  }
  if (kind === "PATIENT_ID") return PATIENT_ID_PATTERN.test(value);
  return (kind === "PASSWORD" || kind === "SECRET") && value.length <= 128;
};

const allowsBareValue = (field: StructuredField): boolean =>
  field === "patientId" ||
  field === "password" ||
  field === "client_secret" ||
  field === "api_key" ||
  field === "apiToken";

const hasValueBoundary = (text: string, index: number): boolean =>
  index === text.length || VALUE_BOUNDARY.test(text[index] ?? "");

const readQuotedValue = (
  text: string,
  start: number,
  quote: "\"" | "'",
): ParsedValue | null => {
  const valueStart = start + 1;
  for (let cursor = valueStart; cursor < text.length; cursor += 1) {
    const character = text[cursor];
    if (character === "\\" || character === "\r" || character === "\n") {
      return null;
    }
    if (character !== quote) continue;
    if (cursor === valueStart || !hasValueBoundary(text, cursor + 1)) return null;
    const value = text.slice(valueStart, cursor);
    if (value.length > MAX_VALUE_LENGTH) return null;
    return { start: valueStart, end: cursor, value, quoted: true };
  }
  return null;
};

const readBracketedBareValue = (
  text: string,
  start: number,
): ParsedValue | null => {
  const closingBracket = text.indexOf("]", start + 1);
  if (
    closingBracket < 0 ||
    closingBracket - start + 1 > MAX_VALUE_LENGTH ||
    !hasValueBoundary(text, closingBracket + 1)
  ) {
    return null;
  }
  const end = closingBracket + 1;
  return { start, end, value: text.slice(start, end), quoted: false };
};

const readBareValue = (text: string, start: number): ParsedValue | null => {
  if (text[start] === "[") return readBracketedBareValue(text, start);
  let end = start;
  while (end < text.length && !VALUE_BOUNDARY.test(text[end] ?? "")) end += 1;
  const value = text.slice(start, end);
  if (value.length === 0 || value.length > MAX_VALUE_LENGTH) return null;
  return { start, end, value, quoted: false };
};

const readAssignmentValue = (
  text: string,
  start: number,
): ParsedValue | null => {
  const first = text[start];
  if (first === '"' || first === "'") return readQuotedValue(text, start, first);
  return readBareValue(text, start);
};

const toDetection = (
  match: RegExpMatchArray,
  value: string,
): SensitiveDetection | null => {
  const field = match[1];
  if (match.index === undefined || field === undefined || !isStructuredField(field)) {
    return null;
  }
  const kind = kindByField[field];
  if (!isValidValue(kind, value)) return null;
  const valueOffset = match[0].lastIndexOf(value);
  if (valueOffset < 0) return null;
  const start = match.index + valueOffset;
  return { kind, start, end: start + value.length, value };
};

const collectJsonMatches = (text: string): SensitiveDetection[] =>
  [...text.matchAll(JSON_FIELD_PATTERN)].flatMap((match) => {
    const value = match[2];
    if (value === undefined) return [];
    const detection = toDetection(match, value);
    return detection ? [detection] : [];
  });

const collectAssignmentMatches = (text: string): SensitiveDetection[] =>
  [...text.matchAll(ASSIGNMENT_PREFIX_PATTERN)].flatMap((match) => {
    const field = match[1];
    if (match.index === undefined || !field || !isStructuredField(field)) return [];
    const parsed = readAssignmentValue(text, match.index + match[0].length);
    if (!parsed) return [];
    if (!parsed.quoted && !allowsBareValue(field)) return [];
    const kind = kindByField[field];
    if (!isValidValue(kind, parsed.value)) return [];
    return [
      {
        kind,
        start: parsed.start,
        end: parsed.end,
        value: parsed.value,
      },
    ];
  });

export const detectStructuredSensitiveData = (
  text: string,
): SensitiveDetection[] =>
  [
    ...collectJsonMatches(text),
    ...collectAssignmentMatches(text),
  ].sort((left, right) => left.start - right.start);
