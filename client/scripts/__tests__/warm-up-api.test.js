import { describe, expect, test } from "vitest";
import { WARM_UP_PATH, warmUpApi } from "../warm-up-api.js";

const STAGING = "https://htcoachingweb-staging.onrender.com/api";

const silentLogger = () => {
  const lines = { log: [], warn: [] };
  return {
    lines,
    log: (message) => lines.log.push(message),
    warn: (message) => lines.warn.push(message),
  };
};

const fakeClock = () => {
  let current = 0;
  return {
    now: () => current,
    sleep: async (ms) => {
      current += ms;
    },
    advance: (ms) => {
      current += ms;
    },
  };
};

describe("warmUpApi", () => {
  test("pings the configured API once when it is already awake", async () => {
    const calls = [];
    const clock = fakeClock();

    const result = await warmUpApi({
      env: { VITE_API_URL: STAGING },
      fetchApi: async (url) => calls.push(url),
      sleep: clock.sleep,
      now: clock.now,
      logger: silentLogger(),
    });

    expect(result.status).toBe("ready");
    expect(calls).toEqual([STAGING + WARM_UP_PATH]);
  });

  test("keeps retrying while the API is waking up, then succeeds", async () => {
    const clock = fakeClock();
    let attempts = 0;

    const result = await warmUpApi({
      env: { VITE_API_URL: STAGING },
      fetchApi: async () => {
        attempts += 1;
        if (attempts < 4) throw new Error("timeout of 60000ms exceeded");
      },
      sleep: clock.sleep,
      now: clock.now,
      logger: silentLogger(),
    });

    expect(result.status).toBe("ready");
    expect(result.results[0].attempts).toBe(4);
  });

  test("gives up after the time budget without throwing", async () => {
    const clock = fakeClock();
    const logger = silentLogger();

    const result = await warmUpApi({
      env: { VITE_API_URL: STAGING, WARMUP_API_TOTAL_MS: "20000" },
      fetchApi: async () => {
        clock.advance(6_000);
        throw new Error("ECONNABORTED");
      },
      sleep: clock.sleep,
      now: clock.now,
      logger,
    });

    expect(result.status).toBe("unreachable");
    expect(logger.lines.warn.join(" ")).toContain("did not respond");
  });

  test("skips static-only builds and missing API URLs", async () => {
    const skipStatic = await warmUpApi({
      env: { SKIP_DYNAMIC_ROUTES: "true", VITE_API_URL: STAGING },
      fetchApi: async () => {
        throw new Error("must not be called");
      },
      logger: silentLogger(),
    });
    const noUrl = await warmUpApi({ env: {}, logger: silentLogger() });

    expect(skipStatic.status).toBe("skipped");
    expect(noUrl.status).toBe("skipped");
  });

  test("never pings a non-HTTPS or credentialed URL", async () => {
    const calls = [];

    const result = await warmUpApi({
      env: { VITE_API_URL: "http://user:pass@example.com/api" },
      fetchApi: async (url) => calls.push(url),
      logger: silentLogger(),
    });

    expect(calls).toEqual([]);
    expect(result.status).toBe("skipped");
  });

  test("pings the sitemap and prerender URLs when they differ", async () => {
    const calls = [];

    await warmUpApi({
      env: {
        SITEMAP_API_URL: STAGING,
        PRERENDER_API_URL: "https://other.onrender.com/api",
      },
      fetchApi: async (url) => calls.push(url),
      logger: silentLogger(),
    });

    expect(calls).toEqual([
      STAGING + WARM_UP_PATH,
      "https://other.onrender.com/api" + WARM_UP_PATH,
    ]);
  });
});
