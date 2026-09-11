import { describe, expect, it } from "vitest";
import type {
  AnalysisSnapshot,
  DetectionSummary,
} from "../src/platform/chromium/messages";
import {
  beginUndo,
  beginBulkMask,
  beginManualMask,
  beginSingleMask,
  detectionLabels,
  INITIAL_PANEL_STATE,
  reducePanelEvent,
} from "../src/app/side-panel-state";

const sessionId = "00000000-0000-4000-8000-000000000001";
const otherSessionId = "00000000-0000-4000-8000-000000000002";

const email: DetectionSummary = {
  id: "EMAIL:8:29",
  kind: "EMAIL",
  maskedPreview: "a•••@e•••.com",
};

const phone: DetectionSummary = {
  id: "PHONE:34:49",
  kind: "PHONE",
  maskedPreview: "••• ••• 700",
};

const snapshot = (
  revision: number,
  detections: DetectionSummary[],
): AnalysisSnapshot => ({
  type: "ANALYSIS_SNAPSHOT",
  sessionId,
  revision,
  length: 50,
  detections,
});

const readyState = () =>
  reducePanelEvent(
    reducePanelEvent(INITIAL_PANEL_STATE, {
      type: "HOST_STATUS",
      state: "READY",
    }),
    snapshot(1, [email, phone]),
  );

describe("side panel state", () => {
  it("uses the detector categories without risk labels", () => {
    expect(detectionLabels).toEqual({
      PESEL: "PESEL",
      EMAIL: "E-mail",
      PHONE: "Telefon",
      PATIENT_NAME: "Imię i nazwisko pacjenta",
      PATIENT_FIRST_NAME: "Imię pacjenta",
      PATIENT_LAST_NAME: "Nazwisko pacjenta",
      PATIENT_ID: "Identyfikator pacjenta",
      PASSWORD: "Hasło",
    });
  });

  it("confirms a single mask without repeating the remaining count", () => {
    const pending = beginSingleMask(readyState(), email);
    const rescanned = reducePanelEvent(pending, snapshot(2, [phone]));
    const confirmed = reducePanelEvent(rescanned, {
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id],
      resultRevision: 2,
      remainingDetections: 1,
      undoOperationId: 1,
    });

    expect(confirmed.pendingMask).toBeNull();
    expect(confirmed.feedback).toEqual({
      tone: "SUCCESS",
      message: "Zamaskowano e-mail.",
    });
  });

  it("reports how many fragments a confirmed bulk operation masked", () => {
    const pending = beginBulkMask(readyState());
    const rescanned = reducePanelEvent(pending, snapshot(2, []));
    const confirmed = reducePanelEvent(rescanned, {
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id, phone.id],
      resultRevision: 2,
      remainingDetections: 0,
      undoOperationId: 2,
    });

    expect(confirmed.feedback).toEqual({
      tone: "SUCCESS",
      message: "Zamaskowane fragmenty: 2.",
    });
  });

  it("tracks a payload-free selection and confirms manual masking after rescan", () => {
    const selected = reducePanelEvent(readyState(), {
      type: "SELECTION_STATE",
      state: "READY",
      selectionId: 4,
    });
    const pending = beginManualMask(selected);
    const cleared = reducePanelEvent(pending, {
      type: "SELECTION_STATE",
      state: "NONE",
    });
    const rescanned = reducePanelEvent(cleared, snapshot(2, [phone]));
    const confirmed = reducePanelEvent(rescanned, {
      type: "MANUAL_MASK_RESULT",
      status: "SUCCESS",
      selectionId: 4,
      resultRevision: 2,
      remainingDetections: 1,
      undoOperationId: 3,
    });

    expect(pending.pendingManualMask).toBe(4);
    expect(confirmed.pendingManualMask).toBeNull();
    expect(confirmed.undoOperationId).toBe(3);
    expect(confirmed.feedback).toEqual({
      tone: "SUCCESS",
      message: "Zamaskowano zaznaczony fragment.",
    });
  });

  it("tracks a manual operation started by the page shortcut", () => {
    const selected = reducePanelEvent(readyState(), {
      type: "SELECTION_STATE",
      state: "READY",
      selectionId: 8,
    });
    const pending = reducePanelEvent(selected, {
      type: "MANUAL_MASK_STARTED",
      selectionId: 8,
    });
    const foreign = reducePanelEvent(pending, {
      type: "MANUAL_MASK_STARTED",
      selectionId: 9,
    });

    expect(pending.pendingManualMask).toBe(8);
    expect(foreign).toBe(pending);
  });

  it("shows distinct selection guidance for overlap and stale execution", () => {
    const overlap = reducePanelEvent(readyState(), {
      type: "SELECTION_STATE",
      state: "INVALID",
      reason: "PLACEHOLDER_OVERLAP",
    });
    expect(overlap.selectionMessage).toBe(
      "Zaznaczenie obejmuje istniejące oznaczenie. Wybierz inny fragment.",
    );

    const selected = reducePanelEvent(readyState(), {
      type: "SELECTION_STATE",
      state: "READY",
      selectionId: 5,
    });
    const failed = reducePanelEvent(beginManualMask(selected), {
      type: "MANUAL_MASK_RESULT",
      status: "ERROR",
      selectionId: 5,
      error: "STALE_SELECTION",
    });
    expect(failed.feedback).toEqual({
      tone: "INFO",
      message: "Zaznacz fragment ponownie — tekst się zmienił.",
    });
  });

  it("distinguishes a changed draft from a masking failure", () => {
    const pending = beginBulkMask(readyState());
    const changed = reducePanelEvent(pending, {
      type: "MASK_RESULT",
      status: "ERROR",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id, phone.id],
      error: "STALE_TEXT",
    });

    expect(changed.feedback).toEqual({
      tone: "INFO",
      message: "Tekst się zmienił. Sprawdź aktualne wykrycia.",
    });

    const failed = reducePanelEvent(beginBulkMask(readyState()), {
      type: "MASK_RESULT",
      status: "ERROR",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id, phone.id],
      error: "MASK_FAILED",
    });
    expect(failed.feedback).toEqual({
      tone: "ERROR",
      message:
        "Nie udało się potwierdzić maskowania. Sprawdź tekst w polu wiadomości.",
    });
  });

  it("finishes an in-flight mask when editor failure precedes its result", () => {
    const pending = beginBulkMask(readyState());
    const editorFailed = reducePanelEvent(pending, {
      type: "HOST_STATUS",
      state: "ERROR",
      error: "COMPOSER_NOT_FOUND",
    });
    const result = reducePanelEvent(editorFailed, {
      type: "MASK_RESULT",
      status: "ERROR",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id, phone.id],
      error: "MASK_FAILED",
    });
    const recovered = reducePanelEvent(
      reducePanelEvent(result, { type: "HOST_STATUS", state: "READY" }),
      { ...snapshot(1, [phone]), sessionId: otherSessionId },
    );

    expect(editorFailed.pendingMask).toBeNull();
    expect(editorFailed.feedback).toEqual({
      tone: "ERROR",
      message:
        "Nie udało się potwierdzić maskowania. Sprawdź tekst w polu wiadomości.",
    });
    expect(result).toBe(editorFailed);
    expect(recovered.host).toBe("READY");
    expect(recovered.snapshot?.sessionId).toBe(otherSessionId);
  });

  it("clears operation feedback when the active source changes", () => {
    const pending = beginSingleMask(readyState(), email);
    const failed = reducePanelEvent(pending, {
      type: "MASK_RESULT",
      status: "ERROR",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id],
      error: "MASK_FAILED",
    });
    const connecting = reducePanelEvent(failed, {
      type: "HOST_STATUS",
      state: "SEARCHING",
    });

    expect(connecting).toEqual(INITIAL_PANEL_STATE);
  });

  it("confirms undo only for the current operation and updated snapshot", () => {
    const pendingMask = beginSingleMask(readyState(), email);
    const rescanned = reducePanelEvent(pendingMask, snapshot(2, [phone]));
    const masked = reducePanelEvent(rescanned, {
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id],
      resultRevision: 2,
      remainingDetections: 1,
      undoOperationId: 9,
    });
    const pendingUndo = beginUndo(masked);
    const staleResponse = reducePanelEvent(pendingUndo, {
      type: "UNDO_RESULT",
      status: "SUCCESS",
      operationId: 8,
      resultRevision: 3,
    });
    const restored = reducePanelEvent(staleResponse, snapshot(3, [email, phone]));
    const confirmed = reducePanelEvent(restored, {
      type: "UNDO_RESULT",
      status: "SUCCESS",
      operationId: 9,
      resultRevision: 3,
    });

    expect(staleResponse).toBe(pendingUndo);
    expect(confirmed.pendingUndo).toBeNull();
    expect(confirmed.undoOperationId).toBeNull();
    expect(confirmed.feedback).toEqual({
      tone: "SUCCESS",
      message: "Cofnięto ostatnie maskowanie.",
    });
  });

  it("expires undo on a draft change without reviving it later", () => {
    const pending = beginSingleMask(readyState(), email);
    const rescanned = reducePanelEvent(pending, snapshot(2, [phone]));
    const masked = reducePanelEvent(rescanned, {
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id],
      resultRevision: 2,
      remainingDetections: 1,
      undoOperationId: 10,
    });
    const invalidated = reducePanelEvent(masked, {
      type: "UNDO_INVALIDATED",
      operationId: 10,
      reason: "DRAFT_CHANGED",
    });
    const changedAgain = reducePanelEvent(invalidated, snapshot(4, [phone]));

    expect(changedAgain.undoOperationId).toBeNull();
    expect(changedAgain.feedback).toEqual({
      tone: "INFO",
      message: "Tekst zmieniony — cofanie niedostępne.",
      code: "UNDO_INVALIDATED",
    });
  });

  it("reports an in-flight undo invalidated by an uncertain context", () => {
    const pendingMask = beginSingleMask(readyState(), email);
    const rescanned = reducePanelEvent(pendingMask, snapshot(2, [phone]));
    const masked = reducePanelEvent(rescanned, {
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id],
      resultRevision: 2,
      remainingDetections: 1,
      undoOperationId: 11,
    });
    const pendingUndo = beginUndo(masked);
    const invalidated = reducePanelEvent(pendingUndo, {
      type: "UNDO_INVALIDATED",
      operationId: 11,
      reason: "CONTEXT_CHANGED",
    });
    const result = reducePanelEvent(invalidated, {
      type: "UNDO_RESULT",
      status: "ERROR",
      operationId: 11,
      error: "UNDO_FAILED",
    });

    expect(invalidated.pendingUndo).toBeNull();
    expect(invalidated.feedback).toEqual({
      tone: "ERROR",
      message:
        "Nie udało się potwierdzić cofnięcia. Sprawdź tekst w polu wiadomości.",
    });
    expect(result).toBe(invalidated);
  });

  it("drops pending work and ignores results from a previous draft session", () => {
    const pending = beginSingleMask(readyState(), email);
    const nextSession = reducePanelEvent(pending, {
      ...snapshot(1, [email, phone]),
      sessionId: otherSessionId,
    });
    const staleResult = reducePanelEvent(nextSession, {
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 1,
      detectionIds: [email.id],
      resultRevision: 2,
      remainingDetections: 1,
      undoOperationId: 20,
    });

    expect(nextSession.pendingMask).toBeNull();
    expect(nextSession.snapshot?.sessionId).toBe(otherSessionId);
    expect(staleResult).toBe(nextSession);
  });
});
