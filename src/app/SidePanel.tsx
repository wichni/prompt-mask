import { useEffect, useRef, useState } from "react";
import type { DetectionSummary } from "../platform/chromium/messages";
import {
  watchNativeComposer,
  type NativeComposerSession,
} from "./native-composer-client";
import {
  beginBulkMask,
  beginManualMask,
  beginSingleMask,
  beginUndo,
  failMaskDelivery,
  failManualMaskDelivery,
  failUndoDelivery,
  INITIAL_PANEL_STATE,
  reducePanelEvent,
} from "./side-panel-state";
import { OperationStatus } from "./OperationStatus";
import { ManualMaskAction } from "./ManualMaskAction";
import { DetectionRow } from "./DetectionRow";
import { ConnectionCard } from "./ConnectionCard";

export const SidePanel = () => {
  const [state, setState] = useState(INITIAL_PANEL_STATE);
  const sessionRef = useRef<NativeComposerSession | null>(null);
  const operationInFlightRef = useRef(false);

  useEffect(() => {
    const session = watchNativeComposer((event) => {
      if (event.type === "MANUAL_MASK_STARTED") {
        operationInFlightRef.current = true;
      } else if (
        event.type === "MASK_RESULT" ||
        event.type === "MANUAL_MASK_RESULT" ||
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
        sessionId: snapshot.sessionId,
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
      state.pendingManualMask !== null ||
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

  const sendManualMaskCommand = (): void => {
    const selectionId = state.selectionId;
    if (
      selectionId === null ||
      !state.snapshot ||
      state.pendingMask ||
      state.pendingManualMask !== null ||
      state.pendingUndo !== null ||
      operationInFlightRef.current
    ) {
      return;
    }
    operationInFlightRef.current = true;
    setState(beginManualMask);
    const delivered =
      sessionRef.current?.maskSelection({
        type: "MASK_SELECTION",
        selectionId,
      }) ?? false;
    if (!delivered) {
      operationInFlightRef.current = false;
      setState(failManualMaskDelivery);
    }
  };

  const detections = state.snapshot?.detections ?? [];
  const isReady = state.host === "READY";
  const analysisComplete = isReady && state.snapshot !== null;
  const operationPending =
    state.pendingMask !== null ||
    state.pendingManualMask !== null ||
    state.pendingUndo !== null;
  const actionsDisabled = !analysisComplete || operationPending;

  return (
    <main className="panel">
      <header className="header">
        <span className="eyebrow">Lokalna analiza</span>
        <h1>promptMask</h1>
        <p>Pisz normalnie w ChatGPT. Tutaj wybierasz, co zamaskować.</p>
      </header>

      <ConnectionCard host={state.host} message={state.hostMessage} />

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

      <section className="mask-actions" aria-label="Akcje maskowania">
        <ManualMaskAction
          disabled={actionsDisabled || state.selectionId === null}
          instruction={state.selectionMessage}
          onMask={sendManualMaskCommand}
        />
        <button
          className="bulk-mask"
          disabled={actionsDisabled || detections.length === 0}
          onClick={() => sendMaskCommand(null)}
          type="button"
        >
          Maskuj wszystkie wykryte ({detections.length})
        </button>
      </section>

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
