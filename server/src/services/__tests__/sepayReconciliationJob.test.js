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
});
