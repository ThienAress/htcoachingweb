import { describe, expect, it, vi } from "vitest";

import {
  createAiNudgeTracker,
  isAiNudgeSuppressed,
} from "../useAiAssistantNudge.js";

describe("AI proactive nudge tracker", () => {
  const createStorage = (entries = {}) => {
    const values = new Map(Object.entries(entries));
    return { getItem: (key) => values.get(key) ?? null };
  };

  it("requires both active reading time and scroll depth", () => {
    let now = 0;
    const onReady = vi.fn();
    const tracker = createAiNudgeTracker({
      now: () => now,
      activeThresholdMs: 30_000,
      scrollThreshold: 0.5,
      onReady,
    });

    tracker.recordScroll(0.6);
    now = 29_000;
    tracker.tick();
    expect(onReady).not.toHaveBeenCalled();

    now = 30_000;
    tracker.tick();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("does not count time while the page is inactive", () => {
    let now = 0;
    const onReady = vi.fn();
    const tracker = createAiNudgeTracker({
      now: () => now,
      activeThresholdMs: 10_000,
      scrollThreshold: 0,
      onReady,
    });

    tracker.setActive(false);
    now = 20_000;
    tracker.tick();
    expect(onReady).not.toHaveBeenCalled();

    tracker.setActive(true);
    now = 30_000;
    tracker.tick();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("honors the global session cap and per-page snooze", () => {
    expect(
      isAiNudgeSuppressed({
        pathname: "/blog/test",
        sessionStorage: createStorage({ "ht-ai-nudge-shown": "1" }),
        localStorage: createStorage(),
      }),
    ).toBe(true);
    expect(
      isAiNudgeSuppressed({
        pathname: "/blog/test",
        now: () => 100,
        sessionStorage: createStorage(),
        localStorage: createStorage({
          "ht-ai-nudge-dismissed:/blog/test": "200",
        }),
      }),
    ).toBe(true);
  });
});
