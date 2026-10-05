import { afterEach, describe, expect, it, vi } from "vitest";
import { BackgroundNotice, type NoticeView } from "../src/providers/chatgpt/background-notice";

const view = (categories: NoticeView["categories"], revision = 1): NoticeView => ({
  sessionId: "11111111-1111-4111-8111-111111111111",
  revision,
  categories,
});

const createNotice = (
  openPanel: () => Promise<boolean> = vi.fn(async () => true),
  maskKind: (kind: string, sessionId: string, revision: number) => boolean = vi.fn(() => true),
  undo: (operationId: number) => boolean = vi.fn(() => true),
  trusted = true,
) =>
  new BackgroundNotice(openPanel, { maskKind, undo }, {
    isTrustedActivation: () => trusted,
    shadowMode: "open",
  });

const actionButtons = (notice: BackgroundNotice): HTMLButtonElement[] =>
  [...notice.element.shadowRoot!.querySelectorAll<HTMLButtonElement>(".categories button")];

afterEach(() => {
  document.body.innerHTML = "";
  document.querySelector("#prompt-mask-background-notice")?.remove();
  vi.restoreAllMocks();
});

describe("background page controls", () => {
  it("shows no counter for empty, searching, unavailable or panel-visible states", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const notice = createNotice();

    notice.showSearching(composer);
    expect(notice.element.style.display).toBe("none");
    notice.showReady(composer, view([]));
    expect(notice.element.style.display).toBe("none");
    notice.showReady(composer, view([{ kind: "EMAIL", count: 1 }]));
    expect(notice.countControl.textContent).toBe("promptMask · 1");
    notice.showUnavailable(composer);
    expect(notice.element.style.display).toBe("none");
    notice.showReady(composer, view([{ kind: "EMAIL", count: 1 }]));
    notice.setPanelVisible(true);
    expect(notice.element.style.display).toBe("none");
    notice.unmount();
  });

  it("shows category counts and masks one kind without opening the panel or exposing values", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const openPanel = vi.fn(async () => true);
    const maskKind = vi.fn(() => true);
    const notice = createNotice(openPanel, maskKind);
    notice.showReady(composer, view([
      { kind: "PHONE", count: 2 },
      { kind: "EMAIL", count: 1 },
      { kind: "PESEL", count: 1 },
      { kind: "SECRET", count: 1 },
    ]));

    expect(notice.countControl.textContent).toBe("promptMask · 5");
    expect(actionButtons(notice).map((button) => button.textContent)).toEqual([
      "Telefon · 2", "E-mail · 1", "PESEL · 1", "Sekret · 1",
    ]);
    expect(notice.element.textContent).not.toContain("anna@example.com");
    actionButtons(notice)[0]!.click();
    expect(maskKind).toHaveBeenCalledWith(
      "PHONE", "11111111-1111-4111-8111-111111111111", 1,
    );
    expect(openPanel).not.toHaveBeenCalled();
    notice.unmount();
  });

  it("ignores untrusted page activation", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const openPanel = vi.fn(async () => true);
    const maskKind = vi.fn(() => true);
    const notice = createNotice(openPanel, maskKind, vi.fn(() => true), false);
    notice.showReady(composer, view([{ kind: "EMAIL", count: 1 }]));

    notice.countControl.click();
    actionButtons(notice)[0]!.click();

    expect(openPanel).not.toHaveBeenCalled();
    expect(maskKind).not.toHaveBeenCalled();
    notice.unmount();
  });

  it("keeps the clicked revision so a stale action can be rejected", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const maskKind = vi.fn(() => false);
    const notice = createNotice(undefined, maskKind);
    notice.showReady(composer, view([{ kind: "PHONE", count: 1 }], 1));
    const staleButton = actionButtons(notice)[0]!;
    notice.showReady(composer, view([{ kind: "PHONE", count: 2 }], 2));

    staleButton.click();

    expect(maskKind).toHaveBeenCalledWith(
      "PHONE", "11111111-1111-4111-8111-111111111111", 1,
    );
    expect(notice.element.shadowRoot!.textContent).toContain(
      "Nie udało się zamaskować",
    );
    notice.unmount();
  });

  it("keeps local undo available after the last detection disappears", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    const undo = vi.fn(() => true);
    const notice = createNotice(undefined, undefined, undo);
    notice.showReady(composer, view([{ kind: "EMAIL", count: 1 }]));
    notice.showReady(composer, view([], 2));
    notice.showUndo(7);
    const undoButton = notice.element.shadowRoot!.querySelector<HTMLButtonElement>(".undo");

    expect(notice.element.style.display).toBe("block");
    expect(notice.countControl.hidden).toBe(true);
    expect(notice.element.shadowRoot!.textContent).not.toContain("promptMask · 0");
    expect(undoButton?.textContent).toBe("Cofnij");
    undoButton?.click();
    expect(undo).toHaveBeenCalledWith(7);
    notice.clearUndo();
    expect(notice.element.style.display).toBe("none");
    notice.unmount();
  });

  it("does not show a late panel-open error after findings disappear", async () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    let finishOpening!: (opened: boolean) => void;
    const opening = new Promise<boolean>((resolve) => { finishOpening = resolve; });
    const notice = createNotice(() => opening);
    notice.showReady(composer, view([{ kind: "EMAIL", count: 1 }]));
    notice.countControl.click();
    notice.showReady(composer, view([]));
    notice.showUndo(7);
    finishOpening(false);
    await Promise.resolve();

    expect(notice.element.style.display).toBe("block");
    expect(notice.element.shadowRoot!.textContent).not.toContain("Nie udało się");
    notice.unmount();
  });

  it("keeps the controls inside a narrow viewport", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);
    vi.spyOn(composer, "getBoundingClientRect").mockReturnValue({
      top: 20, right: 272, bottom: 90, width: 264,
    } as DOMRect);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(280);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(500);
    const notice = createNotice();

    notice.showReady(composer, view([{ kind: "PHONE", count: 1 }]));

    expect(notice.element.style.width).toBe("264px");
    expect(notice.element.style.left).toBe("8px");
    expect(notice.element.style.top).toBe("96px");
    notice.unmount();
  });
});
