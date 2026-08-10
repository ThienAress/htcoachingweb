import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearCollections,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import AnalyticsSyncState from "../../models/AnalyticsSyncState.js";
import SeoDailyMetric from "../../models/SeoDailyMetric.js";
import { AnalyticsProviderError } from "../seoAnalyticsProvider.js";
import { createSeoAnalyticsSyncService } from "../seoAnalyticsSync.service.js";

const metricRow = {
  provider: "ga4",
  dataScope: "production",
  dateKey: "2026-08-05",
  dimension: "overview",
  dimensionKey: "all",
  contentPath: "",
  metrics: { activeUsers: 20, newUsers: 7, returningUsers: 13 },
};

const createService = (provider) =>
  createSeoAnalyticsSyncService({
    providers: { ga4: provider },
    now: () => new Date("2026-08-06T00:00:00.000Z"),
    createLockOwner: () => "test-lock-owner",
  });

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

describe("SEO analytics sync service", () => {
  it("upsert idempotent khi replay cùng provider window", async () => {
    const fetchWindow = vi
      .fn()
      .mockResolvedValueOnce({ provider: "ga4", rows: [metricRow], partial: false })
      .mockResolvedValueOnce({
        provider: "ga4",
        rows: [{ ...metricRow, metrics: { ...metricRow.metrics, activeUsers: 25 } }],
        partial: false,
      });
    const service = createService({ provider: "ga4", configured: true, fetchWindow });

    await service.syncProvider("ga4", {
      startDate: "2026-08-05",
      endDate: "2026-08-05",
    });
    await service.syncProvider("ga4", {
      startDate: "2026-08-05",
      endDate: "2026-08-05",
    });

    expect(await SeoDailyMetric.countDocuments()).toBe(1);
    expect((await SeoDailyMetric.findOne()).metrics.activeUsers).toBe(25);
    expect((await SeoDailyMetric.findOne()).dataScope).toBe("production");
  });

  it("không xóa stale cache khi provider trả partial window", async () => {
    await SeoDailyMetric.create({
      ...metricRow,
      dateKey: "2026-08-04",
      syncedAt: new Date("2026-08-05T00:00:00.000Z"),
    });
    const service = createService({
      provider: "ga4",
      configured: true,
      fetchWindow: vi.fn().mockResolvedValue({
        provider: "ga4",
        rows: [metricRow],
        partial: true,
      }),
    });

    const result = await service.syncProvider("ga4", {
      startDate: "2026-08-05",
      endDate: "2026-08-05",
    });

    expect(result.status).toBe("partial");
    expect(await SeoDailyMetric.countDocuments()).toBe(2);
  });

  it("giữ cache và sanitize state khi provider timeout", async () => {
    await SeoDailyMetric.create({
      ...metricRow,
      syncedAt: new Date("2026-08-05T00:00:00.000Z"),
    });
    const service = createService({
      provider: "ga4",
      configured: true,
      fetchWindow: vi.fn().mockRejectedValue(
        new AnalyticsProviderError("ga4", "PROVIDER_TIMEOUT", "private credential"),
      ),
    });

    await expect(
      service.syncProvider("ga4", {
        startDate: "2026-08-05",
        endDate: "2026-08-05",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
    expect(await SeoDailyMetric.countDocuments()).toBe(1);
    const state = await AnalyticsSyncState.findOne({ provider: "ga4" });
    expect(state.lastErrorMessage).not.toContain("private");
  });

  it("reject concurrent provider sync bằng DB lock", async () => {
    await AnalyticsSyncState.create({
      provider: "ga4",
      status: "running",
      lockOwner: "other-worker",
      lockUntil: new Date("2026-08-06T00:05:00.000Z"),
    });
    const service = createService({
      provider: "ga4",
      configured: true,
      fetchWindow: vi.fn(),
    });

    await expect(
      service.syncProvider("ga4", {
        startDate: "2026-08-05",
        endDate: "2026-08-05",
      }),
    ).rejects.toMatchObject({ code: "SYNC_IN_PROGRESS" });
  });

  it("records disabled state mà không gọi provider", async () => {
    const service = createService({ provider: "ga4", configured: false });

    const result = await service.syncProvider("ga4", {
      startDate: "2026-08-05",
      endDate: "2026-08-05",
    });

    expect(result).toMatchObject({ provider: "ga4", status: "disabled", rowsWritten: 0 });
    expect((await AnalyticsSyncState.findOne({ provider: "ga4" })).status).toBe("disabled");
  });
});
