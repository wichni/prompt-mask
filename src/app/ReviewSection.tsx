import type { RefObject } from "react";
import type { DetectionSummary } from "../platform/chromium/messages";
import { DetectionRow } from "./DetectionRow";

export const ReviewSection = ({
  analysisComplete,
  detections,
  headingRef,
  length,
  onMaskAll,
  onMaskOne,
  operationPending,
}: {
  analysisComplete: boolean;
  detections: DetectionSummary[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  length: number | null;
  onMaskAll: () => void;
  onMaskOne: (detection: DetectionSummary) => void;
  operationPending: boolean;
}) => {
  const hasCurrentResult = analysisComplete && !operationPending;
  const count = hasCurrentResult ? detections.length : null;

  return (
    <section aria-labelledby="review-heading" className="review-section">
      <div className="review-heading">
        <h2 id="review-heading" ref={headingRef} tabIndex={-1}>
          Do sprawdzenia
        </h2>
        <span
          aria-label={
            count === null
              ? "Liczba wykryć niedostępna"
              : `Liczba wykryć: ${count}`
          }
          aria-atomic="true"
          aria-live="polite"
          className="review-count"
        >
          {count ?? "—"}
        </span>
      </div>

      {hasCurrentResult && detections.length > 0 && (
        <button className="bulk-mask" onClick={onMaskAll} type="button">
          Maskuj wszystkie ({detections.length})
        </button>
      )}

      {operationPending && <p className="empty-state">Aktualizuję analizę…</p>}
      {!operationPending && !analysisComplete && (
        <p className="empty-state">
          Propozycje pojawią się po połączeniu z edytorem.
        </p>
      )}
      {hasCurrentResult && length === 0 && (
        <div className="empty-state">
          <strong>Zacznij pisać</strong>
          <span>Propozycje pojawią się tutaj podczas pisania.</span>
        </div>
      )}
      {hasCurrentResult && length !== 0 && detections.length === 0 && (
        <div className="empty-state">
          <strong>Brak wykryć</strong>
          <span>
            Nie znaleziono obsługiwanych danych. Sprawdź też pozostałą treść.
          </span>
        </div>
      )}
      {hasCurrentResult && detections.length > 0 && (
        <ul className="detection-list">
          {detections.map((detection, index) => (
            <DetectionRow
              detection={detection}
              key={detection.id}
              onMask={onMaskOne}
              position={index + 1}
            />
          ))}
        </ul>
      )}
    </section>
  );
};
