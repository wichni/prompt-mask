import type { DetectionSummary } from "../platform/chromium/messages";
import { detectionLabels } from "./side-panel-state";

export const DetectionRow = ({
  detection,
  disabled,
  onMask,
}: {
  detection: DetectionSummary;
  disabled: boolean;
  onMask: (detection: DetectionSummary) => void;
}) => (
  <article className="detection-item">
    <div className="detection-details">
      <strong>{detectionLabels[detection.kind]}</strong>
      <code>{detection.maskedPreview}</code>
    </div>
    <button
      aria-label={`Maskuj: ${detectionLabels[detection.kind]}`}
      className="single-mask"
      disabled={disabled}
      onClick={() => onMask(detection)}
      type="button"
    >
      Maskuj
    </button>
  </article>
);
