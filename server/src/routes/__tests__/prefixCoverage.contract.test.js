import { describe, expect, it } from "vitest";

import { TODAY_PLATFORM_API_PREFIXES } from "../../config/todayPlatform.js";
import { scanServerEntry } from "./apiNamingScan.js";
import {
  clientApiPaths,
  collectClientApiPaths,
  collectServerApiPaths,
  isMountedPath,
  serverApiPaths,
  unmountedPaths,
} from "./prefixCoverageScan.js";

// Cổng kiểm chéo: nhiều chỗ bám vào một tiền tố /api (rate limiter, cổng auth, cổng tính năng "Today Platform", URL do server tự dựng,
// đường dẫn trong client). Đổi tên tiền tố ở bảng mount mà quên một trong các chỗ đó sẽ làm mất chốt chặn hoặc gọi vào đường không tồn tại.
// Test này làm CI đỏ ngay khi một chỗ bám trỏ vào tiền tố không còn được mount.
const { mounts, guards, inlineRoutes } = scanServerEntry();
const mountPrefixes = [...mounts.map((mount) => mount.prefix), ...inlineRoutes.map((route) => route.path)];
const guardedBy = (prefix) =>
  guards
    .filter((guard) => guard.prefix === prefix && /Limiter$|^require\w+/.test(guard.guard))
    .map((guard) => guard.guard)
    .sort();

describe("prefixes that other code depends on", () => {
  it("reads the real mount table (guards the scanner itself)", () => {
    expect(mounts.length).toBeGreaterThan(40);
    expect(mountPrefixes).toContain("/api/orders");
    expect(mountPrefixes).toContain("/api/me/wallet");
  });

  it("keeps the rate limiters and the auth gate on the prefixes the project relies on", () => {
    expect(guardedBy("/api")).toEqual(["globalLimiter"]);
    expect(guardedBy("/api/auth")).toEqual(["authLimiter", "requireAuthCutoverOpen"]);
    expect(guardedBy("/api/orders")).toEqual(["apiLimiter"]);
    expect(guardedBy("/api/check-ins")).toEqual(["apiLimiter"]);
    expect(guardedBy("/api/contact-messages")).toEqual(["contactLimiter"]);
  });

  it("has a mounted router behind every guarded prefix", () => {
    const guardedPrefixes = guards.filter((guard) => /Limiter$|^require\w+/.test(guard.guard)).map((guard) => guard.prefix);

    expect(unmountedPaths(guardedPrefixes, mountPrefixes)).toEqual([]);
  });

  it("has a mounted router behind every Today Platform feature-gate prefix", () => {
    expect(TODAY_PLATFORM_API_PREFIXES.length).toBeGreaterThan(0);
    expect(unmountedPaths(TODAY_PLATFORM_API_PREFIXES, mountPrefixes)).toEqual([]);
    for (const prefix of TODAY_PLATFORM_API_PREFIXES) {
      expect(mountPrefixes, `${prefix} must be mounted exactly, not as a sub-path`).toContain(prefix);
    }
  });

  it("builds only URLs that point at a mounted prefix (server side)", () => {
    const found = collectServerApiPaths();
    const missing = unmountedPaths(found.map((item) => item.apiPath), mountPrefixes);

    expect(found.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });

  it("calls only mounted prefixes from the client services", () => {
    const found = collectClientApiPaths();
    const missing = unmountedPaths(found.map((item) => item.apiPath), mountPrefixes);

    expect(found.length).toBeGreaterThan(200);
    expect(missing).toEqual([]);
  });
});

describe("the cross-check detects a rename that forgot a dependant", () => {
  const afterRename = mountPrefixes.map((prefix) => (prefix === "/api/orders" ? "/api/order-list" : prefix));

  it("flags the rate limiter that still points at the old prefix", () => {
    expect(unmountedPaths(["/api/orders"], afterRename)).toEqual(["/api/orders"]);
    expect(unmountedPaths(["/api/check-ins"], afterRename)).toEqual([]);
  });

  it("flags a client call and a server-built URL that still use the old prefix", () => {
    expect(unmountedPaths(clientApiPaths('api.get("/orders/me")'), afterRename)).toEqual(["/api/orders/me"]);
    expect(unmountedPaths(serverApiPaths('const link = `/api/orders/${id}`;'), afterRename)).toEqual(["/api/orders"]);
  });

  it("accepts sub-paths and ignores comments", () => {
    expect(isMountedPath("/api/orders/123/approve", mountPrefixes)).toBe(true);
    expect(serverApiPaths("// see /api/orders/old\nconst x = 1;")).toEqual([]);
    expect(clientApiPaths("// api.get('/gone')")).toEqual([]);
  });
});
