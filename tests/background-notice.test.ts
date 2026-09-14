import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundNotice } from "../src/providers/chatgpt/background-notice";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("background notice", () => {
  it("shows only a count and opens the panel from a trusted page action", async () => {
    const openPanel = vi.fn(async () => true);
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(openPanel, {
      isTrustedActivation: () => true,
      shadowMode: "open",
    });

    notice.showReady(composer, 2);
    vi.advanceTimersByTime(700);

    expect(notice.countControl.textContent).toBe("promptMask · 2");
    expect(notice.notification.textContent).toContain(
      "Wykryto fragmenty do sprawdzenia: 2",
    );
    expect(notice.element.textContent).not.toContain("anna@example.com");
    notice.countControl.click();
    await vi.runAllTimersAsync();

    expect(openPanel).toHaveBeenCalledOnce();
    notice.unmount();
  });

  it("hides page controls while the panel is visible", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(async () => true, {
      shadowMode: "open",
    });

    notice.showReady(composer, 1);
    notice.setPanelVisible(true);

    expect(notice.element.style.display).toBe("none");
    expect(notice.notification.hidden).toBe(true);
    notice.unmount();
  });

  it("pauses automatic hiding during hover and supports Escape", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(async () => true, {
      isTrustedActivation: () => true,
      shadowMode: "open",
    });
    notice.showReady(composer, 1);
    vi.advanceTimersByTime(700);

    notice.notification.dispatchEvent(new MouseEvent("mouseenter"));
    vi.advanceTimersByTime(6_000);
    expect(notice.notification.hidden).toBe(false);

    notice.notification.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(notice.notification.hidden).toBe(true);
    notice.unmount();
  });

  it("shows a generic failure without exposing context", async () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(async () => false, {
      isTrustedActivation: () => true,
      shadowMode: "open",
    });

    notice.showReady(composer, 1, true);
    notice.countControl.click();
    await Promise.resolve();

    expect(notice.notification.textContent).toContain(
      "Nie udało się otworzyć panelu",
    );
    expect(notice.notification.textContent).not.toContain("chatgpt.com");
    notice.unmount();
  });

  it("repositions responsively when the viewport changes", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    let rect = {
      top: 700,
      right: 1_100,
      bottom: 770,
      width: 760,
    };
    vi.spyOn(composer, "getBoundingClientRect").mockImplementation(
      () => rect as DOMRect,
    );
    const viewportWidth = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(1_440);
    const viewportHeight = vi
      .spyOn(window, "innerHeight", "get")
      .mockReturnValue(900);
    const notice = new BackgroundNotice(async () => true, {
      shadowMode: "open",
    });

    notice.showReady(composer, 3, true);

    expect(notice.element.style.cssText).toContain("width: 320px");
    expect(notice.element.style.left).toBe("780px");
    expect(notice.element.style.top).toBe("662px");
    expect(notice.notification.style.maxHeight).toBe("648px");
    expect(notice.notification.classList.contains("below")).toBe(false);

    rect = { top: 20, right: 272, bottom: 90, width: 264 };
    viewportWidth.mockReturnValue(280);
    viewportHeight.mockReturnValue(500);
    window.dispatchEvent(new Event("resize"));

    expect(notice.element.style.cssText).toContain("width: 264px");
    expect(notice.element.style.left).toBe("8px");
    expect(notice.element.style.top).toBe("94px");
    expect(notice.notification.style.maxHeight).toBe("358px");
    expect(notice.notification.classList.contains("below")).toBe(true);
    expect(notice.notification.classList.contains("compact")).toBe(true);
    notice.unmount();
  });
});
