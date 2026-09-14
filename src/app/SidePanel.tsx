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
  type PanelFeedback,
} from "./side-panel-state";
import { OperationStatus } from "./OperationStatus";
import { ManualMaskAction } from "./ManualMaskAction";
import { ConnectionCard } from "./ConnectionCard";
import { ReviewSection } from "./ReviewSection";

export const SidePanel = () => {
  const [state, setState] = useState(INITIAL_PANEL_STATE);
  const sessionRef = useRef<NativeComposerSession | null>(null);
  const operationInFlightRef = useRef(false);
  const focusAfterOperationRef = useRef(false);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);

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

  const sendMaskCommand = (detection: DetectionSummary | null): void => {
    const snapshot = state.snapshot;
    if (!snapshot || state.pendingMask || operationInFlightRef.current) return;
    const detectionIds = detection
      ? [detection.id]
      : snapshot.detections.map(({ id }) => id);
    if (detectionIds.length === 0) return;

    operationInFlightRef.current = true;
    focusAfterOperationRef.current = true;
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
    focusAfterOperationRef.current = true;
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
    focusAfterOperationRef.current = true;
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
  const operationFeedback: PanelFeedback | null =
    state.feedback ??
    (state.pendingMask
      ? { tone: "INFO", message: "Maskowanie…" }
      : state.pendingManualMask !== null
        ? { tone: "INFO", message: "Maskowanie zaznaczenia…" }
        : null);

  useEffect(() => {
    if (
      focusAfterOperationRef.current &&
      !operationPending &&
      operationFeedback
    ) {
      reviewHeadingRef.current?.focus({ preventScroll: true });
      focusAfterOperationRef.current = false;
    }
  }, [operationFeedback, operationPending]);

  return (
    <main className="panel">
      <header className="header">
        <h1>promptMask</h1>
      </header>

      <ConnectionCard host={state.host} message={state.hostMessage} />

      <OperationStatus
        feedback={operationFeedback}
        onUndo={sendUndoCommand}
        undoAvailable={state.undoOperationId !== null}
        undoDisabled={operationPending}
      />

      <ReviewSection
        analysisComplete={analysisComplete}
        detections={detections}
        headingRef={reviewHeadingRef}
        length={state.snapshot?.length ?? null}
        onMaskAll={() => sendMaskCommand(null)}
        onMaskOne={sendMaskCommand}
        operationPending={operationPending}
      />

      <ManualMaskAction
        disabled={actionsDisabled || state.selectionId === null}
        instruction={state.selectionMessage}
        onMask={sendManualMaskCommand}
      />

      <aside className="privacy-boundary" role="note">
        <span>
          Tekst wpisany w ChatGPT jest dostępny dla tej strony. promptMask
          analizuje go lokalnie.
        </span>
      </aside>
    </main>
  );
};
