import type {
  AnalysisSnapshot,
  DetectionSummary,
  DraftSessionId,
  ManualMaskResult,
  MaskResult,
  PanelEvent,
  UndoResult,
} from "../platform/chromium/messages";

export type PendingMask =
  | {
      mode: "SINGLE";
      detectionIds: string[];
      kind: DetectionSummary["kind"];
      sessionId: DraftSessionId;
      revision: number;
    }
  | {
      mode: "ALL";
      count: number;
      detectionIds: string[];
      sessionId: DraftSessionId;
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
  pendingManualMask: number | null;
  pendingUndo: number | null;
  selectionId: number | null;
  selectionMessage: string;
  undoOperationId: number | null;
  feedback: PanelFeedback | null;
}

export const INITIAL_PANEL_STATE: PanelState = {
  host: "CONNECTING",
  hostMessage: "",
  snapshot: null,
  pendingMask: null,
  pendingManualMask: null,
  pendingUndo: null,
  selectionId: null,
  selectionMessage:
    "Zaznacz fragment w polu wiadomości, aby zamaskować go ręcznie.",
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

const MASK_CONFIRMATION_FAILED =
  "Nie udało się potwierdzić maskowania. Sprawdź tekst w polu wiadomości.";
const MANUAL_MASK_CONFIRMATION_FAILED =
  "Nie udało się potwierdzić maskowania zaznaczenia. Sprawdź tekst w polu wiadomości.";
const UNDO_CONFIRMATION_FAILED =
  "Nie udało się potwierdzić cofnięcia. Sprawdź tekst w polu wiadomości.";

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

const pendingOperationFailure = (state: PanelState): PanelFeedback | null => {
  if (state.pendingUndo !== null) {
    return { tone: "ERROR", message: UNDO_CONFIRMATION_FAILED };
  }
  if (state.pendingManualMask !== null) {
    return { tone: "ERROR", message: MANUAL_MASK_CONFIRMATION_FAILED };
  }
  if (state.pendingMask) {
    return { tone: "ERROR", message: MASK_CONFIRMATION_FAILED };
  }
  return state.feedback?.tone === "ERROR" ? state.feedback : null;
};

const sameIds = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((detectionId, index) => detectionId === right[index]);

const matchesPending = (
  pending: PendingMask | null,
  event: MaskResult,
): pending is PendingMask =>
  pending !== null &&
  pending.sessionId === event.sessionId &&
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
      pendingManualMask: null,
      pendingUndo: null,
      selectionId: null,
      selectionMessage: INITIAL_PANEL_STATE.selectionMessage,
      undoOperationId: null,
      feedback: pendingOperationFailure(state),
    };
  }
  if (event.type === "HOST_STATUS") {
    if (event.state === "SEARCHING") return INITIAL_PANEL_STATE;
    return { ...state, host: "READY", hostMessage: "" };
  }
  if (event.type === "SELECTION_STATE") {
    if (event.state === "READY") {
      return {
        ...state,
        selectionId: event.selectionId,
        selectionMessage: "Zaznaczenie gotowe do maskowania.",
      };
    }
    return {
      ...state,
      selectionId: null,
      selectionMessage:
        event.state === "INVALID"
          ? "Zaznaczenie obejmuje istniejące oznaczenie. Wybierz inny fragment."
          : INITIAL_PANEL_STATE.selectionMessage,
    };
  }
  if (event.type === "ANALYSIS_SNAPSHOT") {
    const sessionChanged =
      state.snapshot !== null &&
      state.snapshot.sessionId !== event.sessionId;
    if (sessionChanged) {
      return {
        ...INITIAL_PANEL_STATE,
        host: "READY",
        snapshot: event,
      };
    }
    const draftChanged =
      state.snapshot !== null && state.snapshot.revision !== event.revision;
    const undoExpired =
      draftChanged &&
      !state.pendingMask &&
      state.pendingManualMask === null &&
      state.pendingUndo === null &&
      state.undoOperationId !== null;
    return {
      ...state,
      snapshot: event,
      selectionId: draftChanged ? null : state.selectionId,
      selectionMessage: draftChanged
        ? INITIAL_PANEL_STATE.selectionMessage
        : state.selectionMessage,
      undoOperationId: undoExpired ? null : state.undoOperationId,
      feedback: undoExpired
        ? {
            tone: "INFO",
            message: "Tekst zmieniony — cofanie niedostępne.",
            code: "UNDO_INVALIDATED",
          }
        : draftChanged &&
            !state.pendingMask &&
            state.pendingManualMask === null &&
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
        failedInFlight
          ? {
              tone: "ERROR",
              message: UNDO_CONFIRMATION_FAILED,
            }
          : event.reason === "CONTEXT_CHANGED"
            ? null
            : {
                tone: "INFO",
                message: "Tekst zmieniony — cofanie niedostępne.",
                code: "UNDO_INVALIDATED",
              },
    };
  }
  if (event.type === "UNDO_RESULT") return reduceUndoResult(state, event);
  if (event.type === "MANUAL_MASK_STARTED") {
    if (
      state.selectionId !== event.selectionId ||
      state.pendingMask ||
      state.pendingManualMask !== null ||
      state.pendingUndo !== null
    ) {
      return state;
    }
    return {
      ...state,
      pendingManualMask: event.selectionId,
      feedback: null,
    };
  }
  if (event.type === "MANUAL_MASK_RESULT") {
    return reduceManualMaskResult(state, event);
  }
  if (event.type !== "MASK_RESULT") return state;
  if (!matchesPending(state.pendingMask, event)) return state;
  if (event.status === "ERROR") {
    return event.error === "STALE_TEXT"
      ? operationFailure(
          state,
          "INFO",
          "Tekst się zmienił. Sprawdź aktualne wykrycia.",
        )
      : operationFailure(state, "ERROR", MASK_CONFIRMATION_FAILED);
  }
  if (
    state.snapshot?.sessionId !== event.sessionId ||
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

const reduceManualMaskResult = (
  state: PanelState,
  event: ManualMaskResult,
): PanelState => {
  if (state.pendingManualMask !== event.selectionId) return state;
  if (event.status === "ERROR") {
    return {
      ...state,
      pendingManualMask: null,
      selectionId: null,
      selectionMessage: INITIAL_PANEL_STATE.selectionMessage,
      feedback: {
        tone: event.error === "STALE_SELECTION" ? "INFO" : "ERROR",
        message:
          event.error === "STALE_SELECTION"
            ? "Zaznacz fragment ponownie — tekst się zmienił."
            : MANUAL_MASK_CONFIRMATION_FAILED,
      },
    };
  }
  if (
    state.snapshot?.revision !== event.resultRevision ||
    state.snapshot.detections.length !== event.remainingDetections
  ) {
    return {
      ...state,
      pendingManualMask: null,
      selectionId: null,
      selectionMessage: INITIAL_PANEL_STATE.selectionMessage,
      feedback: {
        tone: "ERROR",
        message: MANUAL_MASK_CONFIRMATION_FAILED,
      },
    };
  }
  return {
    ...state,
    pendingManualMask: null,
    selectionId: null,
    selectionMessage: INITIAL_PANEL_STATE.selectionMessage,
    undoOperationId: event.undoOperationId,
    feedback: {
      tone: "SUCCESS",
      message: "Zamaskowano zaznaczony fragment.",
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
        message: UNDO_CONFIRMATION_FAILED,
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
  if (
    !state.snapshot ||
    state.pendingMask ||
    state.pendingManualMask !== null ||
    state.pendingUndo !== null
  ) {
    return state;
  }
  return {
    ...state,
    pendingMask: {
      mode: "SINGLE",
      detectionIds: [detection.id],
      kind: detection.kind,
      sessionId: state.snapshot.sessionId,
      revision: state.snapshot.revision,
    },
    feedback: null,
  };
};

export const beginBulkMask = (state: PanelState): PanelState => {
  if (
    !state.snapshot ||
    state.pendingMask ||
    state.pendingManualMask !== null ||
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
      sessionId: state.snapshot.sessionId,
      revision: state.snapshot.revision,
    },
    feedback: null,
  };
};

export const failMaskDelivery = (state: PanelState): PanelState =>
  state.pendingMask ? operationFailure(state) : state;

export const beginManualMask = (state: PanelState): PanelState => {
  if (
    !state.snapshot ||
    state.selectionId === null ||
    state.pendingMask ||
    state.pendingManualMask !== null ||
    state.pendingUndo !== null
  ) {
    return state;
  }
  return {
    ...state,
    pendingManualMask: state.selectionId,
    feedback: null,
  };
};

export const failManualMaskDelivery = (state: PanelState): PanelState =>
  state.pendingManualMask === null
    ? state
    : {
        ...state,
        pendingManualMask: null,
        selectionId: null,
        selectionMessage: INITIAL_PANEL_STATE.selectionMessage,
        feedback: {
          tone: "ERROR",
          message: "Nie udało się zamaskować zaznaczenia. Sprawdź tekst.",
        },
      };

export const beginUndo = (state: PanelState): PanelState => {
  if (
    state.undoOperationId === null ||
    state.pendingMask ||
    state.pendingManualMask !== null ||
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
