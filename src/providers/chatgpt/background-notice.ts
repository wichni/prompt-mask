import type { DetectionKind } from "../../core/detection";
import type { DraftSessionId } from "../../platform/chromium/messages";
import { calculateNoticePosition } from "./notice-position";
import { createCategoryButtons } from "./page-category-buttons";
import type { KindCount } from "./page-control-kinds";

const HOST_ID = "prompt-mask-background-notice";
const NOTICE_STYLES = `
  :host { color: #18334f; font: 13px/1.4 ui-sans-serif, system-ui, sans-serif; }
  .bar { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; pointer-events: none; }
  .categories { display: flex; flex: 0 1 auto; flex-wrap: wrap; justify-content: flex-end; gap: 6px; min-width: 0; }
  button { min-height: 34px; padding: 0 10px; border: 1px solid #005eb8; border-radius: 9px; background: #fff; box-shadow: 0 4px 14px rgba(0,40,80,.18); color: #005eb8; cursor: pointer; font: 700 13px/1.2 ui-sans-serif, system-ui, sans-serif; pointer-events: auto; }
  .counter { font-weight: 750; }
  .feedback { box-sizing: border-box; width: 100%; padding: 7px 10px; border-radius: 8px; background: #fff; color: #18334f; box-shadow: 0 4px 14px rgba(0,40,80,.18); pointer-events: auto; }
  .feedback[hidden], button[hidden] { display: none; }
  button:hover { background: #edf5ff; }
  button:focus-visible { outline: 3px solid #004a91; outline-offset: 2px; }
`;

export interface NoticeView {
  sessionId: DraftSessionId;
  revision: number;
  categories: readonly KindCount[];
}

interface NoticeActions {
  maskKind: (
    kind: DetectionKind,
    sessionId: DraftSessionId,
    revision: number,
  ) => boolean;
  undo: (operationId: number) => boolean;
}

interface BackgroundNoticeOptions {
  isTrustedActivation?: (event: Event) => boolean;
  onPositionChange?: () => void;
  shadowMode?: ShadowRootMode;
}

export class BackgroundNotice {
  private readonly host = document.createElement("div");
  private readonly bar = document.createElement("div");
  private readonly counter = document.createElement("button");
  private readonly categories = document.createElement("div");
  private readonly undoButton = document.createElement("button");
  private readonly feedback = document.createElement("div");
  private readonly isTrustedActivation: (event: Event) => boolean;
  private readonly onPositionChange: () => void;
  private composer: HTMLElement | null = null;
  private view: NoticeView | null = null;
  private undoOperationId: number | null = null;
  private mounted = false;
  private panelVisible = false;

  constructor(
    private readonly openPanel: () => Promise<boolean>,
    private readonly actions: NoticeActions,
    options: BackgroundNoticeOptions = {},
  ) {
    this.isTrustedActivation =
      options.isTrustedActivation ?? ((event) => event.isTrusted);
    this.onPositionChange = options.onPositionChange ?? (() => {});
    this.configureHost(options.shadowMode ?? "closed");
  }

  mount(): void {
    if (!this.host.isConnected) document.documentElement.append(this.host);
    if (this.mounted) return;
    window.addEventListener("resize", this.reposition);
    window.addEventListener("scroll", this.reposition, true);
    this.mounted = true;
  }

  unmount(): void {
    if (!this.mounted && !this.host.isConnected) return;
    window.removeEventListener("resize", this.reposition);
    window.removeEventListener("scroll", this.reposition, true);
    this.host.remove();
    this.composer = null;
    this.view = null;
    this.undoOperationId = null;
    this.mounted = false;
  }

  setPanelVisible(visible: boolean): void {
    this.panelVisible = visible;
    if (visible) this.hidePageControls();
  }

  showSearching(composer: HTMLElement | null): void {
    this.composer = composer;
    this.view = null;
    this.undoOperationId = null;
    this.hidePageControls();
  }

  showReady(composer: HTMLElement, view: NoticeView): void {
    this.composer = composer;
    this.view = view;
    this.clearFeedback();
    this.render();
  }

  showUnavailable(composer: HTMLElement | null): void {
    this.showSearching(composer);
  }

  showUndo(operationId: number): void {
    this.undoOperationId = operationId;
    this.render();
  }

  clearUndo(): void {
    this.undoOperationId = null;
    this.render();
  }

  get element(): HTMLDivElement {
    return this.host;
  }

  get countControl(): HTMLButtonElement {
    return this.counter;
  }

  get occupiedRect(): DOMRect | null {
    return this.host.style.display === "none"
      ? null
      : this.host.getBoundingClientRect();
  }

  private configureHost(shadowMode: ShadowRootMode): void {
    this.host.id = HOST_ID;
    this.host.style.cssText =
      "display:none;position:fixed;z-index:2147483645;pointer-events:none;";
    const shadow = this.host.attachShadow({ mode: shadowMode });
    const style = document.createElement("style");
    style.textContent = NOTICE_STYLES;
    this.bar.className = "bar";
    this.counter.type = "button";
    this.counter.className = "counter";
    this.counter.addEventListener("click", this.handleOpen);
    this.categories.className = "categories";
    this.undoButton.type = "button";
    this.undoButton.className = "undo";
    this.undoButton.textContent = "Cofnij";
    this.undoButton.addEventListener("click", this.handleUndo);
    this.feedback.className = "feedback";
    this.feedback.setAttribute("role", "status");
    this.feedback.setAttribute("aria-live", "polite");
    this.feedback.hidden = true;
    this.bar.append(
      this.counter,
      this.categories,
      this.undoButton,
      this.feedback,
    );
    shadow.append(style, this.bar);
  }

  private render(): void {
    const total =
      this.view?.categories.reduce((sum, item) => sum + item.count, 0) ?? 0;
    if (
      !this.composer ||
      this.panelVisible ||
      (total === 0 && this.undoOperationId === null)
    ) {
      this.hidePageControls();
      return;
    }
    this.mount();
    this.counter.hidden = total === 0;
    this.counter.textContent = total > 0 ? `promptMask · ${total}` : "";
    this.counter.setAttribute(
      "aria-label",
      total > 0 ? `Wykryte fragmenty: ${total}. Otwórz panel promptMask.` : "",
    );
    this.categories.replaceChildren(
      ...createCategoryButtons(
        this.view,
        this.isTrustedActivation,
        this.actions.maskKind,
        () =>
          this.showFeedback("Nie udało się zamaskować. Sprawdź aktualny tekst."),
      ),
    );
    this.undoButton.hidden = this.undoOperationId === null;
    this.host.style.display = "block";
    this.reposition();
  }

  private hidePageControls(): void {
    this.host.style.display = "none";
    this.clearFeedback();
    this.onPositionChange();
  }

  private clearFeedback(): void {
    this.feedback.hidden = true;
    this.feedback.textContent = "";
  }

  private showFeedback(message: string): void {
    if (this.host.style.display === "none") return;
    this.feedback.textContent = message;
    this.feedback.hidden = false;
    this.reposition();
  }

  private readonly handleOpen = (event: Event): void => {
    if (!this.isTrustedActivation(event)) return;
    const requestView = this.view;
    void this.openPanel().then((opened) => {
      if (
        !opened &&
        !this.panelVisible &&
        this.view === requestView &&
        this.host.style.display !== "none"
      ) {
        this.showFeedback(
          "Nie udało się otworzyć panelu. Użyj ikony rozszerzenia.",
        );
      }
    });
  };

  private readonly handleUndo = (event: Event): void => {
    if (!this.isTrustedActivation(event) || this.undoOperationId === null) return;
    if (!this.actions.undo(this.undoOperationId)) {
      this.showFeedback("Nie udało się cofnąć. Szkic mógł się zmienić.");
    }
  };

  private readonly reposition = (): void => {
    if (!this.composer || this.host.style.display === "none") return;
    const rect = this.composer.getBoundingClientRect();
    const width = calculateNoticePosition(
      rect,
      window.innerWidth,
      window.innerHeight,
      34,
    ).width;
    this.host.style.width = `${width}px`;
    const position = calculateNoticePosition(
      rect,
      window.innerWidth,
      window.innerHeight,
      this.host.offsetHeight || 34,
    );
    this.host.style.left = `${position.left}px`;
    this.host.style.top = `${position.top}px`;
    this.onPositionChange();
  };
}
