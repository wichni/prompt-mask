import type { DetectionKind, SensitiveDetection } from "../core/detection";

type StructuredField =
  | "patientName"
  | "patientFirstName"
  | "patientLastName"
  | "patientId"
  | "password";

const FIELD_NAMES =
  "patientName|patientFirstName|patientLastName|patientId|password";
const JSON_FIELD_PATTERN = new RegExp(
  `"(${FIELD_NAMES})"[ \\t\\r\\n]{0,32}:[ \\t\\r\\n]{0,32}"([^"\\\\\\r\\n]{1,128})"`,
  "gu",
);
const ASSIGNMENT_FIELD_PATTERN = new RegExp(
  `\\b(${FIELD_NAMES})[ \\t]{0,16}=[ \\t]{0,16}(?:"([^"\\\\\\r\\n]{1,128})"|'([^'\\\\\\r\\n]{1,128})'|([^\\s,;}\\]]{1,128}))(?=$|[\\s,;}\\]])`,
  "gu",
);
const PATIENT_NAME_PATTERN =
  /^\p{L}[\p{L}'’.\-]*(?:[ \t]+\p{L}[\p{L}'’.\-]*){0,4}$/u;
const PATIENT_ID_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._:\-]{0,63}$/u;
const GENERATED_PLACEHOLDER = /^\[[A-Z_]+_\d+\]$/u;

const kindByField: Record<StructuredField, DetectionKind> = {
  patientName: "PATIENT_NAME",
  patientFirstName: "PATIENT_FIRST_NAME",
  patientLastName: "PATIENT_LAST_NAME",
  patientId: "PATIENT_ID",
  password: "PASSWORD",
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
  return kind === "PASSWORD" && value.length <= 128;
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

const collectMatches = (
  text: string,
  pattern: RegExp,
  allowsBareValue: (field: string) => boolean,
): SensitiveDetection[] =>
  [...text.matchAll(pattern)].flatMap((match) => {
    const value = match[2] ?? match[3] ?? match[4];
    const field = match[1] ?? "";
    const isBare = match[4] !== undefined;
    if (value === undefined || (isBare && !allowsBareValue(field))) return [];
    const detection = toDetection(match, value);
    return detection ? [detection] : [];
  });

export const detectStructuredSensitiveData = (
  text: string,
): SensitiveDetection[] =>
  [
    ...collectMatches(text, JSON_FIELD_PATTERN, () => false),
    ...collectMatches(
      text,
      ASSIGNMENT_FIELD_PATTERN,
      (field) => field === "patientId" || field === "password",
    ),
  ].sort((left, right) => left.start - right.start);
