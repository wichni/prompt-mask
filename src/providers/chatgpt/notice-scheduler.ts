export interface NoticeSchedulerOptions {
  cooldownMs?: number;
  debounceMs?: number;
  now?: () => number;
}

export class NoticeScheduler {
  private readonly cooldownMs: number;
  private readonly debounceMs: number;
  private readonly now: () => number;
  private previousCount: number | null = null;
  private pendingCount: number | null = null;
  private lastShownAt: number | null = null;
  private timer: number | null = null;

  constructor(
    private readonly onNotify: (count: number) => void,
    options: NoticeSchedulerOptions = {},
  ) {
    this.cooldownMs = options.cooldownMs ?? 10_000;
    this.debounceMs = options.debounceMs ?? 700;
    this.now = options.now ?? Date.now;
  }

  update(count: number, baseline = false): void {
    const shouldNotify =
      count > 0 &&
      !baseline &&
      (this.previousCount === null ||
        this.previousCount === 0 ||
        count > this.previousCount);
    this.previousCount = count;

    if (count === 0 || baseline) {
      this.cancelPending();
      return;
    }
    if (!shouldNotify && this.pendingCount === null) return;

    this.pendingCount = count;
    this.schedule();
  }

  reset(baseline: number | null = null, clearCooldown = false): void {
    this.cancelPending();
    this.previousCount = baseline;
    if (clearCooldown) this.lastShownAt = null;
  }

  cancelPending(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.pendingCount = null;
  }

  private schedule(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    const cooldownRemaining =
      this.lastShownAt === null
        ? 0
        : Math.max(0, this.lastShownAt + this.cooldownMs - this.now());
    this.timer = window.setTimeout(
      this.flush,
      Math.max(this.debounceMs, cooldownRemaining),
    );
  }

  private readonly flush = (): void => {
    const count = this.pendingCount;
    this.timer = null;
    this.pendingCount = null;
    if (count === null || count === 0) return;
    this.lastShownAt = this.now();
    this.onNotify(count);
  };
}
