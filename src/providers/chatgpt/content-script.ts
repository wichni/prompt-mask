import type { SensitiveDetection } from "../../core/detection";
import { createMaskedPreview } from "../../core/masking";
import { detectSensitiveData } from "../../detectors/sensitive-data";
import {
  MAX_TEXT_LENGTH,
  PANEL_CONTENT_PORT,
  isPanelCommand,
  type AnalysisSnapshot,
  type HostStatus,
  type MaskCommand,
  type PanelEvent,
  type UndoCommand,
} from "../../platform/chromium/messages";
import {
  findNativeComposer,
  readComposerCaret,
  readComposerText,
  writeComposerText,
} from "./native-composer";
import { prepareMaskCommand } from "./masking-command";
import {
  createUndoRecord,
  matchesUndoDraft,
  type UndoDraftState,
  type UndoRecord,
} from "./undo-record";

const panelPorts = new Set<chrome.runtime.Port>();
let observer: MutationObserver | null = null;
let scheduled = false;
let composer: HTMLElement | null = null;
let sourceUrl = "";
let currentText = "";
let revision = 0;
let detections: SensitiveDetection[] = [];
let lastHostStatus: HostStatus = { type: "HOST_STATUS", state: "SEARCHING" };
let lastSnapshot: AnalysisSnapshot | null = null;
let contextGeneration = 0;
let changeGeneration = 0;
let nextOperationId = 1;
let undoRecord: UndoRecord | null = null;
let writeInProgress = false;

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
        composer,
        sourceUrl,
        contextGeneration,
        changeGeneration,
        revision,
        text: currentText,
      }
    : null;

const markIndependentChange = (): void => {
  changeGeneration += 1;
  discardUndo("DRAFT_CHANGED");
};

const detectionId = (detection: SensitiveDetection): string =>
  `${detection.kind}:${detection.start}:${detection.end}`;

const createSnapshot = (): AnalysisSnapshot => ({
  type: "ANALYSIS_SNAPSHOT",
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
    contextGeneration += 1;
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
    contextGeneration += 1;
    discardUndo("CONTEXT_CHANGED");
    composer = nextComposer;
    sourceUrl = nextSourceUrl;
    currentText = "";
    revision = 0;
    detections = [];
    if (hadSource) broadcast({ type: "HOST_STATUS", state: "SEARCHING" });
  }

  const nextText = readComposerText(nextComposer);
  if (nextText.length > MAX_TEXT_LENGTH) {
    if (!writeInProgress && nextText !== currentText) markIndependentChange();
    lastSnapshot = null;
    broadcast({ type: "HOST_STATUS", state: "ERROR", error: "TEXT_TOO_LONG" });
    return;
  }

  const textChanged = nextText !== currentText;
  if (textChanged) {
    if (!writeInProgress) markIndependentChange();
    currentText = nextText;
    revision += 1;
    detections = detectSensitiveData(currentText);
  }

  if (!textChanged && lastHostStatus.state === "READY") return;
  broadcast({ type: "HOST_STATUS", state: "READY" });
  broadcast(createSnapshot());
};

const scheduleScan = (): void => {
  if (scheduled || panelPorts.size === 0) return;
  scheduled = true;
  requestAnimationFrame(scanComposer);
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
        contextGeneration += 1;
        changeGeneration += 1;
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
    contextGeneration += 1;
    changeGeneration += 1;
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
    requestRevision: command.revision,
    detectionIds: [...command.detectionIds],
    error,
  });
};

const hasCurrentComposerContext = (): boolean =>
  composer !== null &&
  window.location.href === sourceUrl &&
  findNativeComposer(document) === composer &&
  readComposerText(composer) === currentText;

const invalidateAfterUncertainWrite = (): void => {
  writeInProgress = false;
  changeGeneration += 1;
  discardUndo("CONTEXT_CHANGED");
  scanComposer();
};

const maskDetections = (message: unknown): void => {
  const prepared = prepareMaskCommand(
    message,
    revision,
    currentText,
    detections,
  );
  if (prepared.status === "INVALID") return;
  if (prepared.status === "STALE" || !hasCurrentComposerContext()) {
    scanComposer();
    broadcastMaskError(prepared.command, "STALE_TEXT");
    return;
  }
  if (prepared.status === "FAILED" || !composer) {
    broadcastMaskError(prepared.command, "MASK_FAILED");
    return;
  }

  if (!hasCurrentComposerContext()) {
    scanComposer();
    broadcastMaskError(prepared.command, "STALE_TEXT");
    return;
  }

  const before = currentUndoDraftState();
  if (!before) {
    broadcastMaskError(prepared.command, "MASK_FAILED");
    return;
  }
  const previousCaret = readComposerCaret(composer);
  writeInProgress = true;
  try {
    writeComposerText(composer, prepared.plan.text, prepared.plan.caret);
  } catch {
    invalidateAfterUncertainWrite();
    broadcastMaskError(prepared.command, "MASK_FAILED");
    return;
  }

  if (readComposerText(composer) !== prepared.plan.text) {
    invalidateAfterUncertainWrite();
    broadcastMaskError(prepared.command, "MASK_FAILED");
    return;
  }

  scanComposer();
  if (
    lastHostStatus.state !== "READY" ||
    currentText !== prepared.plan.text
  ) {
    invalidateAfterUncertainWrite();
    broadcastMaskError(prepared.command, "MASK_FAILED");
    return;
  }
  const operationId = nextOperationId++;
  undoRecord = createUndoRecord(
    operationId,
    before,
    revision,
    prepared.plan.text,
    previousCaret,
    prepared.command.detectionIds.length,
  );
  writeInProgress = false;
  broadcast({
    type: "MASK_RESULT",
    status: "SUCCESS",
    requestRevision: prepared.command.revision,
    detectionIds: [...prepared.command.detectionIds],
    resultRevision: revision,
    remainingDetections: detections.length,
    undoOperationId: operationId,
  });
};

const broadcastUndoError = (command: UndoCommand): void => {
  broadcast({
    type: "UNDO_RESULT",
    status: "ERROR",
    operationId: command.operationId,
    error: "UNDO_FAILED",
  });
};

const undoMasking = (command: UndoCommand): void => {
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
      scanComposer();
    }
    broadcastUndoError(command);
    return;
  }

  writeInProgress = true;
  try {
    if (!matchesUndoDraft(record, current) || !hasCurrentComposerContext()) {
      throw new Error("STALE_UNDO");
    }
    writeComposerText(record.composer, record.previousText, record.previousCaret);
  } catch {
    invalidateAfterUncertainWrite();
    broadcastUndoError(command);
    return;
  }

  if (readComposerText(record.composer) !== record.previousText) {
    invalidateAfterUncertainWrite();
    broadcastUndoError(command);
    return;
  }
  scanComposer();
  if (lastHostStatus.state !== "READY" || currentText !== record.previousText) {
    invalidateAfterUncertainWrite();
    broadcastUndoError(command);
    return;
  }

  undoRecord = null;
  writeInProgress = false;
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
  if (message.type === "UNDO_MASK") undoMasking(message);
};

const activate = (): void => {
  if (observer) return;
  document.addEventListener("input", handleInput, true);
  document.addEventListener("submit", handleSubmit, true);
  observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  scanComposer();
};

const deactivate = (): void => {
  document.removeEventListener("input", handleInput, true);
  document.removeEventListener("submit", handleSubmit, true);
  observer?.disconnect();
  observer = null;
  composer = null;
  sourceUrl = "";
  currentText = "";
  revision = 0;
  detections = [];
  lastHostStatus = { type: "HOST_STATUS", state: "SEARCHING" };
  lastSnapshot = null;
  writeInProgress = false;
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
    postToPanel(port, lastHostStatus);
    if (lastSnapshot) postToPanel(port, lastSnapshot);
  }
  port.onMessage.addListener(handlePanelCommand);
  port.onDisconnect.addListener(() => {
    panelPorts.delete(port);
    if (panelPorts.size === 0) deactivate();
  });
});
