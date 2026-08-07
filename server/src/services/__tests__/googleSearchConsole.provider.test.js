import { describe, expect, it, vi } from "vitest";

import { createSearchConsoleProvider } from "../googleSearchConsole.provider.js";

const rowsFor = (dimensions) => {
  const key = dimensions.join(",");
  if (key === "date") {
    return [{ keys: ["2026-08-05"], clicks: 12, impressions: 100, ctr: 0.12, position: 4.5 }];
  }
  if (key === "date,page") {
    return [{ keys: ["2026-08-05", "https://htcoachingweb.io.vn/blog/cach-tinh-macro/?private=1"], clicks: 8, impressions: 60, ctr: 0.133, position: 3.2 }];
  }
  if (key === "date,query,page") {
    return [
      { keys: ["2026-08-05", "cách tính macro", "https://htcoachingweb.io.vn/blog/cach-tinh-macro/"], clicks: 6, impressions: 40, ctr: 0.15, position: 2.8 },
      { keys: ["2026-08-05", "private@example.com", "https://htcoachingweb.io.vn/blog/cach-tinh-macro/"], clicks: 1, impressions: 2, ctr: 0.5, position: 1 },
    ];
  }
  return [{ keys: ["2026-08-05", "MOBILE"], clicks: 7, impressions: 55, ctr: 0.127, position: 3.8 }];
};

describe("GSC read-only provider", () => {
  it("maps page/query/device rows và loại query có hình dạng PII", async () => {
    const query = vi.fn(async ({ requestBody }) => ({
      data: { rows: rowsFor(requestBody.dimensions) },
    }));
    const provider = createSearchConsoleProvider({
      client: { searchanalytics: { query } },
      siteUrl: "https://htcoachingweb.io.vn/",
    });

    const result = await provider.fetchWindow({
      startDate: "2026-08-05",
      endDate: "2026-08-05",
    });

    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dimension: "page",
          dimensionKey: "/blog/cach-tinh-macro/",
          metrics: expect.objectContaining({ clicks: 8, impressions: 60 }),
        }),
        expect.objectContaining({
          dimension: "query",
          dimensionKey: "cách tính macro",
          contentPath: "/blog/cach-tinh-macro/",
        }),
        expect.objectContaining({
          dimension: "device",
          dimensionKey: "mobile",
        }),
      ]),
    );
    expect(result.rows.some(({ dimensionKey }) => dimensionKey.includes("@"))).toBe(false);
    expect(result.topRowsOnly).toBe(true);
  });

  it("returns empty aggregate contract khi GSC không có rows", async () => {
    const provider = createSearchConsoleProvider({
      client: {
        searchanalytics: { query: vi.fn(async () => ({ data: { rows: [] } })) },
      },
      siteUrl: "https://htcoachingweb.io.vn/",
    });

    const result = await provider.fetchWindow({
      startDate: "2026-08-05",
      endDate: "2026-08-05",
    });

    expect(result).toMatchObject({ provider: "gsc", rows: [], partial: false });
  });

  it("classifies provider timeout without exposing raw error", async () => {
    const timeout = new Error("credential-private-value");
    timeout.code = "ETIMEDOUT";
    const provider = createSearchConsoleProvider({
      client: { searchanalytics: { query: vi.fn().mockRejectedValue(timeout) } },
      siteUrl: "https://htcoachingweb.io.vn/",
    });

    await expect(
      provider.fetchWindow({ startDate: "2026-08-05", endDate: "2026-08-05" }),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", provider: "gsc" });
  });
});
