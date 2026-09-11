export type DetectionKind = "PESEL" | "EMAIL" | "PHONE";

export interface SensitiveDetection {
  kind: DetectionKind;
  start: number;
  end: number;
  value: string;
}

export const overlaps = (
  left: SensitiveDetection,
  right: SensitiveDetection,
): boolean => left.start < right.end && right.start < left.end;
