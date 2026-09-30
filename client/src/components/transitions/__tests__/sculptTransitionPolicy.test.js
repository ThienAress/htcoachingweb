import { describe, expect, test } from "vitest";

import { getSculptTransitionDecision } from "../sculptTransitionPolicy";

const baseIntent = {
  targetHref: "https://htcoachingweb.io.vn/exercises/",
  currentHref: "https://htcoachingweb.io.vn/blog",
};

describe("getSculptTransitionDecision", () => {
  test.each([
    "https://htcoachingweb.io.vn/exercises",
    "https://htcoachingweb.io.vn/exercises/?muscle=chest",
    "https://htcoachingweb.io.vn/tdee-calculator/",
  ])("mở preview loop với exact route %s", (targetHref) => {
    const decision = getSculptTransitionDecision({
      ...baseIntent,
      targetHref,
    });

    expect(decision).toMatchObject({
      openPreview: true,
      motionEnabled: true,
      reason: "eligible",
    });
  });

  test.each([
    "https://htcoachingweb.io.vn/exercises/abc/day-nguc",
    "https://htcoachingweb.io.vn/blog",
    "https://example.com/exercises",
  ])("không áp dụng cho route ngoài phạm vi %s", (targetHref) => {
    const decision = getSculptTransitionDecision({
      ...baseIntent,
      targetHref,
    });

    expect(decision.openPreview).toBe(false);
  });

  test("không áp dụng cooldown cho preview", () => {
    const decision = getSculptTransitionDecision({
      ...baseIntent,
      now: 159_999,
      cooldownStartedAt: 100_000,
    });

    expect(decision).toMatchObject({
      openPreview: true,
      motionEnabled: true,
      reason: "eligible",
    });
  });

  test.each([
    ["reduced-motion", { reducedMotion: true }],
    ["save-data", { saveData: true }],
  ])("mở preview tĩnh cho %s và không điều hướng", (_label, override) => {
    const decision = getSculptTransitionDecision({
      ...baseIntent,
      ...override,
    });

    expect(decision).toMatchObject({
      openPreview: true,
      motionEnabled: false,
      reason: _label,
    });
  });

  test.each([
    ["click đã được xử lý", { defaultPrevented: true }],
    ["click chuột không phải nút trái", { button: 1 }],
    ["Ctrl-click", { ctrlKey: true }],
    ["Meta-click", { metaKey: true }],
    ["Shift-click", { shiftKey: true }],
    ["Alt-click", { altKey: true }],
    ["tab mới", { linkTarget: "_blank" }],
    ["download", { download: true }],
  ])("giữ nguyên semantics cho %s", (_label, override) => {
    const decision = getSculptTransitionDecision({
      ...baseIntent,
      ...override,
    });

    expect(decision.openPreview).toBe(false);
  });

  test("vẫn mở preview khi link trùng URL hiện tại", () => {
    const decision = getSculptTransitionDecision({
      ...baseIntent,
      currentHref: baseIntent.targetHref,
    });

    expect(decision).toMatchObject({
      openPreview: true,
      motionEnabled: true,
      reason: "eligible",
    });
  });

  test("vẫn mở preview khi URL chỉ khác dấu gạch chéo cuối", () => {
    const decision = getSculptTransitionDecision({
      ...baseIntent,
      targetHref: "https://htcoachingweb.io.vn/exercises",
      currentHref: "https://htcoachingweb.io.vn/exercises/",
    });

    expect(decision).toMatchObject({
      openPreview: true,
      motionEnabled: true,
      reason: "eligible",
    });
  });

  test("preview không tạo navigation target", () => {
    const decision = getSculptTransitionDecision({
      ...baseIntent,
      targetHref:
        "https://htcoachingweb.io.vn/tdee-calculator/?goal=cut#results",
    });

    expect(decision.navigationTarget).toBeNull();
  });
});
