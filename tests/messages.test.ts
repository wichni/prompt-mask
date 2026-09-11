import { describe, expect, it } from "vitest";
import {
  isPanelCommand,
  isPanelEvent,
  isSupportedChatGptUrl,
} from "../src/platform/chromium/messages";

const sessionId = "00000000-0000-4000-8000-000000000001";

describe("panel message boundary", () => {
  it("accepts a redacted analysis snapshot", () => {
    expect(
      isPanelEvent({
        type: "ANALYSIS_SNAPSHOT",
        sessionId,
        revision: 2,
        length: 60,
        detections: [
          {
            id: "PATIENT_NAME:10:22",
            kind: "PATIENT_NAME",
            maskedPreview: "•••",
          },
          {
            id: "PATIENT_ID:35:44",
            kind: "PATIENT_ID",
            maskedPreview: "•••",
          },
          {
            id: "PATIENT_FIRST_NAME:45:48",
            kind: "PATIENT_FIRST_NAME",
            maskedPreview: "•••",
          },
          {
            id: "PATIENT_LAST_NAME:49:57",
            kind: "PATIENT_LAST_NAME",
            maskedPreview: "•••",
          },
          {
            id: "PASSWORD:20:33",
            kind: "PASSWORD",
            maskedPreview: "•••",
          },
        ],
      }),
    ).toBe(true);
    expect(
      isPanelEvent({
        type: "ANALYSIS_SNAPSHOT",
        sessionId,
        revision: 2,
        length: 10,
        detections: [
          { id: "SECRET:0:6", kind: "SECRET", maskedPreview: "•••" },
        ],
      }),
    ).toBe(true);
  });

  it("rejects an analysis snapshot containing raw text", () => {
    expect(
      isPanelEvent({
        type: "ANALYSIS_SNAPSHOT",
        sessionId,
        revision: 2,
        length: 31,
        detections: [],
        text: "must not cross",
      }),
    ).toBe(false);
  });

  it("accepts only an exact mask command", () => {
    const command = {
      type: "MASK_DETECTIONS",
      sessionId,
      revision: 2,
      detectionIds: ["PESEL:7:18"],
    };

    expect(isPanelCommand(command)).toBe(true);
    expect(
      isPanelCommand({
        ...command,
        detectionIds: [
          "PATIENT_FIRST_NAME:1:4",
          "PATIENT_LAST_NAME:5:13",
          "PASSWORD:14:27",
        ],
      }),
    ).toBe(true);
    expect(isPanelCommand({ ...command, text: "leak" })).toBe(false);
    expect(isPanelCommand({ ...command, detectionIds: [] })).toBe(false);
    expect(
      isPanelCommand({ ...command, detectionIds: ["SECRET:7:18"] }),
    ).toBe(true);
    expect(
      isPanelCommand({ ...command, detectionIds: ["PATIENT_ID:18:7"] }),
    ).toBe(false);
    expect(isPanelCommand({ ...command, sessionId: "reused-counter" })).toBe(
      false,
    );
    expect(
      isPanelCommand({
        ...command,
        detectionIds: ["PESEL:7:18", "PESEL:7:18"],
      }),
    ).toBe(false);
  });

  it("accepts only an exact undo command", () => {
    const command = { type: "UNDO_MASK", operationId: 7 };

    expect(isPanelCommand(command)).toBe(true);
    expect(isPanelCommand({ ...command, originalText: "must not cross" })).toBe(
      false,
    );
    expect(isPanelCommand({ ...command, operationId: -1 })).toBe(false);
  });

  it("accepts only payload-free manual-selection messages", () => {
    const command = { type: "MASK_SELECTION", selectionId: 7 };
    const ready = {
      type: "SELECTION_STATE",
      state: "READY",
      selectionId: 7,
    };
    const success = {
      type: "MANUAL_MASK_RESULT",
      status: "SUCCESS",
      selectionId: 7,
      resultRevision: 3,
      remainingDetections: 0,
      undoOperationId: 2,
    };

    expect(isPanelCommand(command)).toBe(true);
    expect(isPanelCommand({ ...command, selectedText: "must not cross" })).toBe(
      false,
    );
    expect(isPanelEvent(ready)).toBe(true);
    expect(isPanelEvent({ ...ready, preview: "must not cross" })).toBe(false);
    expect(isPanelEvent(success)).toBe(true);
    expect(isPanelEvent({ ...success, originalText: "must not cross" })).toBe(
      false,
    );
    expect(
      isPanelEvent({
        type: "SELECTION_STATE",
        state: "INVALID",
        reason: "PLACEHOLDER_OVERLAP",
      }),
    ).toBe(true);
    expect(
      isPanelEvent({ type: "MANUAL_MASK_STARTED", selectionId: 7 }),
    ).toBe(true);
    expect(
      isPanelEvent({
        type: "MANUAL_MASK_STARTED",
        selectionId: 7,
        selectedText: "must not cross",
      }),
    ).toBe(false);
  });

  it("accepts only payload-free masking results", () => {
    const result = {
      type: "MASK_RESULT",
      status: "SUCCESS",
      sessionId,
      requestRevision: 2,
      detectionIds: ["EMAIL:10:31"],
      resultRevision: 3,
      remainingDetections: 1,
      undoOperationId: 4,
    };

    expect(isPanelEvent(result)).toBe(true);
    expect(isPanelEvent({ ...result, originalValue: "must not cross" })).toBe(
      false,
    );
    expect(
      isPanelEvent({
        type: "MASK_RESULT",
        status: "ERROR",
        sessionId,
        requestRevision: 2,
        detectionIds: ["EMAIL:10:31"],
        error: "STALE_TEXT",
      }),
    ).toBe(true);
    expect(
      isPanelEvent({
        type: "UNDO_RESULT",
        status: "SUCCESS",
        operationId: 4,
        resultRevision: 5,
      }),
    ).toBe(true);
    expect(
      isPanelEvent({
        type: "UNDO_INVALIDATED",
        operationId: 4,
        reason: "DRAFT_CHANGED",
      }),
    ).toBe(true);
    expect(
      isPanelEvent({
        type: "UNDO_RESULT",
        status: "SUCCESS",
        operationId: 4,
        resultRevision: 5,
        originalText: "must not cross",
      }),
    ).toBe(false);
  });

  it("recognizes only the exact ChatGPT origin", () => {
    expect(isSupportedChatGptUrl("https://chatgpt.com/")).toBe(true);
    expect(isSupportedChatGptUrl("https://chatgpt.com.example.org/")).toBe(false);
    expect(isSupportedChatGptUrl("https://chatgpt.com:8443/")).toBe(false);
  });
});
