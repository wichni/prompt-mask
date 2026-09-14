import type { DetectionSummary } from "../platform/chromium/messages";
import { detectionLabels } from "./side-panel-state";
import { DetectionIcon } from "./DetectionIcon";

export const DetectionRow = ({
  detection,
  onMask,
  position,
}: {
  detection: DetectionSummary;
  onMask: (detection: DetectionSummary, source: HTMLButtonElement) => void;
  position: number;
}) => (
  <li className="detection-item">
    <DetectionIcon kind={detection.kind} />
    <div className="detection-details">
      <strong>{detectionLabels[detection.kind]}</strong>
      <code>{detection.maskedPreview}</code>
    </div>
    <button
      aria-label={`Maskuj pozycję ${position}: ${detectionLabels[detection.kind]}`}
      className="single-mask"
      onClick={(event) => onMask(detection, event.currentTarget)}
      type="button"
    >
      Maskuj
    </button>
  </li>
);
