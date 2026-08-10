import { describe, expect, it, vi } from "vitest";

import {
  createDefaultGa4Provider,
  createGa4Provider,
} from "../googleAnalytics.provider.js";

const row = (dimensions, metrics) => ({
  dimensionValues: dimensions.map((value) => ({ value })),
  metricValues: metrics.map((value) => ({ value: String(value) })),
});

const responseFor = (request) => {
  const dimensions = request.dimensions.map(({ name }) => name).join(",");
  if (dimensions === "") return { rows: [row([], [20, 7])] };
  if (dimensions === "newVsReturning") {
    return { rows: [row(["new"], [7]), row(["returning"], [13])] };
  }
  if (dimensions === "date,pagePath") {
    return { rows: [row(["20260805", "/blog/cach-tinh-macro/?private=1"], [12])] };
  }
  if (dimensions === "date,sessionSource,sessionMedium") {
    return { rows: [row(["20260805", "Google", "Organic"], [15])] };
  }
  if (dimensions === "date,pagePath,sessionSource,sessionMedium") {
    return {
      rows: [
        row(
          ["20260805", "/blog/cach-tinh-macro/", "Google", "Organic"],
          [10],
        ),
      ],
    };
  }
  if (dimensions === "date,deviceCategory") {
    return { rows: [row(["20260805", "mobile"], [9])] };
  }
  if (dimensions === "date,pagePath,deviceCategory") {
    return {
      rows: [row(["20260805", "/blog/cach-tinh-macro/", "mobile"], [7])],
    };
  }
  if (dimensions === "date,eventName,customEvent:content_slug") {
    return {
      rows: [
        row(["20260805", "blog_read_engaged", "cach-tinh-macro"], [6]),
      ],
    };
  }
  return {
    rows: [
      row(["20260805", "blog_read_engaged"], [8]),
      row(["20260805", "private_custom_event"], [99]),
    ],
  };
};

describe("GA4 read-only provider", () => {
  it("maps bounded GA4 reports thành aggregate rows", async () => {
    const client = { runReport: vi.fn(async (request) => [responseFor(request)]) };
    const provider = createGa4Provider({
      client,
      propertyId: "123456",
      hostname: "htcoachingweb.io.vn",
    });

    const result = await provider.fetchWindow({
      startDate: "2026-08-05",
      endDate: "2026-08-05",
    });

    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "ga4",
          dataScope: "production",
          dateKey: "2026-08-05",
          dimension: "overview_window",
          dimensionKey: "2026-08-05_2026-08-05",
          metrics: expect.objectContaining({
            activeUsers: 20,
            newUsers: 7,
            returningUsers: 13,
          }),
        }),
        expect.objectContaining({
          dimension: "page",
          dimensionKey: "/blog/cach-tinh-macro/",
          metrics: { activeUsers: 12 },
        }),
        expect.objectContaining({
          dimension: "event",
          dimensionKey: "blog_read_engaged",
          metrics: { engagedReads: 8 },
        }),
        expect.objectContaining({
          dimension: "event",
          dimensionKey: "blog_read_engaged",
          contentPath: "/blog/cach-tinh-macro/",
          metrics: { engagedReads: 6 },
        }),
      ]),
    );
    expect(result.rows.some(({ dimensionKey }) => dimensionKey === "private_custom_event")).toBe(false);
    expect(client.runReport).toHaveBeenCalledWith(
      expect.objectContaining({
        dimensionFilter: {
          filter: {
            fieldName: "hostName",
            stringFilter: {
              matchType: "EXACT",
              value: "htcoachingweb.io.vn",
              caseSensitive: false,
            },
          },
        },
      }),
      expect.any(Object),
    );
  });

  it("returns empty aggregate contract khi GA4 không có rows", async () => {
    const client = { runReport: vi.fn(async () => [{ rows: [] }]) };
    const provider = createGa4Provider({ client, propertyId: "123456", hostname: "htcoachingweb.io.vn" });

    const result = await provider.fetchWindow({
      startDate: "2026-08-05",
      endDate: "2026-08-05",
    });

    expect(result).toMatchObject({ provider: "ga4", rows: [], partial: false });
  });

  it("classifies provider timeout without exposing raw error", async () => {
    const timeout = new Error("credential-private-value");
    timeout.code = 4;
    const provider = createGa4Provider({
      client: { runReport: vi.fn().mockRejectedValue(timeout) },
      propertyId: "123456",
      hostname: "htcoachingweb.io.vn",
    });

    await expect(
      provider.fetchWindow({ startDate: "2026-08-05", endDate: "2026-08-05" }),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", provider: "ga4" });
  });

  it("giữ core rows và đánh dấu partial khi custom blog dimension chưa đăng ký", async () => {
    const client = {
      runReport: vi.fn(async (request) => {
        const dimensions = request.dimensions.map(({ name }) => name).join(",");
        if (dimensions.includes("customEvent:")) throw new Error("invalid dimension");
        return [responseFor(request)];
      }),
    };
    const provider = createGa4Provider({ client, propertyId: "123456", hostname: "htcoachingweb.io.vn" });

    const result = await provider.fetchWindow({
      startDate: "2026-08-05",
      endDate: "2026-08-05",
    });

    expect(result.partial).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it("không cấu hình provider ngoài APP_ENV production", () => {
    const provider = createDefaultGa4Provider({
      env: {
        APP_ENV: "staging",
        GA4_PROPERTY_ID: "123456",
        GA4_HOSTNAME: "htcoachingweb.io.vn",
        GOOGLE_SERVICE_ACCOUNT_JSON: "private-value-must-not-be-read",
      },
    });

    expect(provider).toEqual({ provider: "ga4", configured: false });
  });
});
