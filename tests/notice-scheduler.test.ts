import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoticeScheduler } from "../src/providers/chatgpt/notice-scheduler";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("background notice scheduler", () => {
  it("debounces the first positive result and keeps only the latest count", () => {
    const notify = vi.fn();
    const scheduler = new NoticeScheduler(notify);

    scheduler.update(1);
    vi.advanceTimersByTime(500);
    scheduler.update(3);
    vi.advanceTimersByTime(699);
    expect(notify).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(3);
  });

  it("does not repeat the same count and applies the cooldown to increases", () => {
    const notify = vi.fn();
    const scheduler = new NoticeScheduler(notify);

    scheduler.update(1);
    vi.advanceTimersByTime(700);
    scheduler.update(1);
    vi.advanceTimersByTime(9_000);
    expect(notify).toHaveBeenCalledTimes(1);

    scheduler.update(2);
    vi.advanceTimersByTime(999);
    expect(notify).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(notify).toHaveBeenNthCalledWith(2, 2);
  });

  it("uses a returned result as a baseline and preserves cooldown on reset", () => {
    const notify = vi.fn();
    const scheduler = new NoticeScheduler(notify);

    scheduler.update(1);
    vi.advanceTimersByTime(700);
    scheduler.reset(2);
    scheduler.update(2);
    vi.advanceTimersByTime(10_000);
    expect(notify).toHaveBeenCalledTimes(1);

    scheduler.update(3);
    vi.advanceTimersByTime(700);
    expect(notify).toHaveBeenNthCalledWith(2, 3);
  });

  it("cancels a pending notification when the result returns to zero", () => {
    const notify = vi.fn();
    const scheduler = new NoticeScheduler(notify);

    scheduler.update(2);
    scheduler.update(0);
    vi.advanceTimersByTime(20_000);

    expect(notify).not.toHaveBeenCalled();
  });
});
