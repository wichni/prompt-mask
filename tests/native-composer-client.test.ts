import { afterEach, describe, expect, it, vi } from "vitest";
import type { PanelEvent } from "../src/platform/chromium/messages";
import { PANEL_VIEW_READY } from "../src/platform/chromium/side-panel-signals";
import { watchNativeComposer } from "../src/app/native-composer-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("native composer client", () => {
  it("consumes the expected runtime error when no content script receives the port", async () => {
    let disconnectListener: (() => void) | undefined;
    const lastErrorRead = vi.fn(() => ({
      message: "Could not establish connection. Receiving end does not exist.",
    }));
    const port = {
      disconnect: vi.fn(),
      postMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      onDisconnect: {
        addListener: (listener: () => void) => {
          disconnectListener = listener;
        },
      },
    };
    const runtime = {
      get lastError() {
        return lastErrorRead();
      },
    };
    const events: PanelEvent[] = [];
    vi.stubGlobal("chrome", {
      runtime,
      tabs: {
        query: vi.fn(async () => [
          { id: 7, url: "https://chatgpt.com/" },
        ]),
        connect: vi.fn(() => port),
        onActivated: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        onUpdated: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    });

    const session = watchNativeComposer((event) => events.push(event));
    await vi.waitFor(() => expect(disconnectListener).toBeTypeOf("function"));
    expect(port.postMessage).toHaveBeenCalledWith(PANEL_VIEW_READY);
    disconnectListener?.();

    expect(lastErrorRead).toHaveBeenCalledOnce();
    expect(events.at(-1)).toEqual({
      type: "HOST_STATUS",
      state: "ERROR",
      error: "CONTENT_SCRIPT_UNAVAILABLE",
    });
    session.disconnect();
  });
});
