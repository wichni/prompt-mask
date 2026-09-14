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
  it("keeps page controls hidden until a positive detection count exists", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(async () => true, {
      shadowMode: "open",
    });

    notice.showSearching(composer);
    expect(notice.element.style.display).toBe("none");

    notice.showUnavailable(composer);
    expect(notice.element.style.display).toBe("none");

    notice.showReady(composer, 0);
    expect(notice.element.style.display).toBe("none");

    notice.showReady(composer, 1, true);
    expect(notice.element.style.display).toBe("block");
    expect(notice.countControl.textContent).toBe("promptMask · 1");

    notice.showReady(composer, 0);
    expect(notice.element.style.display).toBe("none");
    expect(notice.notification.hidden).toBe(true);
    notice.unmount();
  });

  it("does not restore an opening error after the last detection disappears", async () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    let finishOpening!: (opened: boolean) => void;
    const opening = new Promise<boolean>((resolve) => {
      finishOpening = resolve;
    });
    const notice = new BackgroundNotice(() => opening, {
      isTrustedActivation: () => true,
      shadowMode: "open",
    });

    notice.showReady(composer, 1, true);
    notice.countControl.click();
    notice.showReady(composer, 0);
    finishOpening(false);
    await Promise.resolve();

    expect(notice.element.style.display).toBe("none");
    expect(notice.notification.hidden).toBe(true);
    notice.unmount();
  });

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

  it("updates the count in an already visible notification without extending it", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(async () => true, {
      shadowMode: "open",
    });

    notice.showReady(composer, 3);
    vi.advanceTimersByTime(700);
    notice.showReady(composer, 1);

    expect(notice.notification.textContent).toContain(
      "Wykryto fragmenty do sprawdzenia: 1",
    );
    vi.advanceTimersByTime(5_999);
    expect(notice.notification.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(notice.notification.hidden).toBe(true);
    notice.unmount();
  });

  it("updates an increase, hides at zero and does not reopen a dismissed count", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(async () => true, {
      isTrustedActivation: () => true,
      shadowMode: "open",
    });

    notice.showReady(composer, 1);
    vi.advanceTimersByTime(700);
    notice.showReady(composer, 3);
    expect(notice.notification.textContent).toContain(
      "Wykryto fragmenty do sprawdzenia: 3",
    );
    notice.showReady(composer, 0);
    expect(notice.notification.hidden).toBe(true);

    notice.showReady(composer, 1);
    vi.advanceTimersByTime(10_000);
    const closeButton = notice.notification.querySelector<HTMLButtonElement>(
      ".close",
    )!;
    closeButton.click();
    expect(notice.notification.hidden).toBe(true);
    expect(notice.element.shadowRoot?.activeElement).toBe(notice.countControl);
    notice.showReady(composer, 1);
    vi.advanceTimersByTime(20_000);
    expect(notice.notification.hidden).toBe(true);
    notice.unmount();
  });

  it("does not replace a visible opening error with a count", async () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(async () => false, {
      isTrustedActivation: () => true,
      shadowMode: "open",
    });

    notice.showReady(composer, 1, true);
    notice.countControl.click();
    await Promise.resolve();
    notice.showReady(composer, 2);
    vi.advanceTimersByTime(700);

    expect(notice.notification.textContent).toContain(
      "Nie udało się otworzyć panelu",
    );
    expect(notice.notification.textContent).not.toContain(
      "Wykryto fragmenty",
    );
    notice.unmount();
  });

  it("does not hide after mouseleave while focus remains in the notification", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(async () => true, {
      shadowMode: "open",
    });
    notice.showReady(composer, 1);
    vi.advanceTimersByTime(700);
    const reviewButton = notice.notification.querySelector("button")!;
    const closeButton = notice.notification.querySelector<HTMLButtonElement>(
      ".close",
    )!;

    reviewButton.focus();
    closeButton.focus();
    notice.notification.dispatchEvent(new MouseEvent("mouseenter"));
    notice.notification.dispatchEvent(new MouseEvent("mouseleave"));
    vi.advanceTimersByTime(6_000);

    expect(notice.notification.hidden).toBe(false);
    notice.countControl.focus();
    vi.advanceTimersByTime(5_999);
    expect(notice.notification.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(notice.notification.hidden).toBe(true);
    notice.unmount();
  });

  it("keeps the notification open while hovered after focus leaves", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = new BackgroundNotice(async () => true, {
      shadowMode: "open",
    });
    notice.showReady(composer, 1);
    vi.advanceTimersByTime(700);
    const reviewButton = notice.notification.querySelector("button")!;

    notice.notification.dispatchEvent(new MouseEvent("mouseenter"));
    reviewButton.focus();
    notice.countControl.focus();
    vi.advanceTimersByTime(6_000);
    expect(notice.notification.hidden).toBe(false);

    notice.notification.dispatchEvent(new MouseEvent("mouseleave"));
    vi.advanceTimersByTime(5_999);
    expect(notice.notification.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(notice.notification.hidden).toBe(true);
    notice.unmount();
  });
});
