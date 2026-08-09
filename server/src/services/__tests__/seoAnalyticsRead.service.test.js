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
import AnalyticsSyncState from "../../models/AnalyticsSyncState.js";
import BlogPost from "../../models/BlogPost.js";
import ContactMessage from "../../models/ContactMessage.js";
import SeoDailyMetric from "../../models/SeoDailyMetric.js";
import F1Customer from "../../models/F1Customer.js";
import { createSeoAnalyticsReadService } from "../seoAnalyticsRead.service.js";

const dateRange = { startDate: "2026-08-01", endDate: "2026-08-05" };
const blogPath = "/blog/cach-tinh-macro/";

const metric = (overrides) => ({
  provider: "ga4",
  dateKey: "2026-08-05",
  dimension: "overview",
  dimensionKey: "all",
  contentPath: "",
  metrics: {},
  syncedAt: new Date("2026-08-06T00:00:00.000Z"),
  ...overrides,
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

const seedAnalytics = async () => {
  await BlogPost.create({
    title: "Cách tính Macro",
    slug: "cach-tinh-macro",
    category: "dinh-duong",
    status: "published",
    views: 147,
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
  });
  await SeoDailyMetric.insertMany([
    metric({
      provider: "gsc",
      metrics: { impressions: 100, clicks: 12, ctr: 0.12, position: 4.5 },
    }),
    metric({ metrics: { activeUsers: 20, newUsers: 7, returningUsers: 13 } }),
    metric({
      provider: "gsc",
      dimension: "page",
      dimensionKey: blogPath,
      metrics: { impressions: 80, clicks: 10, ctr: 0.125, position: 3.2 },
    }),
    metric({
      dimension: "page",
      dimensionKey: blogPath,
      metrics: { activeUsers: 16 },
    }),
    metric({
      dimension: "event",
      dimensionKey: "blog_read_engaged",
      contentPath: blogPath,
      metrics: { engagedReads: 9 },
    }),
    metric({
      dimension: "event",
      dimensionKey: "consultation_cta_click",
      contentPath: blogPath,
      metrics: { ctaClicks: 4 },
    }),
    metric({
      provider: "gsc",
      dimension: "query",
      dimensionKey: "cách tính macro",
      contentPath: blogPath,
      metrics: { impressions: 60, clicks: 8, ctr: 0.133, position: 2.8 },
    }),
    metric({
      dimension: "source_medium",
      dimensionKey: "google/organic",
      contentPath: blogPath,
      metrics: { activeUsers: 12 },
    }),
    metric({
      dimension: "device",
      dimensionKey: "mobile",
      contentPath: blogPath,
      metrics: { activeUsers: 11 },
    }),
  ]);
  await ContactMessage.create({
    name: "Private Lead",
    email: "private@example.com",
    phone: "0912345678",
    social: "https://www.facebook.com/test.user",
    package: "ONLINE",
    createdAt: new Date("2026-08-05T10:00:00.000Z"),
    attribution: {
      source: "google",
      medium: "organic",
      campaign: "macro",
      referrerHost: "google.com",
      landingPath: blogPath,
      contentType: "blog",
      contentSlug: "cach-tinh-macro",
      capturedAt: new Date("2026-08-05T09:00:00.000Z"),
    },
  });
  await AnalyticsSyncState.create({
    provider: "ga4",
    status: "success",
    lastSuccessAt: new Date("2026-08-06T00:00:00.000Z"),
  });
};

const service = () =>
  createSeoAnalyticsReadService({
    providerConfiguration: { ga4: true, gsc: false },
    now: () => new Date("2026-08-06T12:00:00.000Z"),
  });

describe("SEO analytics read model", () => {
  it("returns overview với source units tách biệt và DB leads canonical", async () => {
    await seedAnalytics();

    const result = await service().getOverview(dateRange);

    expect(result.kpis).toMatchObject({
      impressions: 100,
      clicks: 12,
      activeUsers: 20,
      returningUsers: 13,
      leads: 1,
    });
    expect(result.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: "ga4", health: "ready" }),
        expect.objectContaining({ provider: "gsc", health: "not_configured" }),
      ]),
    );
  });

  it("returns server-paginated Blog metrics và legacy views riêng", async () => {
    await seedAnalytics();

    const result = await service().getBlogPerformance({
      ...dateRange,
      page: 1,
      limit: 10,
      sort: "clicks",
      direction: "desc",
    });

    expect(result.pagination).toMatchObject({ total: 1, page: 1, totalPages: 1 });
    expect(result.items[0]).toMatchObject({
      slug: "cach-tinh-macro",
      legacyViews: 147,
      clicks: 10,
      impressions: 80,
      activeUsers: 16,
      engagedReads: 9,
      ctaClicks: 4,
      leads: 1,
    });
  });

  it("returns Keyword aggregate với ranking page và deterministic label", async () => {
    await seedAnalytics();

    const result = await service().getKeywordPerformance({
      ...dateRange,
      page: 1,
      limit: 10,
      sort: "clicks",
      direction: "desc",
    });

    expect(result.items[0]).toMatchObject({
      query: "cách tính macro",
      rankingPage: blogPath,
      clicks: 8,
      impressions: 60,
      position: 2.8,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("returns Blog detail trend/query/source/device/funnel không có lead PII", async () => {
    await seedAnalytics();

    const result = await service().getBlogDetail({
      slug: "cach-tinh-macro",
      ...dateRange,
    });

    expect(result).toMatchObject({
      blog: { slug: "cach-tinh-macro", legacyViews: 147 },
      sources: [{ key: "google/organic", activeUsers: 12 }],
      devices: [{ key: "mobile", activeUsers: 11 }],
      funnel: { activeUsers: 16, engagedReads: 9, ctaClicks: 4, leads: 1 },
    });
    expect(JSON.stringify(result)).not.toContain("Private Lead");
  });

  it("adds explicit assessment/customer stages without matching lead PII", async () => {
    await seedAnalytics();
    const lead = await ContactMessage.findOne({}).select("_id").lean();
    await F1Customer.create({
      code: "F1-SEO-CONVERSION",
      fullName: "Converted Customer",
      age: 30,
      gender: "female",
      createdBy: lead._id,
      originContactMessageId: lead._id,
      status: "program_started",
    });

    const [overview, detail] = await Promise.all([
      service().getOverview(dateRange),
      service().getBlogDetail({ slug: "cach-tinh-macro", ...dateRange }),
    ]);

    expect(overview.kpis).toMatchObject({ assessments: 1, customers: 1 });
    expect(detail.funnel).toMatchObject({ assessments: 1, customers: 1 });
  });
});
