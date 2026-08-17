import { afterEach, describe, expect, it, vi } from "vitest";

import { startSePayReconciliationJob } from "../sepayReconciliationJob.js";

describe("SePay reconciliation background job", () => {
  afterEach(() => {
    delete process.env.SEPAY_ENABLED;
    delete process.env.SEPAY_RECONCILIATION_ENABLED;
    delete process.env.SEPAY_RECONCILIATION_INTERVAL_MS;
    vi.restoreAllMocks();
  });

  it("does not schedule work while automation is disabled", () => {
    const setTimer = vi.fn();
    const job = startSePayReconciliationJob({ setTimer });

    expect({ started: job.started, schedules: setTimer.mock.calls.length }).toEqual({
      started: false,
      schedules: 0,
    });
  });

  it("uses the provider Retry-After delay after a 429 response", async () => {
    process.env.SEPAY_ENABLED = "true";
    process.env.SEPAY_RECONCILIATION_ENABLED = "true";
    const callbacks = [];
    const setTimer = vi.fn((callback, delay) => {
      callbacks.push(callback);
      return { delay, unref: vi.fn() };
    });
    const error = Object.assign(new Error("rate limited"), {
      code: "SEPAY_API_RATE_LIMITED",
      retryAfterMs: 2400,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const job = startSePayReconciliationJob({
      run: vi.fn().mockRejectedValue(error),
      setTimer,
    });
    await callbacks[0]();

    expect({
      started: job.started,
      firstDelay: setTimer.mock.calls[0][1],
      retryDelay: setTimer.mock.calls[1][1],
    }).toEqual({ started: true, firstDelay: 0, retryDelay: 2400 });
  });

  it("stops future schedules and lets shutdown await the active run", async () => {
    process.env.SEPAY_ENABLED = "true";
    process.env.SEPAY_RECONCILIATION_ENABLED = "true";
    const callbacks = [];
    const setTimer = vi.fn((callback, delay) => {
      callbacks.push(callback);
      return { delay, unref: vi.fn() };
    });
    let releaseRun;
    const run = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseRun = () =>
            resolve({ imported: 0, processed: 0, deferred: 0, locked: 0 });
        }),
    );
    vi.spyOn(console, "log").mockImplementation(() => {});

    const job = startSePayReconciliationJob({ run, setTimer });
    const activeRun = callbacks[0]();
    await Promise.resolve();
    const stopped = job.stop();

    releaseRun();
    await Promise.all([activeRun, stopped]);

    expect(run).toHaveBeenCalledTimes(1);
    expect(setTimer).toHaveBeenCalledTimes(1);
  });
});
