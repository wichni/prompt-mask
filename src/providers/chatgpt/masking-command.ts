import type { SensitiveDetection } from "../../core/detection";
import {
  createMaskingPlan,
  type MaskingPlan,
} from "../../core/masking";
import {
  isPanelCommand,
  type MaskCommand,
} from "../../platform/chromium/messages";

export type PreparedMaskCommand =
  | { status: "INVALID" }
  | { status: "STALE"; command: MaskCommand }
  | { status: "FAILED"; command: MaskCommand }
  | { status: "READY"; command: MaskCommand; plan: MaskingPlan };

const detectionId = (detection: SensitiveDetection): string =>
  `${detection.kind}:${detection.start}:${detection.end}`;

const sameIds = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);

export const prepareMaskCommand = (
  message: unknown,
  revision: number,
  currentText: string,
  detections: SensitiveDetection[],
): PreparedMaskCommand => {
  if (!isPanelCommand(message) || message.type !== "MASK_DETECTIONS") {
    return { status: "INVALID" };
  }
  const currentIds = detections.map(detectionId);
  if (
    message.revision !== revision ||
    (message.detectionIds.length > 1 &&
      !sameIds(message.detectionIds, currentIds))
  ) {
    return { status: "STALE", command: message };
  }

  const detectionsById = new Map(
    detections.map((detection) => [detectionId(detection), detection]),
  );
  const requested = message.detectionIds
    .map((id) => detectionsById.get(id))
    .filter((detection): detection is SensitiveDetection => Boolean(detection));
  if (requested.length !== message.detectionIds.length) {
    return { status: "STALE", command: message };
  }

  const plan = createMaskingPlan(currentText, requested);
  return plan
    ? { status: "READY", command: message, plan }
    : { status: "FAILED", command: message };
};
