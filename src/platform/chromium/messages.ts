import type { DetectionKind } from "../../core/detection";

export const MAX_TEXT_LENGTH = 12_000;
export const PANEL_CONTENT_PORT = "PROMPT_MASK_PANEL_CONTENT_V7";

export interface DetectionSummary {
  id: string;
  kind: DetectionKind;
  maskedPreview: string;
}

export type HostStatus =
  | { type: "HOST_STATUS"; state: "SEARCHING" | "READY" }
  | {
      type: "HOST_STATUS";
      state: "ERROR";
      error:
        | "COMPOSER_NOT_FOUND"
        | "CONTENT_SCRIPT_UNAVAILABLE"
        | "TEXT_TOO_LONG"
        | "UNSUPPORTED_TAB";
    };

export interface AnalysisSnapshot {
  type: "ANALYSIS_SNAPSHOT";
  revision: number;
  length: number;
  detections: DetectionSummary[];
}

export type SelectionState =
  | { type: "SELECTION_STATE"; state: "NONE" }
  | { type: "SELECTION_STATE"; state: "READY"; selectionId: number }
  | {
      type: "SELECTION_STATE";
      state: "INVALID";
      reason: "PLACEHOLDER_OVERLAP";
    };

export type MaskResult =
  | {
      type: "MASK_RESULT";
      status: "SUCCESS";
      requestRevision: number;
      detectionIds: string[];
      resultRevision: number;
      remainingDetections: number;
      undoOperationId: number;
    }
  | {
      type: "MASK_RESULT";
      status: "ERROR";
      requestRevision: number;
      detectionIds: string[];
      error: "MASK_FAILED" | "STALE_TEXT";
    };

export type UndoResult =
  | {
      type: "UNDO_RESULT";
      status: "SUCCESS";
      operationId: number;
      resultRevision: number;
    }
  | {
      type: "UNDO_RESULT";
      status: "ERROR";
      operationId: number;
      error: "UNDO_FAILED";
    };

export type ManualMaskResult =
  | {
      type: "MANUAL_MASK_RESULT";
      status: "SUCCESS";
      selectionId: number;
      resultRevision: number;
      remainingDetections: number;
      undoOperationId: number;
    }
  | {
      type: "MANUAL_MASK_RESULT";
      status: "ERROR";
      selectionId: number;
      error: "MASK_FAILED" | "STALE_SELECTION";
    };

export interface ManualMaskStarted {
  type: "MANUAL_MASK_STARTED";
  selectionId: number;
}

export interface UndoInvalidated {
  type: "UNDO_INVALIDATED";
  operationId: number;
  reason: "DRAFT_CHANGED" | "CONTEXT_CHANGED";
}

export type PanelEvent =
  | HostStatus
  | AnalysisSnapshot
  | SelectionState
  | MaskResult
  | ManualMaskStarted
  | ManualMaskResult
  | UndoResult
  | UndoInvalidated;

export type MaskCommand = {
  type: "MASK_DETECTIONS";
  revision: number;
  detectionIds: string[];
};

export type UndoCommand = {
  type: "UNDO_MASK";
  operationId: number;
};

export type ManualMaskCommand = {
  type: "MASK_SELECTION";
  selectionId: number;
};

export type PanelCommand = MaskCommand | ManualMaskCommand | UndoCommand;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean => {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => expectedKeys.includes(key))
  );
};

const isSafeCounter = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

const isDetectionKind = (value: unknown): value is DetectionKind =>
  value === "PESEL" || value === "EMAIL" || value === "PHONE";

const isDetectionSummary = (value: unknown): value is DetectionSummary =>
  isRecord(value) &&
  hasExactKeys(value, ["id", "kind", "maskedPreview"]) &&
  typeof value.id === "string" &&
  isDetectionKind(value.kind) &&
  value.id.startsWith(`${value.kind}:`) &&
  /^[A-Z]+:\d+:\d+$/u.test(value.id) &&
  typeof value.maskedPreview === "string" &&
  value.maskedPreview.length <= 80;

const isDetectionIds = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= MAX_TEXT_LENGTH &&
  new Set(value).size === value.length &&
  value.every(
    (detectionId) =>
      typeof detectionId === "string" &&
      /^[A-Z]+:\d+:\d+$/u.test(detectionId),
  );

export const isSupportedChatGptUrl = (value: string): boolean => {
  try {
    return new URL(value).origin === "https://chatgpt.com";
  } catch {
    return false;
  }
};

export const isPanelEvent = (value: unknown): value is PanelEvent => {
  if (!isRecord(value)) return false;
  if (value.type === "SELECTION_STATE") {
    if (value.state === "NONE") return hasExactKeys(value, ["type", "state"]);
    if (value.state === "READY") {
      return (
        hasExactKeys(value, ["type", "state", "selectionId"]) &&
        isSafeCounter(value.selectionId)
      );
    }
    return (
      value.state === "INVALID" &&
      hasExactKeys(value, ["type", "state", "reason"]) &&
      value.reason === "PLACEHOLDER_OVERLAP"
    );
  }
  if (value.type === "ANALYSIS_SNAPSHOT") {
    return (
      hasExactKeys(value, ["type", "revision", "length", "detections"]) &&
      isSafeCounter(value.revision) &&
      isSafeCounter(value.length) &&
      Number(value.length) <= MAX_TEXT_LENGTH &&
      Array.isArray(value.detections) &&
      value.detections.length <= MAX_TEXT_LENGTH &&
      value.detections.every(isDetectionSummary)
    );
  }
  if (value.type === "MASK_RESULT") {
    const hasRequestData =
      isSafeCounter(value.requestRevision) &&
      isDetectionIds(value.detectionIds);
    if (!hasRequestData) return false;
    if (value.status === "ERROR") {
      return (
        hasExactKeys(value, [
          "type",
          "status",
          "requestRevision",
          "detectionIds",
          "error",
        ]) &&
        (value.error === "MASK_FAILED" || value.error === "STALE_TEXT")
      );
    }
    return (
      value.status === "SUCCESS" &&
      hasExactKeys(value, [
        "type",
        "status",
        "requestRevision",
        "detectionIds",
        "resultRevision",
        "remainingDetections",
        "undoOperationId",
      ]) &&
      isSafeCounter(value.resultRevision) &&
      isSafeCounter(value.remainingDetections) &&
      Number(value.remainingDetections) <= MAX_TEXT_LENGTH &&
      isSafeCounter(value.undoOperationId)
    );
  }
  if (value.type === "MANUAL_MASK_RESULT") {
    if (!isSafeCounter(value.selectionId)) return false;
    if (value.status === "ERROR") {
      return (
        hasExactKeys(value, ["type", "status", "selectionId", "error"]) &&
        (value.error === "MASK_FAILED" || value.error === "STALE_SELECTION")
      );
    }
    return (
      value.status === "SUCCESS" &&
      hasExactKeys(value, [
        "type",
        "status",
        "selectionId",
        "resultRevision",
        "remainingDetections",
        "undoOperationId",
      ]) &&
      isSafeCounter(value.resultRevision) &&
      isSafeCounter(value.remainingDetections) &&
      Number(value.remainingDetections) <= MAX_TEXT_LENGTH &&
      isSafeCounter(value.undoOperationId)
    );
  }
  if (value.type === "MANUAL_MASK_STARTED") {
    return (
      hasExactKeys(value, ["type", "selectionId"]) &&
      isSafeCounter(value.selectionId)
    );
  }
  if (value.type === "UNDO_RESULT") {
    if (!isSafeCounter(value.operationId)) return false;
    if (value.status === "SUCCESS") {
      return (
        hasExactKeys(value, [
          "type",
          "status",
          "operationId",
          "resultRevision",
        ]) && isSafeCounter(value.resultRevision)
      );
    }
    return (
      value.status === "ERROR" &&
      hasExactKeys(value, ["type", "status", "operationId", "error"]) &&
      value.error === "UNDO_FAILED"
    );
  }
  if (value.type === "UNDO_INVALIDATED") {
    return (
      hasExactKeys(value, ["type", "operationId", "reason"]) &&
      isSafeCounter(value.operationId) &&
      (value.reason === "DRAFT_CHANGED" ||
        value.reason === "CONTEXT_CHANGED")
    );
  }
  if (value.type !== "HOST_STATUS") return false;
  if (value.state === "SEARCHING" || value.state === "READY") {
    return hasExactKeys(value, ["type", "state"]);
  }
  return (
    value.state === "ERROR" &&
    hasExactKeys(value, ["type", "state", "error"]) &&
    (value.error === "COMPOSER_NOT_FOUND" ||
      value.error === "CONTENT_SCRIPT_UNAVAILABLE" ||
      value.error === "TEXT_TOO_LONG" ||
      value.error === "UNSUPPORTED_TAB")
  );
};

export const isPanelCommand = (value: unknown): value is PanelCommand =>
  isRecord(value) &&
  ((hasExactKeys(value, ["type", "revision", "detectionIds"]) &&
    value.type === "MASK_DETECTIONS" &&
    isSafeCounter(value.revision) &&
    isDetectionIds(value.detectionIds)) ||
    (hasExactKeys(value, ["type", "selectionId"]) &&
      value.type === "MASK_SELECTION" &&
      isSafeCounter(value.selectionId)) ||
    (hasExactKeys(value, ["type", "operationId"]) &&
      value.type === "UNDO_MASK" &&
      isSafeCounter(value.operationId)));
