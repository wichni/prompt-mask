export interface ContentLifecycleOptions {
  onDispose: () => void;
  onInput: (event: Event) => void;
  onPause: () => void;
  onResume: (baseline: boolean) => void;
  onScan: () => void;
  onSubmit: (event: Event) => void;
}

export class ContentLifecycleController {
  private observer: MutationObserver | null = null;
  private scheduledFrame: number | null = null;
  private running = false;
  private disposed = false;

  constructor(private readonly options: ContentLifecycleOptions) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.disposed) return;
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pagehide", this.handlePageHide);
    window.addEventListener("pageshow", this.handlePageShow);
    window.addEventListener("unload", this.dispose);
    this.resume(false);
  }

  readonly schedule = (): void => {
    if (!this.running || this.scheduledFrame !== null) return;
    this.scheduledFrame = -1;
    const frame = requestAnimationFrame(() => {
      this.scheduledFrame = null;
      if (this.running) this.options.onScan();
    });
    if (this.scheduledFrame !== null) this.scheduledFrame = frame;
  };

  readonly dispose = (): void => {
    if (this.disposed) return;
    this.pause();
    this.disposed = true;
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("pagehide", this.handlePageHide);
    window.removeEventListener("pageshow", this.handlePageShow);
    window.removeEventListener("unload", this.dispose);
    this.options.onDispose();
  };

  private resume(baseline: boolean): void {
    if (this.running || this.disposed || document.hidden) return;
    this.running = true;
    document.addEventListener("input", this.options.onInput, true);
    document.addEventListener("submit", this.options.onSubmit, true);
    this.observer = new MutationObserver(this.schedule);
    this.observer.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    this.options.onResume(baseline);
    this.options.onScan();
  }

  private pause(): void {
    if (!this.running) return;
    this.running = false;
    if (this.scheduledFrame !== null) {
      cancelAnimationFrame(this.scheduledFrame);
    }
    this.scheduledFrame = null;
    document.removeEventListener("input", this.options.onInput, true);
    document.removeEventListener("submit", this.options.onSubmit, true);
    this.observer?.disconnect();
    this.observer = null;
    this.options.onPause();
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) this.pause();
    else this.resume(true);
  };

  private readonly handlePageHide = (): void => this.pause();
  private readonly handlePageShow = (): void => this.resume(true);
}
