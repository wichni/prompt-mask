import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  OpenPanelResponse,
  PanelVisibilitySignal,
} from "../src/platform/chromium/side-panel-signals";

interface Listener<T> {
  value?: T;
}

const installed: Listener<() => void> = {};
const startup: Listener<() => void> = {};
const runtimeMessage: Listener<
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: OpenPanelResponse) => void,
  ) => boolean
> = {};
interface PanelLifecycleInfo {
  path: string;
  windowId: number;
}

const opened: Listener<(info: PanelLifecycleInfo) => void> = {};
const closed: Listener<(info: PanelLifecycleInfo) => void> = {};

const open = vi.fn(async () => undefined);
const setPanelBehavior = vi.fn(async () => undefined);
const query = vi.fn(async ({ windowId }: { windowId: number }) => [
  { id: windowId + 100 },
]);
const sendMessage = vi.fn(async () => undefined);

const trustedSender = (windowId: number): chrome.runtime.MessageSender => ({
  id: "prompt-mask-test",
  frameId: 0,
  url: "https://chatgpt.com/c/test",
  tab: {
    active: true,
    id: windowId + 10,
    index: 0,
    pinned: false,
    highlighted: true,
    incognito: false,
    windowId,
    url: "https://chatgpt.com/c/test",
  } as chrome.tabs.Tab,
});

const trustedSenderWithoutOptionalTabUrl = (
  windowId: number,
): chrome.runtime.MessageSender => ({
  id: "prompt-mask-test",
  frameId: 0,
  url: "https://chatgpt.com/c/test",
  tab: {
    id: windowId + 10,
    windowId,
  } as chrome.tabs.Tab,
});

beforeEach(async () => {
  vi.resetModules();
  open.mockReset().mockResolvedValue(undefined);
  setPanelBehavior.mockReset().mockResolvedValue(undefined);
  query.mockClear();
  sendMessage.mockClear();
  vi.stubGlobal("chrome", {
    runtime: {
      id: "prompt-mask-test",
      onInstalled: { addListener: (listener: () => void) => (installed.value = listener) },
      onStartup: { addListener: (listener: () => void) => (startup.value = listener) },
      onMessage: {
        addListener: (listener: typeof runtimeMessage.value) =>
          (runtimeMessage.value = listener),
      },
    },
    sidePanel: {
      open,
      setPanelBehavior,
      onOpened: {
        addListener: (listener: typeof opened.value) => (opened.value = listener),
      },
      onClosed: {
        addListener: (listener: typeof closed.value) => (closed.value = listener),
      },
    },
    tabs: { query, sendMessage },
  });
  await import("../src/platform/chromium/service-worker");
});

describe("side panel service worker", () => {
  it("opens the global panel in the trusted sender window without payload context", async () => {
    const responses: OpenPanelResponse[] = [];

    const keepChannelOpen = runtimeMessage.value?.(
      { type: "OPEN_PROMPT_MASK_PANEL" },
      trustedSender(4),
      (response) => responses.push(response),
    );
    await Promise.resolve();

    expect(keepChannelOpen).toBe(true);
    expect(open).toHaveBeenCalledWith({ windowId: 4 });
    expect(responses).toEqual([
      { type: "OPEN_PROMPT_MASK_PANEL_RESULT", status: "OPENED" },
    ]);
  });

  it("opens when Chrome omits optional tab URL metadata", async () => {
    const response = vi.fn();

    const keepChannelOpen = runtimeMessage.value?.(
      { type: "OPEN_PROMPT_MASK_PANEL" },
      trustedSenderWithoutOptionalTabUrl(7),
      response,
    );
    await Promise.resolve();

    expect(keepChannelOpen).toBe(true);
    expect(open).toHaveBeenCalledWith({ windowId: 7 });
    expect(response).toHaveBeenCalledWith({
      type: "OPEN_PROMPT_MASK_PANEL_RESULT",
      status: "OPENED",
    });
  });

  it("rejects extra fields, frames, missing tabs and unsupported origins", () => {
    const response = vi.fn();
    const sender = trustedSender(2);

    expect(
      runtimeMessage.value?.(
        { type: "OPEN_PROMPT_MASK_PANEL", tabId: 99 },
        sender,
        response,
      ),
    ).toBe(false);
    expect(
      runtimeMessage.value?.(
        { type: "OPEN_PROMPT_MASK_PANEL" },
        { ...sender, frameId: 1 },
        response,
      ),
    ).toBe(false);
    expect(
      runtimeMessage.value?.(
        { type: "OPEN_PROMPT_MASK_PANEL" },
        { ...sender, tab: undefined },
        response,
      ),
    ).toBe(false);
    expect(
      runtimeMessage.value?.(
        { type: "OPEN_PROMPT_MASK_PANEL" },
        { ...sender, url: "https://example.com/" },
        response,
      ),
    ).toBe(false);
    expect(
      runtimeMessage.value?.(
        { type: "OPEN_PROMPT_MASK_PANEL" },
        {
          ...sender,
          tab: { ...sender.tab!, url: "https://example.com/" },
        },
        response,
      ),
    ).toBe(false);

    expect(open).not.toHaveBeenCalled();
    expect(response).not.toHaveBeenCalled();
  });

  it("returns an explicit error when native opening fails", async () => {
    open.mockRejectedValueOnce(new Error("closed"));
    const response = vi.fn();

    runtimeMessage.value?.(
      { type: "OPEN_PROMPT_MASK_PANEL" },
      trustedSender(8),
      response,
    );
    await Promise.resolve();

    expect(response).toHaveBeenCalledWith({
      type: "OPEN_PROMPT_MASK_PANEL_RESULT",
      status: "ERROR",
    });
  });

  it("returns an explicit error when native opening throws synchronously", () => {
    open.mockImplementationOnce(() => {
      throw new Error("no gesture");
    });
    const response = vi.fn();

    const keepChannelOpen = runtimeMessage.value?.(
      { type: "OPEN_PROMPT_MASK_PANEL" },
      trustedSender(8),
      response,
    );

    expect(keepChannelOpen).toBe(false);
    expect(response).toHaveBeenCalledWith({
      type: "OPEN_PROMPT_MASK_PANEL_RESULT",
      status: "ERROR",
    });
  });

  it("routes lifecycle signals to the active tab in the matching window", async () => {
    opened.value?.({ path: "/side-panel.html", windowId: 3 });
    closed.value?.({ path: "side-panel.html", windowId: 9 });
    opened.value?.({ path: "/other.html", windowId: 5 });
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));

    expect(query).toHaveBeenCalledWith({ active: true, windowId: 3 });
    expect(query).toHaveBeenCalledWith({ active: true, windowId: 9 });
    expect(sendMessage.mock.calls).toEqual([
      [103, {
        type: "PROMPT_MASK_PANEL_VISIBILITY",
        state: "OPEN",
      } satisfies PanelVisibilitySignal],
      [109, {
        type: "PROMPT_MASK_PANEL_VISIBILITY",
        state: "CLOSED",
      } satisfies PanelVisibilitySignal],
    ]);
  });
});
