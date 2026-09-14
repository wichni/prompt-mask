import { describe, expect, it } from "vitest";
import { isPanelVisibilitySignal } from "../src/platform/chromium/side-panel-signals";

const sourceId = "b724b66e-0934-4388-b2f4-78c381667550";

describe("side panel visibility signals", () => {
  it("accepts only an exact ordered signal", () => {
    expect(
      isPanelVisibilitySignal({
        type: "PROMPT_MASK_PANEL_VISIBILITY",
        state: "OPEN",
        sourceId,
        sequence: 1,
      }),
    ).toBe(true);
    expect(
      isPanelVisibilitySignal({
        type: "PROMPT_MASK_PANEL_VISIBILITY",
        state: "CLOSED",
        sourceId,
        sequence: 1,
        url: "https://chatgpt.com/c/private",
      }),
    ).toBe(false);
  });

  it("rejects missing, malformed and non-positive ordering fields", () => {
    expect(
      isPanelVisibilitySignal({
        type: "PROMPT_MASK_PANEL_VISIBILITY",
        state: "CLOSED",
      }),
    ).toBe(false);
    expect(
      isPanelVisibilitySignal({
        type: "PROMPT_MASK_PANEL_VISIBILITY",
        state: "CLOSED",
        sourceId: "worker-1",
        sequence: 1,
      }),
    ).toBe(false);
    expect(
      isPanelVisibilitySignal({
        type: "PROMPT_MASK_PANEL_VISIBILITY",
        state: "CLOSED",
        sourceId,
        sequence: 0,
      }),
    ).toBe(false);
  });
});
