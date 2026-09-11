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
  onUndo: () => void;
  undoAvailable: boolean;
  undoDisabled: boolean;
}) => (
  <div
    aria-atomic="true"
    aria-live="polite"
    className="operation-status"
    role="status"
  >
    <span aria-hidden="true" className="status-placeholder">
      <b className="feedback-icon">!</b>
      <span>Nie udało się zamaskować zaznaczenia. Sprawdź tekst.</span>
      <span className="undo-placeholder">Cofnij</span>
    </span>
    {feedback && (
      <span className={`feedback ${feedback.tone.toLowerCase()}`}>
        <b aria-hidden="true" className="feedback-icon">
          {feedbackIcons[feedback.tone]}
        </b>
        <span className="feedback-message">{feedback.message}</span>
        {undoAvailable && (
          <button
            aria-label="Cofnij ostatnie maskowanie"
            className="undo-mask"
            disabled={undoDisabled}
            onClick={onUndo}
            type="button"
          >
            Cofnij
          </button>
        )}
      </span>
    )}
  </div>
);
