import { describe, expect, it, vi } from "vitest";

import {
  createBlogEngagementTracker,
  startBlogEngagementTracking,
} from "../useBlogEngagement";

describe("blog engagement tracker", () => {
  it("chỉ track một lần khi đủ 30 giây active và 50% scroll", () => {
    let now = 0;
    const track = vi.fn();
    const tracker = createBlogEngagementTracker({ now: () => now, track });

    tracker.recordScroll(0.6);
    now = 29_999;
    tracker.tick();
    expect(track).not.toHaveBeenCalled();

    now = 30_000;
    tracker.tick();
    tracker.tick();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("không cộng thời gian khi tab inactive", () => {
    let now = 0;
    const track = vi.fn();
    const tracker = createBlogEngagementTracker({ now: () => now, track });

    now = 10_000;
    tracker.tick();
    tracker.setActive(false);
    now = 40_000;
    tracker.tick();
    tracker.setActive(true);
    tracker.recordScroll(0.8);
    now = 59_999;
    tracker.tick();
    expect(track).not.toHaveBeenCalled();

    now = 60_000;
    tracker.tick();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("cleanup toàn bộ listener và timer", () => {
    const windowObject = {
      innerHeight: 600,
      scrollY: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const documentObject = {
      visibilityState: "visible",
      hasFocus: () => true,
      documentElement: { scrollHeight: 1_200 },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const clearIntervalFn = vi.fn();

    const cleanup = startBlogEngagementTracking({
      slug: "macro-guide",
      category: "nutrition",
      language: "vi",
      windowObject,
      documentObject,
      setIntervalFn: () => 99,
      clearIntervalFn,
      track: vi.fn(),
      rememberContent: vi.fn(),
    });
    cleanup();

    expect(clearIntervalFn).toHaveBeenCalledWith(99);
    expect(windowObject.removeEventListener).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
    expect(documentObject.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });
});
