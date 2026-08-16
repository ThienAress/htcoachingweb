import { afterEach, describe, expect, it, vi } from "vitest";

import { safeLog } from "../../utils/safeLogger.js";
import { createRecurringJob } from "../recurringJob.js";

const flushPromises = () => new Promise((resolve) => queueMicrotask(resolve));

describe("recurring job lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts once and stops future ticks", async () => {
    vi.useFakeTimers();
    const task = vi.fn().mockResolvedValue(undefined);
    const job = createRecurringJob({ name: "test.job", intervalMs: 1000, task });

    expect(job.start()).toBe(job.start());
    await flushPromises();
    expect(task).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(2);
    job.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("skips an interval tick while the previous task is still running", async () => {
    vi.useFakeTimers();
    let release;
    const firstTick = new Promise((resolve) => {
      release = resolve;
    });
    const task = vi
      .fn()
      .mockReturnValueOnce(firstTick)
      .mockResolvedValue(undefined);
    const warning = vi.spyOn(safeLog, "warn").mockImplementation(() => {});
    const job = createRecurringJob({ name: "test.slow", intervalMs: 1000, task });

    job.start();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      "test.slow.overlap_skipped",
      "Previous recurring job tick is still running",
    );

    release();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(2);
    job.stop();
  });

  it("contains a failed tick and retries on the next interval", async () => {
    vi.useFakeTimers();
    const error = new Error("synthetic failure");
    const task = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);
    const logError = vi.spyOn(safeLog, "error").mockImplementation(() => {});
    const job = createRecurringJob({ name: "test.failure", intervalMs: 1000, task });

    job.start();
    await vi.waitFor(() => {
      expect(logError).toHaveBeenCalledWith("test.failure.tick_failed", error);
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(2);
    job.stop();
  });

  it("honors an initial delay without creating a second interval", async () => {
    vi.useFakeTimers();
    const task = vi.fn().mockResolvedValue(undefined);
    const job = createRecurringJob({
      name: "test.delayed",
      intervalMs: 5000,
      initialDelayMs: 1000,
      task,
    });

    job.start();
    await vi.advanceTimersByTimeAsync(999);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(task).toHaveBeenCalledTimes(2);
    job.stop();
  });

  it("returns the active tick from stop so shutdown can await it", async () => {
    let release;
    const task = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const job = createRecurringJob({ name: "test.shutdown", intervalMs: 1000, task });

    job.start();
    await flushPromises();
    const stopped = job.stop();
    let settled = false;
    stopped.then(() => {
      settled = true;
    });
    await flushPromises();
    expect(settled).toBe(false);

    release();
    await stopped;
    expect(settled).toBe(true);
  });

  it("ignores a queued callback after stop", async () => {
    vi.useFakeTimers();
    const task = vi.fn().mockResolvedValue(undefined);
    const job = createRecurringJob({
      name: "test.queued",
      intervalMs: 1000,
      initialDelayMs: 1000,
      task,
    });

    job.start();
    job.stop();
    await vi.runAllTimersAsync();
    expect(task).not.toHaveBeenCalled();
  });
});
