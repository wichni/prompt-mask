import type { PanelFeedback } from "./side-panel-state";

const feedbackIcons: Record<PanelFeedback["tone"], string> = {
  SUCCESS: "✓",
  INFO: "i",
  ERROR: "!",
};

export const OperationStatus = ({
  feedback,
  onUndo,
  undoAvailable,
  undoDisabled,
}: {
  feedback: PanelFeedback | null;
  onUndo: (source: HTMLButtonElement) => void;
  undoAvailable: boolean;
  undoDisabled: boolean;
}) => {
  if (!feedback) return null;

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={`feedback ${feedback.tone.toLowerCase()}`}
      role="status"
    >
      <b aria-hidden="true" className="feedback-icon">
        {feedbackIcons[feedback.tone]}
      </b>
      <span className="feedback-message">{feedback.message}</span>
      {undoAvailable && (
        <button
          aria-label="Cofnij ostatnie maskowanie"
          className="undo-mask"
          disabled={undoDisabled}
          onClick={(event) => onUndo(event.currentTarget)}
          type="button"
        >
          Cofnij
        </button>
      )}
    </div>
  );
};
