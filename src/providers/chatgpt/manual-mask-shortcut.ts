const HOST_ID = "prompt-mask-manual-shortcut";

interface ManualMaskShortcutOptions {
  isTrustedActivation?: (event: MouseEvent) => boolean;
  shadowMode?: ShadowRootMode;
}

export class ManualMaskShortcut {
  private readonly host = document.createElement("div");
  private readonly button = document.createElement("button");
  private readonly isTrustedActivation: (event: MouseEvent) => boolean;
  private selectionId: number | null = null;
  private composer: HTMLElement | null = null;
  private mounted = false;

  constructor(
    private readonly onMask: (selectionId: number) => void,
    options: ManualMaskShortcutOptions = {},
  ) {
    this.isTrustedActivation =
      options.isTrustedActivation ?? ((event) => event.isTrusted);
    this.host.id = HOST_ID;
    this.host.style.cssText =
      "display:none;position:fixed;z-index:2147483646;pointer-events:none;";
    const shadow = this.host.attachShadow({
      mode: options.shadowMode ?? "closed",
    });
    const style = document.createElement("style");
    style.textContent = `
      button {
        width: 48px;
        height: 34px;
        padding: 0;
        border: 1px solid #005eb8;
        border-radius: 9px;
        background: #ffffff;
        box-shadow: 0 4px 14px rgba(0, 40, 80, 0.22);
        color: #005eb8;
        cursor: pointer;
        font: 750 13px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: -0.04em;
        pointer-events: auto;
      }
      button:hover { background: #e6f1fc; }
      button:focus-visible {
        outline: 3px solid #004a91;
        outline-offset: 2px;
      }
    `;
    this.button.type = "button";
    this.button.textContent = "[•••]";
    this.button.title = "Maskuj zaznaczenie";
    this.button.setAttribute("aria-label", "Maskuj zaznaczenie");
    this.button.addEventListener("pointerdown", this.preserveSelection);
    this.button.addEventListener("click", this.handleClick);
    shadow.append(style, this.button);
  }

  mount(): void {
    if (!this.host.isConnected) document.documentElement.append(this.host);
    if (this.mounted) return;
    window.addEventListener("resize", this.reposition);
    window.addEventListener("scroll", this.reposition, true);
    this.mounted = true;
  }

  unmount(): void {
    if (!this.mounted) return;
    window.removeEventListener("resize", this.reposition);
    window.removeEventListener("scroll", this.reposition, true);
    this.host.remove();
    this.selectionId = null;
    this.composer = null;
    this.mounted = false;
  }

  show(composer: HTMLElement, selectionId: number): void {
    this.mount();
    this.composer = composer;
    this.selectionId = selectionId;
    this.host.style.display = "block";
    this.reposition();
  }

  hide(): void {
    this.selectionId = null;
    this.composer = null;
    this.host.style.display = "none";
  }

  containsEvent(event: Event): boolean {
    return event.composedPath().includes(this.host);
  }

  get control(): HTMLButtonElement {
    return this.button;
  }

  get element(): HTMLDivElement {
    return this.host;
  }

  private readonly preserveSelection = (event: PointerEvent): void => {
    if (event.isTrusted) event.preventDefault();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    const selectionId = this.selectionId;
    if (selectionId === null || !this.isTrustedActivation(event)) return;
    this.hide();
    this.onMask(selectionId);
  };

  private readonly reposition = (): void => {
    if (!this.composer || this.selectionId === null) return;
    if (!this.host.isConnected) document.documentElement.append(this.host);
    const rect = this.composer.getBoundingClientRect();
    const top = Math.max(8, rect.top - 42);
    const left = Math.max(
      8,
      Math.min(window.innerWidth - 56, rect.right - 48),
    );
    this.host.style.top = `${top}px`;
    this.host.style.left = `${left}px`;
  };
}
