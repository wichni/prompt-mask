import type { DetectionKind, SensitiveDetection } from "./detection";

const MASK = "•••";

const maskEmail = (value: string): string => {
  const [local = "", domain = ""] = value.split("@");
  const domainParts = domain.split(".");
  const topLevelDomain = domainParts.at(-1) ?? "";
  const domainName = domainParts[0] ?? "";
  return `${local[0] ?? "•"}${MASK}@${domainName[0] ?? "•"}${MASK}.${topLevelDomain}`;
};

export const createMaskedPreview = (
  detection: SensitiveDetection,
): string => {
  if (detection.kind === "EMAIL") return maskEmail(detection.value);
  const digits = detection.value.replace(/\D/gu, "");
  if (detection.kind === "PHONE") return `${MASK} ${MASK} ${digits.slice(-3)}`;
  return `${"•".repeat(9)}${digits.slice(-2)}`;
};

const nextPlaceholderNumber = (kind: DetectionKind, text: string): number => {
  const matches = text.match(new RegExp(`\\[${kind}_(\\d+)\\]`, "gu")) ?? [];
  const usedNumbers = matches.map((match) =>
    Number(match.slice(kind.length + 2, -1)),
  );
  return usedNumbers.length === 0 ? 1 : Math.max(...usedNumbers) + 1;
};

const formatPlaceholder = (kind: DetectionKind, number: number): string =>
  `[${kind}_${number}]`;

export const createPlaceholder = (
  kind: DetectionKind,
  text: string,
): string => formatPlaceholder(kind, nextPlaceholderNumber(kind, text));

interface PlannedReplacement {
  detection: SensitiveDetection;
  replacement: string;
}

export interface MaskingPlan {
  text: string;
  caret: number;
}

const isValidDetection = (
  text: string,
  detection: SensitiveDetection,
): boolean =>
  Number.isSafeInteger(detection.start) &&
  Number.isSafeInteger(detection.end) &&
  detection.start >= 0 &&
  detection.start < detection.end &&
  detection.end <= text.length &&
  text.slice(detection.start, detection.end) === detection.value;

const applyReplacements = (
  text: string,
  replacements: PlannedReplacement[],
): MaskingPlan | null => {
  const sorted = [...replacements].sort(
    (left, right) => left.detection.start - right.detection.start,
  );
  if (
    sorted.some(
      ({ detection }, index) =>
        !isValidDetection(text, detection) ||
        (index > 0 && sorted[index - 1]!.detection.end > detection.start),
    )
  ) {
    return null;
  }

  let sourceCursor = 0;
  let maskedText = "";
  let caret = 0;
  sorted.forEach(({ detection, replacement }) => {
    maskedText += text.slice(sourceCursor, detection.start) + replacement;
    sourceCursor = detection.end;
    caret = maskedText.length;
  });
  return { text: maskedText + text.slice(sourceCursor), caret };
};

export const createMaskingPlan = (
  text: string,
  detections: SensitiveDetection[],
): MaskingPlan | null => {
  if (detections.length === 0) return null;
  const nextNumbers: Record<DetectionKind, number> = {
    PESEL: nextPlaceholderNumber("PESEL", text),
    EMAIL: nextPlaceholderNumber("EMAIL", text),
    PHONE: nextPlaceholderNumber("PHONE", text),
  };
  const replacements = [...detections]
    .sort((left, right) => left.start - right.start)
    .map((detection) => ({
      detection,
      replacement: formatPlaceholder(
        detection.kind,
        nextNumbers[detection.kind]++,
      ),
    }));
  return applyReplacements(text, replacements);
};

export const replaceDetection = (
  text: string,
  detection: SensitiveDetection,
  replacement: string,
): string | null => {
  return applyReplacements(text, [{ detection, replacement }])?.text ?? null;
};
