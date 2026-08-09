import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCollections,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import AnalyticsSyncState from "../AnalyticsSyncState.js";
import SeoDailyMetric from "../SeoDailyMetric.js";

const metricFields = {
  provider: "gsc",
  dateKey: "2026-08-05",
  dimension: "page",
  dimensionKey: "/blog/cach-tinh-macro/",
  metrics: {
    impressions: 100,
    clicks: 12,
    ctr: 0.12,
    position: 4.5,
  },
  syncedAt: new Date("2026-08-06T00:00:00.000Z"),
};

beforeAll(async () => {
  await setupTestDB();
  await Promise.all([SeoDailyMetric.init(), AnalyticsSyncState.init()]);
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("SEO analytics models", () => {
  it("lưu aggregate bounded không chứa raw provider payload", async () => {
    const metric = await SeoDailyMetric.create(metricFields);

    expect(metric.toObject()).toMatchObject({
      provider: "gsc",
      dimension: "page",
      dimensionKey: "/blog/cach-tinh-macro/",
      metrics: { clicks: 12, impressions: 100 },
    });
    expect(metric.toObject()).not.toHaveProperty("rawPayload");
  });

  it("enforce unique provider/date/dimension/key cho idempotent upsert", async () => {
    await SeoDailyMetric.create(metricFields);

    await expect(SeoDailyMetric.create(metricFields)).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("reject dimension key có query, URL hoặc hình dạng PII", async () => {
    const unsafeMetric = new SeoDailyMetric({
      ...metricFields,
      dimension: "query",
      dimensionKey: "private@example.com",
    });

    await expect(unsafeMetric.validate()).rejects.toThrow();
  });

  it("khởi tạo provider-disabled state không cần cursor/error", async () => {
    const state = await AnalyticsSyncState.create({ provider: "ga4" });

    expect(state.toObject()).toMatchObject({
      provider: "ga4",
      status: "disabled",
      lastErrorCode: "",
      lastErrorMessage: "",
    });
  });

  it("reject sync state chứa raw provider payload", () => {
    expect(
      () =>
        new AnalyticsSyncState({
          provider: "gsc",
          rawPayload: { private: true },
        }),
    ).toThrow();
  });

  it("reject provider error message vượt giới hạn", async () => {
    const state = new AnalyticsSyncState({
      provider: "gsc",
      status: "error",
      lastErrorCode: "PROVIDER_ERROR",
      lastErrorMessage: "x".repeat(201),
    });

    await expect(state.validate()).rejects.toThrow();
  });
});
