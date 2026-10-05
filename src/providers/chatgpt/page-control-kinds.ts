import type { DetectionKind, SensitiveDetection } from "../../core/detection";

export interface KindCount {
  kind: DetectionKind;
  count: number;
}

export const kindLabels: Record<DetectionKind, string> = {
  PHONE: "Telefon",
  EMAIL: "E-mail",
  PESEL: "PESEL",
  PATIENT_NAME: "Dane pacjenta",
  PATIENT_FIRST_NAME: "Imię pacjenta",
  PATIENT_LAST_NAME: "Nazwisko pacjenta",
  PATIENT_ID: "ID pacjenta",
  PASSWORD: "Hasło",
  SECRET: "Sekret",
};

const kindOrder = Object.keys(kindLabels) as DetectionKind[];

export const countDetectionKinds = (
  detections: readonly SensitiveDetection[],
): KindCount[] => {
  const counts = new Map<DetectionKind, number>();
  for (const detection of detections) {
    counts.set(detection.kind, (counts.get(detection.kind) ?? 0) + 1);
  }
  return kindOrder.flatMap((kind) => {
    const count = counts.get(kind);
    return count ? [{ kind, count }] : [];
  });
};
