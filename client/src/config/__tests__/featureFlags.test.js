import { describe, expect, it } from "vitest";
import { getTodayPlatformMode } from "../featureFlags";

describe("Today platform feature flag", () => {
  it("fails closed when the build flag is missing or invalid", () => {
    expect(getTodayPlatformMode({})).toEqual({ enabled: false, explicit: false });
    expect(
      getTodayPlatformMode({ VITE_TODAY_PLATFORM_ENABLED: "enabled" }),
    ).toEqual({ enabled: false, explicit: false });
  });

  it("enables the platform only for an explicit true value", () => {
    expect(
      getTodayPlatformMode({ VITE_TODAY_PLATFORM_ENABLED: "true" }),
    ).toEqual({ enabled: true, explicit: true });
    expect(
      getTodayPlatformMode({ VITE_TODAY_PLATFORM_ENABLED: "false" }),
    ).toEqual({ enabled: false, explicit: true });
  });
});
