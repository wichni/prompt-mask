import { NoticeScheduler } from "./notice-scheduler";
import { calculateNoticePosition } from "./notice-position";

const HOST_ID = "prompt-mask-background-notice";
const NOTICE_STYLES = `
  :host { color: #18334f; font: 13px/1.4 ui-sans-serif, system-ui, sans-serif; }
  button { font: inherit; pointer-events: auto; }
  .counter { float: right; min-height: 34px; padding: 0 12px; border: 1px solid #005eb8; border-radius: 9px; background: #fff; box-shadow: 0 4px 14px rgba(0,40,80,.18); color: #005eb8; cursor: pointer; font-weight: 750; }
  .toast { box-sizing: border-box; position: absolute; right: 0; bottom: calc(100% + 6px); display: grid; grid-template-columns: minmax(0,1fr) auto auto; gap: 8px; align-items: center; width: 100%; padding: 10px; overflow: auto; border: 1px solid #dce7f2; border-radius: 10px; background: #fff; box-shadow: 0 8px 24px rgba(0,40,80,.2); pointer-events: auto; }
  .toast[hidden] { display: none; }
  .toast.below { top: calc(100% + 6px); bottom: auto; }
  .toast.compact { grid-template-columns: minmax(0,1fr) auto; }
  .toast.compact .review { grid-column: 1 / -1; grid-row: 2; }
  .toast button { min-height: 32px; border: 1px solid #005eb8; border-radius: 7px; background: #fff; color: #005eb8; cursor: pointer; font-weight: 700; }
  .toast .close { width: 32px; padding: 0; font-size: 20px; }
  button:hover { background: #edf5ff; }
  button:focus-visible { outline: 3px solid #004a91; outline-offset: 2px; }
`;

interface BackgroundNoticeOptions {
  hideDelayMs?: number;
  isTrustedActivation?: (event: Event) => boolean;
  shadowMode?: ShadowRootMode;
}

export class BackgroundNotice {
  private readonly host = document.createElement("div");
  private readonly counter = document.createElement("button");
  private readonly toast = document.createElement("div");
  private readonly toastMessage = document.createElement("span");
  private readonly reviewButton = document.createElement("button");
  private readonly closeButton = document.createElement("button");
  private readonly scheduler: NoticeScheduler;
  private readonly hideDelayMs: number;
  private readonly isTrustedActivation: (event: Event) => boolean;
  private composer: HTMLElement | null = null;
  private hideTimer: number | null = null;
  private mounted = false;
  private panelVisible = false;

  constructor(
    private readonly openPanel: () => Promise<boolean>,
    options: BackgroundNoticeOptions = {},
  ) {
    this.hideDelayMs = options.hideDelayMs ?? 6_000;
    this.isTrustedActivation =
      options.isTrustedActivation ?? ((event) => event.isTrusted);
    this.scheduler = new NoticeScheduler(this.showToast);
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
    this.scheduler.reset(null, true);
    this.clearHideTimer();
    this.host.remove();
    this.composer = null;
    this.mounted = false;
  }

  setPanelVisible(visible: boolean): void {
    this.panelVisible = visible;
    if (visible) {
      this.scheduler.reset();
      this.hideToast();
      this.host.style.display = "none";
    }
  }

  showSearching(composer: HTMLElement | null, resetPolicy = false): void {
    if (resetPolicy) this.scheduler.reset();
    else this.scheduler.cancelPending();
    this.hideToast();
    this.showCounter(composer, "—", "Wynik analizy jest ustalany.");
  }

  showReady(composer: HTMLElement, count: number, baseline = false): void {
    this.showCounter(
      composer,
      String(count),
      `${count} ${count === 1 ? "fragment" : "fragmenty"} do sprawdzenia.`,
    );
    this.scheduler.update(count, baseline || this.panelVisible);
    if (count === 0) this.hideToast();
  }

  showUnavailable(composer: HTMLElement | null): void {
    this.scheduler.reset();
    this.hideToast();
    this.showCounter(composer, "!", "Analiza niedostępna.");
  }

  get element(): HTMLDivElement {
    return this.host;
  }

  get countControl(): HTMLButtonElement {
    return this.counter;
  }

  get notification(): HTMLDivElement {
    return this.toast;
  }

  private configureHost(shadowMode: ShadowRootMode): void {
    this.host.id = HOST_ID;
    this.host.style.cssText =
      "display:none;position:fixed;z-index:2147483645;width:min(320px,calc(100vw - 16px));height:34px;pointer-events:none;";
    const shadow = this.host.attachShadow({ mode: shadowMode });
    const style = document.createElement("style");
    style.textContent = NOTICE_STYLES;
    this.counter.type = "button";
    this.counter.className = "counter";
    this.counter.addEventListener("click", this.handleOpen);
    this.toast.className = "toast";
    this.toast.hidden = true;
    this.toast.setAttribute("role", "status");
    this.toast.setAttribute("aria-live", "polite");
    this.reviewButton.type = "button";
    this.reviewButton.className = "review";
    this.reviewButton.textContent = "Sprawdź";
    this.reviewButton.addEventListener("click", this.handleOpen);
    this.closeButton.type = "button";
    this.closeButton.className = "close";
    this.closeButton.textContent = "×";
    this.closeButton.setAttribute("aria-label", "Zamknij powiadomienie");
    this.closeButton.addEventListener("click", this.handleDismiss);
    this.toast.addEventListener("mouseenter", this.clearHideTimer);
    this.toast.addEventListener("mouseleave", this.scheduleHide);
    this.toast.addEventListener("focusin", this.clearHideTimer);
    this.toast.addEventListener("focusout", this.handleFocusOut);
    this.toast.addEventListener("keydown", this.handleKeyDown);
    this.toast.append(this.toastMessage, this.reviewButton, this.closeButton);
    shadow.append(style, this.toast, this.counter);
  }

  private showCounter(
    composer: HTMLElement | null,
    value: string,
    status: string,
  ): void {
    this.composer = composer;
    if (!composer || this.panelVisible) {
      this.host.style.display = "none";
      return;
    }
    this.mount();
    this.counter.textContent = `promptMask · ${value}`;
    this.counter.setAttribute("aria-label", `${status} Otwórz panel promptMask.`);
    this.host.style.display = "block";
    this.reposition();
  }

  private readonly showToast = (count: number): void => {
    if (this.panelVisible || !this.composer || document.hidden) return;
    this.toastMessage.textContent = `Wykryto fragmenty do sprawdzenia: ${count}`;
    this.toast.hidden = false;
    this.reposition();
    this.scheduleHide();
  };

  private hideToast(): void {
    this.clearHideTimer();
    this.toast.hidden = true;
  }

  private readonly handleOpen = (event: Event): void => {
    if (!this.isTrustedActivation(event)) return;
    this.hideToast();
    void this.openPanel().then((opened) => {
      if (opened || this.panelVisible || !this.composer) return;
      this.toastMessage.textContent =
        "Nie udało się otworzyć panelu. Użyj ikony rozszerzenia.";
      this.toast.hidden = false;
      this.scheduleHide();
    });
  };

  private readonly handleDismiss = (event: Event): void => {
    if (!this.isTrustedActivation(event)) return;
    this.hideToast();
    this.counter.focus({ preventScroll: true });
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !this.isTrustedActivation(event)) return;
    event.stopPropagation();
    this.hideToast();
  };

  private readonly handleFocusOut = (event: FocusEvent): void => {
    if (
      event.relatedTarget instanceof Node &&
      this.toast.contains(event.relatedTarget)
    ) {
      return;
    }
    this.scheduleHide();
  };

  private readonly scheduleHide = (): void => {
    this.clearHideTimer();
    this.hideTimer = window.setTimeout(() => this.hideToast(), this.hideDelayMs);
  };

  private readonly clearHideTimer = (): void => {
    if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
    this.hideTimer = null;
  };

  private readonly reposition = (): void => {
    if (!this.composer || this.host.style.display === "none") return;
    const rect = this.composer.getBoundingClientRect();
    const position = calculateNoticePosition(
      rect,
      window.innerWidth,
      window.innerHeight,
    );
    this.host.style.width = `${position.width}px`;
    this.host.style.left = `${position.left}px`;
    this.host.style.top = `${position.top}px`;
    this.toast.style.maxHeight = `${position.toastMaxHeight}px`;
    this.toast.classList.toggle("below", position.toastBelow);
    this.toast.classList.toggle("compact", position.compact);
  };
}
