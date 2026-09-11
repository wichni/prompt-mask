export type DetectionKind =
  | "PESEL"
  | "EMAIL"
  | "PHONE"
  | "PATIENT_NAME"
  | "PATIENT_FIRST_NAME"
  | "PATIENT_LAST_NAME"
  | "PATIENT_ID"
  | "PASSWORD"
  | "SECRET";

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
