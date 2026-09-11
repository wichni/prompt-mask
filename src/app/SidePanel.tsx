import { useEffect, useRef, useState } from "react";
import type { DetectionSummary } from "../platform/chromium/messages";
import {
  watchNativeComposer,
  type NativeComposerSession,
} from "./native-composer-client";
import {
  beginBulkMask,
  beginSingleMask,
  beginUndo,
  detectionLabels,
  failMaskDelivery,
  failUndoDelivery,
  INITIAL_PANEL_STATE,
  reducePanelEvent,
} from "./side-panel-state";
import { OperationStatus } from "./OperationStatus";

const DetectionRow = ({
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

export const SidePanel = () => {
  const [state, setState] = useState(INITIAL_PANEL_STATE);
  const sessionRef = useRef<NativeComposerSession | null>(null);
  const operationInFlightRef = useRef(false);

  useEffect(() => {
    const session = watchNativeComposer((event) => {
      if (
        event.type === "MASK_RESULT" ||
        event.type === "UNDO_RESULT" ||
        event.type === "UNDO_INVALIDATED" ||
        (event.type === "HOST_STATUS" && event.state !== "READY")
      ) {
        operationInFlightRef.current = false;
      }
      setState((current) => reducePanelEvent(current, event));
    });
    sessionRef.current = session;
    return () => {
      operationInFlightRef.current = false;
      sessionRef.current = null;
      session.disconnect();
    };
  }, []);

  const sendMaskCommand = (
    detection: DetectionSummary | null,
  ): void => {
    const snapshot = state.snapshot;
    if (!snapshot || state.pendingMask || operationInFlightRef.current) return;
    const detectionIds = detection
      ? [detection.id]
      : snapshot.detections.map(({ id }) => id);
    if (detectionIds.length === 0) return;

    operationInFlightRef.current = true;
    setState((current) =>
      detection
        ? beginSingleMask(current, detection)
        : beginBulkMask(current),
    );
    const delivered =
      sessionRef.current?.mask({
        type: "MASK_DETECTIONS",
        revision: snapshot.revision,
        detectionIds,
      }) ?? false;
    if (!delivered) {
      operationInFlightRef.current = false;
      setState(failMaskDelivery);
    }
  };

  const sendUndoCommand = (): void => {
    const operationId = state.undoOperationId;
    if (
      operationId === null ||
      state.pendingMask ||
      state.pendingUndo !== null ||
      operationInFlightRef.current
    ) {
      return;
    }

    operationInFlightRef.current = true;
    setState(beginUndo);
    const delivered =
      sessionRef.current?.undo({ type: "UNDO_MASK", operationId }) ?? false;
    if (!delivered) {
      operationInFlightRef.current = false;
      setState(failUndoDelivery);
    }
  };

  const detections = state.snapshot?.detections ?? [];
  const isReady = state.host === "READY";
  const analysisComplete = isReady && state.snapshot !== null;
  const operationPending = state.pendingMask !== null || state.pendingUndo !== null;
  const actionsDisabled = !analysisComplete || operationPending;

  return (
    <main className="panel">
      <header className="header">
        <span className="eyebrow">Lokalna analiza</span>
        <h1>promptMask</h1>
        <p>Pisz normalnie w ChatGPT. Tutaj wybierasz, co zamaskować.</p>
      </header>

      <section className="connection-card" aria-live="polite">
        <span className={`connection-dot ${isReady ? "online" : ""}`} />
        <div>
          <strong>
            {state.host === "CONNECTING" && "Łączenie z edytorem…"}
            {state.host === "ERROR" && "Analiza niedostępna"}
            {isReady && "Analiza aktywna"}
          </strong>
          <p>
            {state.host === "ERROR" && state.hostMessage}
            {isReady && "Tekst jest sprawdzany lokalnie podczas pisania."}
          </p>
        </div>
      </section>

      <p className="analysis-summary" aria-live="polite">
        <strong>
          Do sprawdzenia: {analysisComplete ? detections.length : "—"}
        </strong>
      </p>

      <OperationStatus
        feedback={state.feedback}
        onUndo={sendUndoCommand}
        undoAvailable={state.undoOperationId !== null}
        undoDisabled={operationPending}
      />

      <button
        className="bulk-mask"
        disabled={actionsDisabled || detections.length === 0}
        onClick={() => sendMaskCommand(null)}
        type="button"
      >
        Maskuj wszystkie wykryte ({detections.length})
      </button>

      <section className="detections-card" aria-live="polite">
        <h2>Propozycje maskowania</h2>
        {analysisComplete && detections.length > 0 && (
          <p className="detections-instruction">
            Wybierz dane, które chcesz zamaskować.
          </p>
        )}
        {analysisComplete && detections.length === 0 && (
          <p>
            Brak wykryć dla obsługiwanych typów danych. Sprawdź, czy tekst
            zawiera inne dane wymagające ukrycia.
          </p>
        )}
        {detections.map((detection) => (
          <DetectionRow
            detection={detection}
            disabled={actionsDisabled}
            key={detection.id}
            onMask={(selected) => sendMaskCommand(selected)}
          />
        ))}
      </section>

      <aside className="warning" role="note">
        <strong>Ważne ograniczenie</strong>
        <span>
          Surowy tekst znajduje się w polu ChatGPT i jest dostępny dla tej
          strony. promptMask nie wysyła go własnym kanałem.
        </span>
      </aside>
    </main>
  );
};
