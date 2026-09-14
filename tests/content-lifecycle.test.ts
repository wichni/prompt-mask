import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentLifecycleController } from "../src/providers/chatgpt/content-lifecycle";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("content lifecycle", () => {
  it("cancels pending work, resumes once and disposes without live listeners", () => {
    let hidden = false;
    let frameCallback: FrameRequestCallback | null = null;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frameCallback = callback;
        return 42;
      }),
    );
    const cancelFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    const disconnect = vi.fn();
    vi.stubGlobal(
      "MutationObserver",
      class {
        observe = vi.fn();
        disconnect = disconnect;
        takeRecords = vi.fn(() => []);
      },
    );
    const onDispose = vi.fn();
    const onInput = vi.fn();
    const onPause = vi.fn();
    const onResume = vi.fn();
    const onScan = vi.fn();
    const controller = new ContentLifecycleController({
      onDispose,
      onInput,
      onPause,
      onResume,
      onScan,
      onSubmit: vi.fn(),
    });

    controller.start();
    controller.schedule();
    controller.schedule();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cancelFrame).toHaveBeenCalledWith(42);
    expect(onPause).toHaveBeenCalledOnce();
    (frameCallback as FrameRequestCallback | null)?.(0);
    expect(onScan).toHaveBeenCalledOnce();

    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onResume.mock.calls).toEqual([[false], [true]]);
    expect(onInput).toHaveBeenCalledOnce();

    controller.dispose();
    document.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onDispose).toHaveBeenCalledOnce();
    expect(onInput).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
});
