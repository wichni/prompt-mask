import { describe, expect, it } from "vitest";
import {
  isPanelCommand,
  isPanelEvent,
  isSupportedChatGptUrl,
} from "../src/platform/chromium/messages";

describe("panel message boundary", () => {
  it("accepts a redacted analysis snapshot", () => {
    expect(
      isPanelEvent({
        type: "ANALYSIS_SNAPSHOT",
        revision: 2,
        length: 31,
        detections: [
          { id: "EMAIL:10:31", kind: "EMAIL", maskedPreview: "a•••@e•••.com" },
        ],
      }),
    ).toBe(true);
  });

  it("rejects an analysis snapshot containing raw text", () => {
    expect(
      isPanelEvent({
        type: "ANALYSIS_SNAPSHOT",
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
      revision: 2,
      detectionIds: ["PESEL:7:18"],
    };

    expect(isPanelCommand(command)).toBe(true);
    expect(isPanelCommand({ ...command, text: "leak" })).toBe(false);
    expect(isPanelCommand({ ...command, detectionIds: [] })).toBe(false);
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

  it("accepts only payload-free masking results", () => {
    const result = {
      type: "MASK_RESULT",
      status: "SUCCESS",
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
