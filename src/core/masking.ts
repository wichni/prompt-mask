import type { DetectionKind, SensitiveDetection } from "./detection";

export interface TextRange {
  start: number;
  end: number;
}

export type PlaceholderKind = DetectionKind | "DANE";

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

const nextPlaceholderNumber = (kind: PlaceholderKind, text: string): number => {
  const matches = text.match(new RegExp(`\\[${kind}_(\\d+)\\]`, "gu")) ?? [];
  const usedNumbers = matches
    .map((match) => Number(match.slice(kind.length + 2, -1)))
    .filter((number) => Number.isSafeInteger(number) && number > 0);
  if (usedNumbers.length === 0) return 1;
  const maximum = Math.max(...usedNumbers);
  if (maximum < Number.MAX_SAFE_INTEGER) return maximum + 1;
  const used = new Set(usedNumbers);
  let candidate = 1;
  while (used.has(candidate)) candidate += 1;
  return candidate;
};

const formatPlaceholder = (kind: PlaceholderKind, number: number): string =>
  `[${kind}_${number}]`;

export const createPlaceholder = (
  kind: PlaceholderKind,
  text: string,
): string => formatPlaceholder(kind, nextPlaceholderNumber(kind, text));

interface PlannedReplacement {
  range: TextRange;
  replacement: string;
}

export interface MaskingPlan {
  text: string;
  caret: number;
}

const isValidRange = (
  text: string,
  range: TextRange,
): boolean =>
  Number.isSafeInteger(range.start) &&
  Number.isSafeInteger(range.end) &&
  range.start >= 0 &&
  range.start < range.end &&
  range.end <= text.length;

const applyReplacements = (
  text: string,
  replacements: PlannedReplacement[],
): MaskingPlan | null => {
  const sorted = [...replacements].sort(
    (left, right) => left.range.start - right.range.start,
  );
  if (
    sorted.some(
      ({ range }, index) =>
        !isValidRange(text, range) ||
        (index > 0 && sorted[index - 1]!.range.end > range.start),
    )
  ) {
    return null;
  }

  let sourceCursor = 0;
  let maskedText = "";
  let caret = 0;
  sorted.forEach(({ range, replacement }) => {
    maskedText += text.slice(sourceCursor, range.start) + replacement;
    sourceCursor = range.end;
    caret = maskedText.length;
  });
  return { text: maskedText + text.slice(sourceCursor), caret };
};

export const createMaskingPlan = (
  text: string,
  detections: SensitiveDetection[],
): MaskingPlan | null => {
  if (
    detections.length === 0 ||
    detections.some(
      (detection) =>
        text.slice(detection.start, detection.end) !== detection.value,
    )
  ) {
    return null;
  }
  const nextNumbers: Record<DetectionKind, number> = {
    PESEL: nextPlaceholderNumber("PESEL", text),
    EMAIL: nextPlaceholderNumber("EMAIL", text),
    PHONE: nextPlaceholderNumber("PHONE", text),
  };
  const replacements = [...detections]
    .sort((left, right) => left.start - right.start)
    .map((detection) => ({
      range: detection,
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
  if (text.slice(detection.start, detection.end) !== detection.value) {
    return null;
  }
  return (
    applyReplacements(text, [{ range: detection, replacement }])?.text ?? null
  );
};

const GENERATED_PLACEHOLDER = /\[(?:PESEL|EMAIL|PHONE|DANE)_\d+\]/gu;

const overlapsGeneratedPlaceholder = (
  text: string,
  range: TextRange,
): boolean =>
  [...text.matchAll(GENERATED_PLACEHOLDER)].some((match) => {
    const start = match.index;
    const end = start + match[0].length;
    return range.start < end && start < range.end;
  });

export type ManualMaskingPlan =
  | { status: "READY"; plan: MaskingPlan }
  | { status: "INVALID" }
  | { status: "PLACEHOLDER_OVERLAP" };

export const createManualMaskingPlan = (
  text: string,
  range: TextRange,
): ManualMaskingPlan => {
  if (
    !isValidRange(text, range) ||
    text.slice(range.start, range.end).trim() === ""
  ) {
    return { status: "INVALID" };
  }
  if (overlapsGeneratedPlaceholder(text, range)) {
    return { status: "PLACEHOLDER_OVERLAP" };
  }
  const plan = applyReplacements(text, [
    {
      range,
      replacement: formatPlaceholder(
        "DANE",
        nextPlaceholderNumber("DANE", text),
      ),
    },
  ]);
  return plan ? { status: "READY", plan } : { status: "INVALID" };
};
