import type { SensitiveDetection } from "../../core/detection";
import {
  createManualMaskingPlan,
  createMaskedPreview,
  type MaskingPlan,
} from "../../core/masking";
import { detectSensitiveData } from "../../detectors/sensitive-data";
import {
  MAX_TEXT_LENGTH,
  PANEL_CONTENT_PORT,
  isPanelCommand,
  type AnalysisSnapshot,
  type HostStatus,
  type ManualMaskCommand,
  type MaskCommand,
  type PanelEvent,
  type UndoCommand,
} from "../../platform/chromium/messages";
import {
  captureComposerRestorePoint,
  findNativeComposer,
  readComposerCaret,
  readComposerStructure,
  readComposerText,
  restoreComposerText,
  type ComposerStructureSignature,
  writeComposerText,
} from "./native-composer";
import { prepareMaskCommand } from "./masking-command";
import {
  createUndoRecord,
  matchesUndoDraft,
  type UndoDraftState,
  type UndoRecord,
} from "./undo-record";
import { SelectionController } from "./selection-controller";
import { matchesSelectionDraft } from "./selection-record";
import { ManualMaskShortcut } from "./manual-mask-shortcut";
import { DraftSession } from "./draft-session";

const panelPorts = new Set<chrome.runtime.Port>();
let observer: MutationObserver | null = null;
let scheduled = false;
let composer: HTMLElement | null = null;
let sourceUrl = "";
const draftSession = new DraftSession(() => crypto.randomUUID());
let currentText = "";
let currentStructure: string | null = null;
let revision = 0;
let detections: SensitiveDetection[] = [];
let lastHostStatus: HostStatus = { type: "HOST_STATUS", state: "SEARCHING" };
let lastSnapshot: AnalysisSnapshot | null = null;
let nextOperationId = 1;
let undoRecord: UndoRecord | null = null;
let writeInProgress = false;
let selectionController: SelectionController;
let manualMaskShortcut: ManualMaskShortcut | null = null;

const postToPanel = (port: chrome.runtime.Port, event: PanelEvent): void => {
  try {
    port.postMessage(event);
  } catch {
    panelPorts.delete(port);
  }
};

const broadcast = (event: PanelEvent): void => {
  if (event.type === "HOST_STATUS") lastHostStatus = event;
  if (event.type === "ANALYSIS_SNAPSHOT") lastSnapshot = event;
  panelPorts.forEach((port) => postToPanel(port, event));
};

const discardUndo = (
  reason: "DRAFT_CHANGED" | "CONTEXT_CHANGED",
  notify = true,
): void => {
  const record = undoRecord;
  undoRecord = null;
  if (record && notify) {
    broadcast({
      type: "UNDO_INVALIDATED",
      operationId: record.operationId,
      reason,
    });
  }
};

const currentUndoDraftState = (): UndoDraftState | null =>
  composer
    ? {
        sessionId: draftSession.sessionId,
        composer,
        sourceUrl,
        contextGeneration: draftSession.contextGeneration,
        changeGeneration: draftSession.changeGeneration,
        revision,
        text: currentText,
        structure: currentStructure,
      }
    : null;

const markIndependentChange = (): void => {
  draftSession.markDraftChanged();
  selectionController.discard();
  discardUndo("DRAFT_CHANGED");
};

const detectionId = (detection: SensitiveDetection): string =>
  `${detection.kind}:${detection.start}:${detection.end}`;

const createSnapshot = (): AnalysisSnapshot => ({
  type: "ANALYSIS_SNAPSHOT",
  sessionId: draftSession.sessionId,
  revision,
  length: currentText.length,
  detections: detections.map((detection) => ({
    id: detectionId(detection),
    kind: detection.kind,
    maskedPreview: createMaskedPreview(detection),
  })),
});

const scanComposer = (): void => {
  scheduled = false;
  const nextComposer = findNativeComposer(document);
  if (!nextComposer) {
    if (composer) draftSession.startNewContext();
    selectionController.discard();
    discardUndo("CONTEXT_CHANGED");
    composer = null;
    lastSnapshot = null;
    broadcast({
      type: "HOST_STATUS",
      state: "ERROR",
      error: "COMPOSER_NOT_FOUND",
    });
    return;
  }

  const nextSourceUrl = window.location.href;
  const sourceChanged =
    composer !== nextComposer || sourceUrl !== nextSourceUrl;
  if (sourceChanged) {
    const hadSource = composer !== null || sourceUrl !== "";
    draftSession.startNewContext();
    selectionController.discard();
    discardUndo("CONTEXT_CHANGED");
    composer = nextComposer;
    sourceUrl = nextSourceUrl;
    currentText = "";
    currentStructure = null;
    revision = 0;
    detections = [];
    if (hadSource) broadcast({ type: "HOST_STATUS", state: "SEARCHING" });
  }

  const nextText = readComposerText(nextComposer);
  const nextStructure = readComposerStructure(nextComposer);
  if (nextText.length > MAX_TEXT_LENGTH) {
    if (!writeInProgress && nextText !== currentText) markIndependentChange();
    lastSnapshot = null;
    broadcast({ type: "HOST_STATUS", state: "ERROR", error: "TEXT_TOO_LONG" });
    return;
  }

  const textChanged = nextText !== currentText;
  const structureChanged = nextStructure !== currentStructure;
  if (textChanged || structureChanged) {
    if (!writeInProgress) markIndependentChange();
    currentText = nextText;
    currentStructure = nextStructure;
    revision += 1;
    detections = detectSensitiveData(currentText);
  }

  if (
    !textChanged &&
    !structureChanged &&
    lastHostStatus.state === "READY" &&
    lastSnapshot
  ) {
    return;
  }
  broadcast({ type: "HOST_STATUS", state: "READY" });
  broadcast(createSnapshot());
};

const scheduleScan = (): void => {
  if (scheduled || panelPorts.size === 0) return;
  scheduled = true;
  requestAnimationFrame(scanComposerSafely);
};

const handleInput = (event: Event): void => {
  const target = event.target;
  const activeComposer = findNativeComposer(document);
  if (
    activeComposer &&
    target instanceof Node &&
    (target === activeComposer || activeComposer.contains(target))
  ) {
    if (!writeInProgress) {
      if (activeComposer !== composer || window.location.href !== sourceUrl) {
        draftSession.startNewContext();
        selectionController.discard();
        discardUndo("CONTEXT_CHANGED");
      } else {
        markIndependentChange();
      }
    }
    scheduleScan();
  }
};

const handleSubmit = (event: Event): void => {
  if (
    composer &&
    event.target instanceof HTMLFormElement &&
    composer.closest("form") === event.target
  ) {
    draftSession.startNewContext();
    selectionController.discard();
    discardUndo("CONTEXT_CHANGED");
  }
};

const broadcastMaskError = (
  command: MaskCommand,
  error: "MASK_FAILED" | "STALE_TEXT",
): void => {
  broadcast({
    type: "MASK_RESULT",
    status: "ERROR",
    sessionId: command.sessionId,
    requestRevision: command.revision,
    detectionIds: [...command.detectionIds],
    error,
  });
};

const hasCurrentComposerContext = (): boolean => {
  try {
    return (
      composer !== null &&
      window.location.href === sourceUrl &&
      findNativeComposer(document) === composer &&
      readComposerText(composer) === currentText &&
      readComposerStructure(composer) === currentStructure
    );
  } catch {
    return false;
  }
};

const resetAfterFailedRecoveryScan = (): void => {
  draftSession.startNewContext();
  selectionController.reset();
  manualMaskShortcut?.hide();
  discardUndo("CONTEXT_CHANGED");
  composer = null;
  sourceUrl = "";
  currentText = "";
  currentStructure = null;
  revision = 0;
  detections = [];
  lastSnapshot = null;
  broadcast({
    type: "HOST_STATUS",
    state: "ERROR",
    error: "COMPOSER_NOT_FOUND",
  });
};

const scanComposerSafely = (): void => {
  try {
    scanComposer();
  } catch {
    resetAfterFailedRecoveryScan();
  }
};

const invalidateAfterUncertainWrite = (): void => {
  writeInProgress = false;
  draftSession.markDraftChanged();
  selectionController.discard();
  discardUndo("CONTEXT_CHANGED");
  scanComposerSafely();
};

selectionController = new SelectionController({
  findComposer: () => findNativeComposer(document),
  getDraft: currentUndoDraftState,
  getUrl: () => window.location.href,
  onState: (state) => {
    broadcast(state);
    if (state.state === "READY" && composer) {
      manualMaskShortcut?.show(composer, state.selectionId);
    } else {
      manualMaskShortcut?.hide();
    }
  },
  onStaleContext: scheduleScan,
  shouldPreserveSelection: (event) =>
    manualMaskShortcut?.containsEvent(event) ?? false,
});

const commitMaskingPlan = (
  plan: MaskingPlan,
  before: UndoDraftState,
  previousCaret: number,
  count: number,
): number | null => {
  if (
    !composer ||
    before.sessionId !== draftSession.sessionId ||
    plan.text.length > MAX_TEXT_LENGTH ||
    !hasCurrentComposerContext()
  ) {
    return null;
  }
  const restorePoint = captureComposerRestorePoint(
    composer,
    before.text,
    previousCaret,
  );
  if (!restorePoint) return null;
  writeInProgress = true;
  try {
    if (
      before.sessionId !== draftSession.sessionId ||
      !hasCurrentComposerContext()
    ) {
      throw new Error("STALE_MASK");
    }
    const expectedStructure: ComposerStructureSignature = writeComposerText(
      composer,
      plan.text,
      plan.caret,
      plan.edits,
    );
    if (
      readComposerText(composer) !== plan.text ||
      readComposerStructure(composer) !== expectedStructure
    ) {
      throw new Error("UNCONFIRMED_MASK");
    }
    scanComposer();
    if (
      before.sessionId !== draftSession.sessionId ||
      lastHostStatus.state !== "READY" ||
      currentText !== plan.text ||
      currentStructure !== expectedStructure
    ) {
      throw new Error("UNCONFIRMED_MASK");
    }
    const after = currentUndoDraftState();
    if (!after) throw new Error("MISSING_UNDO_STATE");
    const operationId = nextOperationId++;
    undoRecord = createUndoRecord(
      operationId,
      before,
      after,
      restorePoint,
      previousCaret,
      count,
    );
    return operationId;
  } catch {
    invalidateAfterUncertainWrite();
    return null;
  } finally {
    writeInProgress = false;
  }
};

const maskDetections = (message: unknown): void => {
  const prepared = prepareMaskCommand(
    message,
    draftSession.sessionId,
    revision,
    currentText,
    detections,
  );
  if (prepared.status === "INVALID") return;
  selectionController.discard();
  if (prepared.status === "STALE" || !hasCurrentComposerContext()) {
    scanComposerSafely();
    broadcastMaskError(prepared.command, "STALE_TEXT");
    return;
  }
  if (prepared.status === "FAILED" || !composer) {
    broadcastMaskError(prepared.command, "MASK_FAILED");
    return;
  }

  if (!hasCurrentComposerContext()) {
    scanComposerSafely();
    broadcastMaskError(prepared.command, "STALE_TEXT");
    return;
  }

  const before = currentUndoDraftState();
  if (!before) {
    broadcastMaskError(prepared.command, "MASK_FAILED");
    return;
  }
  const previousCaret = readComposerCaret(composer);
  const operationId = commitMaskingPlan(
    prepared.plan,
    before,
    previousCaret,
    prepared.command.detectionIds.length,
  );
  if (operationId === null) {
    broadcastMaskError(prepared.command, "MASK_FAILED");
    return;
  }
  broadcast({
    type: "MASK_RESULT",
    status: "SUCCESS",
    sessionId: prepared.command.sessionId,
    requestRevision: prepared.command.revision,
    detectionIds: [...prepared.command.detectionIds],
    resultRevision: revision,
    remainingDetections: detections.length,
    undoOperationId: operationId,
  });
};

const broadcastManualMaskError = (
  command: ManualMaskCommand,
  error: "MASK_FAILED" | "STALE_SELECTION",
): void => {
  broadcast({
    type: "MANUAL_MASK_RESULT",
    status: "ERROR",
    selectionId: command.selectionId,
    error,
  });
};

const maskSelection = (command: ManualMaskCommand): void => {
  const record = selectionController.record;
  const current = currentUndoDraftState();
  if (
    writeInProgress ||
    !record ||
    record.selectionId !== command.selectionId ||
    !current ||
    !matchesSelectionDraft(record, current) ||
    !hasCurrentComposerContext()
  ) {
    selectionController.discard();
    scanComposerSafely();
    broadcastManualMaskError(command, "STALE_SELECTION");
    return;
  }
  const prepared = createManualMaskingPlan(currentText, record);
  if (prepared.status !== "READY") {
    selectionController.discard();
    broadcastManualMaskError(command, "MASK_FAILED");
    return;
  }
  const previousCaret = readComposerCaret(record.composer);
  selectionController.discard();
  const operationId = commitMaskingPlan(
    prepared.plan,
    current,
    previousCaret,
    1,
  );
  if (operationId === null) {
    broadcastManualMaskError(command, "MASK_FAILED");
    return;
  }
  broadcast({
    type: "MANUAL_MASK_RESULT",
    status: "SUCCESS",
    selectionId: command.selectionId,
    resultRevision: revision,
    remainingDetections: detections.length,
    undoOperationId: operationId,
  });
};

manualMaskShortcut = new ManualMaskShortcut((selectionId) => {
  const record = selectionController.record;
  if (writeInProgress || !record || record.selectionId !== selectionId) {
    selectionController.discard();
    return;
  }
  broadcast({ type: "MANUAL_MASK_STARTED", selectionId });
  maskSelection({ type: "MASK_SELECTION", selectionId });
});

const broadcastUndoError = (command: UndoCommand): void => {
  broadcast({
    type: "UNDO_RESULT",
    status: "ERROR",
    operationId: command.operationId,
    error: "UNDO_FAILED",
  });
};

const undoMasking = (command: UndoCommand): void => {
  selectionController.discard();
  const record = undoRecord;
  const current = currentUndoDraftState();
  if (
    writeInProgress ||
    !record ||
    record.operationId !== command.operationId ||
    !current ||
    !matchesUndoDraft(record, current) ||
    !hasCurrentComposerContext()
  ) {
    if (record?.operationId === command.operationId) {
      markIndependentChange();
      scanComposerSafely();
    }
    broadcastUndoError(command);
    return;
  }

  writeInProgress = true;
  try {
    if (!matchesUndoDraft(record, current) || !hasCurrentComposerContext()) {
      throw new Error("STALE_UNDO");
    }
    const expectedStructure: ComposerStructureSignature = restoreComposerText(
      record.composer,
      record.restorePoint,
    );
    if (
      readComposerText(record.composer) !== record.previousText ||
      readComposerStructure(record.composer) !== expectedStructure
    ) {
      throw new Error("UNCONFIRMED_UNDO");
    }
    scanComposer();
    if (
      lastHostStatus.state !== "READY" ||
      currentText !== record.previousText ||
      currentStructure !== expectedStructure
    ) {
      throw new Error("UNCONFIRMED_UNDO");
    }
    undoRecord = null;
  } catch {
    invalidateAfterUncertainWrite();
    broadcastUndoError(command);
    return;
  } finally {
    writeInProgress = false;
  }
  broadcast({
    type: "UNDO_RESULT",
    status: "SUCCESS",
    operationId: command.operationId,
    resultRevision: revision,
  });
};

const handlePanelCommand = (message: unknown): void => {
  if (!isPanelCommand(message)) return;
  if (message.type === "MASK_DETECTIONS") maskDetections(message);
  if (message.type === "MASK_SELECTION") maskSelection(message);
  if (message.type === "UNDO_MASK") undoMasking(message);
};

const activate = (): void => {
  if (observer) return;
  manualMaskShortcut?.mount();
  document.addEventListener("input", handleInput, true);
  document.addEventListener("submit", handleSubmit, true);
  document.addEventListener("select", selectionController.handleGesture, true);
  document.addEventListener(
    "pointerup",
    selectionController.handleGesture,
    true,
  );
  document.addEventListener("keyup", selectionController.handleGesture, true);
  document.addEventListener(
    "selectionchange",
    selectionController.handleSelectionChange,
    true,
  );
  observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  scanComposerSafely();
  if (composer) selectionController.capture(composer);
};

const deactivate = (): void => {
  document.removeEventListener("input", handleInput, true);
  document.removeEventListener("submit", handleSubmit, true);
  document.removeEventListener(
    "select",
    selectionController.handleGesture,
    true,
  );
  document.removeEventListener(
    "pointerup",
    selectionController.handleGesture,
    true,
  );
  document.removeEventListener(
    "keyup",
    selectionController.handleGesture,
    true,
  );
  document.removeEventListener(
    "selectionchange",
    selectionController.handleSelectionChange,
    true,
  );
  observer?.disconnect();
  manualMaskShortcut?.unmount();
  observer = null;
  composer = null;
  sourceUrl = "";
  draftSession.startNewContext();
  currentText = "";
  currentStructure = null;
  revision = 0;
  detections = [];
  lastHostStatus = { type: "HOST_STATUS", state: "SEARCHING" };
  lastSnapshot = null;
  writeInProgress = false;
  selectionController.reset();
  discardUndo("CONTEXT_CHANGED", false);
};

const isTrustedPanelPort = (port: chrome.runtime.Port): boolean =>
  port.name === PANEL_CONTENT_PORT &&
  port.sender?.id === chrome.runtime.id &&
  port.sender.url === chrome.runtime.getURL("side-panel.html");

chrome.runtime.onConnect.addListener((port) => {
  if (!isTrustedPanelPort(port)) {
    if (port.name === PANEL_CONTENT_PORT) port.disconnect();
    return;
  }

  const shouldActivate = panelPorts.size === 0;
  panelPorts.add(port);
  if (shouldActivate) {
    activate();
  } else {
    draftSession.startNewContext();
    selectionController.discard();
    discardUndo("CONTEXT_CHANGED");
    lastSnapshot = null;
    broadcast({ type: "HOST_STATUS", state: "SEARCHING" });
    scanComposerSafely();
  }
  port.onMessage.addListener(handlePanelCommand);
  port.onDisconnect.addListener(() => {
    panelPorts.delete(port);
    if (panelPorts.size === 0) deactivate();
  });
});
