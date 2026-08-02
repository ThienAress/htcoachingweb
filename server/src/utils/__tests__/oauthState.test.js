import { describe, expect, it } from "vitest";
import {
  createOAuthState,
  isDevLoginEnabled,
  isLoopbackAddress,
  verifyOAuthState,
} from "../oauthState.js";

const secret = "oauth-state-test-secret-with-enough-entropy";
const now = Date.parse("2026-08-02T10:00:00.000Z");
const nonce = "browser-nonce-a".repeat(4);
const state = () =>
  createOAuthState({
    secret,
    clientUrl: "https://app.example.com",
    nonce,
    now,
  });

describe("OAuth state binding", () => {
  it("accepts state only for the browser that started login", () => {
    expect(
      verifyOAuthState({
        state: state(),
        secret,
        expectedNonce: nonce,
        now: now + 30_000,
      }),
    ).toEqual(expect.objectContaining({ nonce }));
  });

  it("rejects another browser or an expired state", () => {
    expect(
      verifyOAuthState({
        state: state(),
        secret,
        expectedNonce: "another-browser-nonce".repeat(4),
        now,
      }),
    ).toBeNull();
    expect(
      verifyOAuthState({
        state: state(),
        secret,
        expectedNonce: nonce,
        now: now + 5 * 60 * 1000 + 1,
      }),
    ).toBeNull();
  });

  it("rejects a tampered state", () => {
    const original = state();
    const tampered =
      original.slice(0, -1) + (original.endsWith("a") ? "b" : "a");
    expect(
      verifyOAuthState({
        state: tampered,
        secret,
        expectedNonce: nonce,
        now,
      }),
    ).toBeNull();
  });
});

describe("dev-login guard", () => {
  it("requires explicit development opt-in and loopback", () => {
    expect(
      isDevLoginEnabled({
        NODE_ENV: "development",
        ENABLE_DEV_LOGIN: "true",
      }),
    ).toBe(true);
    expect(isDevLoginEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("203.0.113.10")).toBe(false);
  });
});
