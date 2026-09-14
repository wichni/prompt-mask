export class ToastInteractionController {
  private timer: number | null = null;
  private hovered = false;
  private focused = false;

  constructor(
    private readonly toast: HTMLElement,
    private readonly shadowRoot: ShadowRoot,
    private readonly hideDelayMs: number,
    private readonly onHide: () => void,
  ) {}

  readonly handleMouseEnter = (): void => {
    this.hovered = true;
    this.clearTimer();
  };

  readonly handleMouseLeave = (): void => {
    this.hovered = false;
    this.schedule();
  };

  readonly handleFocusIn = (): void => {
    this.focused = true;
    this.clearTimer();
  };

  readonly handleFocusOut = (event: FocusEvent): void => {
    if (
      event.relatedTarget instanceof Node &&
      this.toast.contains(event.relatedTarget)
    ) {
      return;
    }
    this.focused = false;
    this.schedule();
  };

  schedule(): void {
    this.clearTimer();
    if (this.hasFocusInside()) this.focused = true;
    if (this.toast.hidden || this.hovered || this.focused) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.focused = this.hasFocusInside();
      if (this.hovered || this.focused || this.toast.hidden) return;
      this.onHide();
    }, this.hideDelayMs);
  }

  reset(): void {
    this.clearTimer();
    this.hovered = false;
    this.focused = false;
  }

  private hasFocusInside(): boolean {
    const activeElement = this.shadowRoot.activeElement;
    return activeElement instanceof Node && this.toast.contains(activeElement);
  }

  private clearTimer(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }
}
