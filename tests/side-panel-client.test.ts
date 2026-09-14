import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeCurrentSidePanel,
  requestOpenSidePanel,
} from "../src/platform/chromium/side-panel-client";
import { OPEN_PANEL_REQUEST } from "../src/platform/chromium/side-panel-signals";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("side panel client", () => {
  it("accepts only the exact success response when opening", async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({
        type: "OPEN_PROMPT_MASK_PANEL_RESULT",
        status: "OPENED",
      })
      .mockResolvedValueOnce({
        type: "OPEN_PROMPT_MASK_PANEL_RESULT",
        status: "OPENED",
        tabId: 7,
      });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });

    await expect(requestOpenSidePanel()).resolves.toBe(true);
    await expect(requestOpenSidePanel()).resolves.toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(OPEN_PANEL_REQUEST);
  });

  it("closes the global panel in the current window", async () => {
    const close = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", {
      windows: { getCurrent: vi.fn(async () => ({ id: 12 })) },
      sidePanel: { close },
    });

    await expect(closeCurrentSidePanel()).resolves.toBe(true);
    expect(close).toHaveBeenCalledWith({ windowId: 12 });
  });

  it("does not claim success after a rejected close", async () => {
    vi.stubGlobal("chrome", {
      windows: { getCurrent: vi.fn(async () => ({ id: 12 })) },
      sidePanel: { close: vi.fn(async () => Promise.reject(new Error("no"))) },
    });

    await expect(closeCurrentSidePanel()).resolves.toBe(false);
  });
});
