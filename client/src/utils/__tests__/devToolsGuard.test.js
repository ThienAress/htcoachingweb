import { describe, expect, it, vi } from "vitest";

import {
  shouldEnableDevToolsGuard,
  startDevToolsDetection,
} from "../devToolsGuard";

describe("shouldEnableDevToolsGuard", () => {
  it.each([
    ["production guest", true, false, null, true],
    ["production user", true, false, "user", true],
    ["production trainer", true, false, "trainer", true],
    ["production admin", true, false, "admin", false],
    ["auth loading", true, true, null, false],
    ["development", false, false, "user", false],
  ])(
    "returns the expected policy for %s",
    (_label, isProduction, authLoading, role, expected) => {
      expect(
        shouldEnableDevToolsGuard({ isProduction, authLoading, role }),
      ).toBe(expected);
    },
  );
});

describe("startDevToolsDetection", () => {
  it("starts the detector and cleans up its listener", () => {
    const detector = {
      addListener: vi.fn(),
      launch: vi.fn(),
      removeListener: vi.fn(),
      setDetectDelay: vi.fn(),
      stop: vi.fn(),
    };
    const onStatusChange = vi.fn();

    const cleanup = startDevToolsDetection(detector, onStatusChange);
    cleanup();

    expect({
      added: detector.addListener.mock.calls[0]?.[0],
      delay: detector.setDetectDelay.mock.calls[0]?.[0],
      launched: detector.launch.mock.calls.length,
      removed: detector.removeListener.mock.calls[0]?.[0],
      stopped: detector.stop.mock.calls.length,
    }).toEqual({
      added: onStatusChange,
      delay: 1000,
      launched: 1,
      removed: onStatusChange,
      stopped: 1,
    });
  });
});
