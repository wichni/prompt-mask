import type {
  AnalysisSnapshot,
  DetectionSummary,
  MaskResult,
  PanelEvent,
  UndoResult,
} from "../platform/chromium/messages";

export type PendingMask =
  | {
      mode: "SINGLE";
      detectionIds: string[];
      kind: DetectionSummary["kind"];
      revision: number;
    }
  | {
      mode: "ALL";
      count: number;
      detectionIds: string[];
      revision: number;
    };

export interface PanelFeedback {
  tone: "ERROR" | "INFO" | "SUCCESS";
  message: string;
  code?: "UNDO_INVALIDATED";
}

export interface PanelState {
  host: "CONNECTING" | "ERROR" | "READY";
  hostMessage: string;
  snapshot: AnalysisSnapshot | null;
  pendingMask: PendingMask | null;
  pendingUndo: number | null;
  undoOperationId: number | null;
  feedback: PanelFeedback | null;
}

export const INITIAL_PANEL_STATE: PanelState = {
  host: "CONNECTING",
  hostMessage: "",
  snapshot: null,
  pendingMask: null,
  pendingUndo: null,
  undoOperationId: null,
  feedback: null,
};

export const detectionLabels: Record<DetectionSummary["kind"], string> = {
  PESEL: "PESEL",
  EMAIL: "E-mail",
  PHONE: "Telefon",
};

const maskedDataLabels: Record<DetectionSummary["kind"], string> = {
  PESEL: "PESEL",
  EMAIL: "e-mail",
  PHONE: "telefon",
};

const hostErrorMessage = (event: PanelEvent): string | null => {
  if (event.type !== "HOST_STATUS" || event.state !== "ERROR") return null;
  const messages = {
    COMPOSER_NOT_FOUND:
      "Nie znaleziono pola wiadomości ChatGPT. Odśwież kartę.",
    CONTENT_SCRIPT_UNAVAILABLE:
      "Brak połączenia z kartą. Odśwież ChatGPT po aktualizacji rozszerzenia.",
    TEXT_TOO_LONG: "Tekst przekracza lokalny limit 12 000 znaków.",
    UNSUPPORTED_TAB: "Otwórz aktywną kartę https://chatgpt.com.",
  } as const;
  return messages[event.error];
};

const operationFailure = (
  state: PanelState,
  tone: PanelFeedback["tone"] = "ERROR",
  message = "Błąd maskowania. Sprawdź tekst i spróbuj ponownie.",
): PanelState => ({
  ...state,
  pendingMask: null,
  feedback: { tone, message },
});

const sameIds = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((detectionId, index) => detectionId === right[index]);

const matchesPending = (
  pending: PendingMask | null,
  event: MaskResult,
): pending is PendingMask =>
  pending !== null &&
  pending.revision === event.requestRevision &&
  sameIds(pending.detectionIds, event.detectionIds);

export const reducePanelEvent = (
  state: PanelState,
  event: PanelEvent,
): PanelState => {
  const error = hostErrorMessage(event);
  if (error) {
    return {
      host: "ERROR",
      hostMessage: error,
      snapshot: null,
      pendingMask: null,
      pendingUndo: null,
      undoOperationId: null,
      feedback: null,
    };
  }
  if (event.type === "HOST_STATUS") {
    if (event.state === "SEARCHING") return INITIAL_PANEL_STATE;
    return { ...state, host: "READY", hostMessage: "" };
  }
  if (event.type === "ANALYSIS_SNAPSHOT") {
    const draftChanged =
      state.snapshot !== null && state.snapshot.revision !== event.revision;
    const undoExpired =
      draftChanged &&
      !state.pendingMask &&
      state.pendingUndo === null &&
      state.undoOperationId !== null;
    return {
      ...state,
      snapshot: event,
      undoOperationId: undoExpired ? null : state.undoOperationId,
      feedback: undoExpired
        ? {
            tone: "INFO",
            message: "Tekst zmieniony — cofanie niedostępne.",
            code: "UNDO_INVALIDATED",
          }
        : draftChanged &&
            !state.pendingMask &&
            state.pendingUndo === null &&
            state.feedback?.code !== "UNDO_INVALIDATED"
          ? null
          : state.feedback,
    };
  }
  if (event.type === "UNDO_INVALIDATED") {
    if (
      event.operationId !== state.undoOperationId &&
      event.operationId !== state.pendingUndo
    ) {
      return state;
    }
    const failedInFlight = event.operationId === state.pendingUndo;
    return {
      ...state,
      pendingUndo: null,
      undoOperationId: null,
      feedback:
        event.reason === "CONTEXT_CHANGED"
          ? null
          : failedInFlight
            ? {
                tone: "ERROR",
                message: "Nie udało się cofnąć maskowania. Sprawdź tekst.",
              }
            : {
                tone: "INFO",
                message: "Tekst zmieniony — cofanie niedostępne.",
                code: "UNDO_INVALIDATED",
              },
    };
  }
  if (event.type === "UNDO_RESULT") return reduceUndoResult(state, event);
  if (!matchesPending(state.pendingMask, event)) return state;
  if (event.status === "ERROR") {
    return event.error === "STALE_TEXT"
      ? operationFailure(
          state,
          "INFO",
          "Tekst się zmienił. Sprawdź aktualne wykrycia.",
        )
      : operationFailure(state);
  }
  if (
    state.snapshot?.revision !== event.resultRevision ||
    state.snapshot.detections.length !== event.remainingDetections
  ) {
    return operationFailure(state);
  }

  const pending = state.pendingMask;
  return {
    ...state,
    pendingMask: null,
    undoOperationId: event.undoOperationId,
    feedback: {
      tone: "SUCCESS",
      message:
        pending.mode === "ALL"
          ? `Zamaskowane fragmenty: ${pending.count}.`
          : `Zamaskowano ${maskedDataLabels[pending.kind]}.`,
    },
  };
};

const reduceUndoResult = (
  state: PanelState,
  event: UndoResult,
): PanelState => {
  if (state.pendingUndo !== event.operationId) return state;
  if (
    event.status === "ERROR" ||
    state.snapshot?.revision !== event.resultRevision
  ) {
    return {
      ...state,
      pendingUndo: null,
      undoOperationId: null,
      feedback: {
        tone: "ERROR",
        message: "Nie udało się cofnąć maskowania. Sprawdź tekst.",
      },
    };
  }
  return {
    ...state,
    pendingUndo: null,
    undoOperationId: null,
    feedback: {
      tone: "SUCCESS",
      message: "Cofnięto ostatnie maskowanie.",
    },
  };
};

export const beginSingleMask = (
  state: PanelState,
  detection: DetectionSummary,
): PanelState => {
  if (!state.snapshot || state.pendingMask || state.pendingUndo !== null) {
    return state;
  }
  return {
    ...state,
    pendingMask: {
      mode: "SINGLE",
      detectionIds: [detection.id],
      kind: detection.kind,
      revision: state.snapshot.revision,
    },
    feedback: null,
  };
};

export const beginBulkMask = (state: PanelState): PanelState => {
  if (
    !state.snapshot ||
    state.pendingMask ||
    state.pendingUndo !== null ||
    state.snapshot.detections.length === 0
  ) {
    return state;
  }
  return {
    ...state,
    pendingMask: {
      mode: "ALL",
      count: state.snapshot.detections.length,
      detectionIds: state.snapshot.detections.map(({ id }) => id),
      revision: state.snapshot.revision,
    },
    feedback: null,
  };
};

export const failMaskDelivery = (state: PanelState): PanelState =>
  state.pendingMask ? operationFailure(state) : state;

export const beginUndo = (state: PanelState): PanelState => {
  if (
    state.undoOperationId === null ||
    state.pendingMask ||
    state.pendingUndo !== null
  ) {
    return state;
  }
  return {
    ...state,
    pendingUndo: state.undoOperationId,
    feedback: { tone: "INFO", message: "Cofanie…" },
  };
};

export const failUndoDelivery = (state: PanelState): PanelState =>
  state.pendingUndo === null
    ? state
    : {
        ...state,
        pendingUndo: null,
        undoOperationId: null,
        feedback: {
          tone: "ERROR",
          message: "Nie udało się cofnąć maskowania. Sprawdź tekst.",
        },
      };
