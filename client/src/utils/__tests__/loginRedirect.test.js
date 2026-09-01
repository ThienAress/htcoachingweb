import { describe, expect, it } from "vitest";

import {
  consumeLoginRedirect,
  normalizeLoginRedirect,
  rememberLoginRedirect,
} from "../loginRedirect";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
};

describe("login redirect", () => {
  it("keeps an internal dashboard path including query and hash", () => {
    const path =
      "/dashboard/today/2026-08-29/journal?source=email#customer-health-goals-title";

    expect(normalizeLoginRedirect(path)).toBe(path);
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
    "/dashboard/\\evil",
    "/dashboard/health\nnext",
    "dashboard/today",
  ])("rejects unsafe redirect %s", (value) => {
    expect(normalizeLoginRedirect(value)).toBe("/");
  });

  it("remembers and consumes the safe path once", () => {
    const storage = createStorage();
    const path =
      "/dashboard/today/2026-08-29/journal#customer-health-goals-title";

    rememberLoginRedirect(path, storage);

    expect(consumeLoginRedirect(storage)).toBe(path);
    expect(consumeLoginRedirect(storage)).toBe("/");
  });
});
