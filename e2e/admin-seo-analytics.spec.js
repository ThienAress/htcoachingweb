import { expect, test } from "@playwright/test";

const overview = {
  range: { startDate: "2026-07-09", endDate: "2026-08-05" },
  kpis: {
    impressions: 1200,
    clicks: 144,
    ctr: 0.12,
    position: 4.5,
    activeUsers: 90,
    newUsers: 65,
    returningUsers: 25,
    engagedReads: 48,
    ctaClicks: 12,
    leads: 4,
    assessments: 2,
    customers: 1,
    unattributedAssessments: 0,
    unattributedCustomers: 0,
  },
  providers: [],
};

const providers = [
  {
    provider: "ga4",
    health: "stale",
    stale: true,
    lastSyncedAt: "2026-08-04T00:00:00.000Z",
  },
  {
    provider: "gsc",
    health: "not_configured",
    lastSyncedAt: null,
  },
];

const blogs = {
  items: [
    {
      title: "Cách tính Macro",
      slug: "cach-tinh-macro",
      category: "dinh-duong",
      clicks: 88,
      impressions: 600,
      ctr: 0.146,
      activeUsers: 60,
      engagedReads: 35,
      ctaClicks: 9,
      leads: 3,
      conversionRate: 5,
      legacyViews: 147,
    },
  ],
  pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

const detail = {
  blog: {
    title: "Cách tính Macro",
    slug: "cach-tinh-macro",
    category: "dinh-duong",
    legacyViews: 147,
  },
  trend: [
    {
      dateKey: "2026-08-05",
      clicks: 12,
      impressions: 100,
      activeUsers: 16,
      engagedReads: 9,
      ctaClicks: 4,
    },
  ],
  queries: [{ query: "cách tính macro", clicks: 8, impressions: 60 }],
  sources: [{ key: "google/organic", activeUsers: 12 }],
  devices: [{ key: "mobile", activeUsers: 11 }],
  funnel: {
    activeUsers: 16,
    engagedReads: 9,
    ctaClicks: 4,
    leads: 1,
    assessments: 1,
    customers: 1,
  },
};

const keywords = {
  items: [
    {
      query: "tăng cơ giảm mỡ",
      rankingPage: "https://htcoaching.vn/blog/tang-co-giam-mo",
      clicks: 32,
      impressions: 480,
      ctr: 0.067,
      position: 6.4,
      label: "opportunity",
    },
  ],
  pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

test.describe("Admin SEO analytics dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "admin" },
      }),
    );
  });

  test("renders KPI sources and provider health without mixing units", async ({ page }) => {
    await page.route("**/api/admin/analytics/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith("/providers") ? providers : overview;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
    });

    await page.goto("/admin/seo-analytics");

    await expect(
      page.getByRole("heading", { name: "Nội dung nào tạo ra khách hàng?" }),
    ).toBeVisible();
    await expect(page.getByText("Lượt hiển thị")).toBeVisible();
    await expect(page.getByText("1.200")).toBeVisible();
    const kpiRegion = page.getByLabel("Chỉ số tổng quan");
    await expect(kpiRegion.getByText("Đã đánh giá")).toBeVisible();
    await expect(kpiRegion.getByText("Thành khách hàng")).toBeVisible();
    await expect(page.getByText("Dữ liệu cũ")).toBeVisible();
    await expect(page.getByText("Chưa cấu hình")).toBeVisible();
  });

  test("opens Blog detail and keeps legacy views visibly separate", async ({ page }) => {
    await page.route("**/api/admin/analytics/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = overview;
      if (path.endsWith("/providers")) data = providers;
      else if (path.endsWith("/blog/cach-tinh-macro")) data = detail;
      else if (path.endsWith("/blog")) data = blogs;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
    });
    await page.goto("/admin/seo-analytics");

    await page.getByRole("button", { name: "Bài Blog" }).click();
    await expect(
      page.getByRole("table").getByText("Cách tính Macro"),
    ).toBeVisible();
    const openDetailButton = page.getByRole("button", {
      name: "Xem chi tiết Cách tính Macro",
    });
    await openDetailButton.click();

    const dialog = page.getByRole("dialog");
    const closeDetailButton = page.getByRole("button", {
      name: "Đóng chi tiết Blog",
    });
    await expect(dialog).toBeVisible();
    await expect(closeDetailButton).toBeFocused();
    await expect(dialog.getByText("cách tính macro", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Lượt xem cũ: 147 request detail/)).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(closeDetailButton).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(openDetailButton).toBeFocused();
  });

  test("renders keyword metrics as a mobile list", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/admin/analytics/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = overview;
      if (path.endsWith("/providers")) data = providers;
      else if (path.endsWith("/keywords")) data = keywords;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
    });

    await page.goto("/admin/seo-analytics");
    await page.getByRole("button", { name: "Từ khóa" }).click();

    const keywordCard = page.getByRole("article");
    await expect(
      keywordCard.getByRole("heading", { name: "tăng cơ giảm mỡ" }),
    ).toBeVisible();
    await expect(keywordCard.getByText("Cơ hội")).toBeVisible();
    await expect(keywordCard.getByText("32", { exact: true })).toBeVisible();
    await expect(page.locator("table")).toBeHidden();
  });

  test("retries overview and sends bounded manual sync", async ({ page }) => {
    let overviewHealthy = false;
    let syncBody = null;
    await page.route("**/api/admin/analytics/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === "POST") {
        syncBody = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { provider: "ga4", status: "success", rowsWritten: 5 },
          }),
        });
      }
      if (path.endsWith("/providers")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: providers }),
        });
      }
      return route.fulfill({
        status: overviewHealthy ? 200 : 503,
        contentType: "application/json",
        body: JSON.stringify(
          overviewHealthy
            ? { success: true, data: overview }
            : { success: false, message: "Unavailable" },
        ),
      });
    });
    await page.goto("/admin/seo-analytics");

    await expect(page.getByText("Không thể tải số liệu tổng quan")).toBeVisible();
    overviewHealthy = true;
    await page.getByRole("button", { name: "Thử lại" }).click();
    await expect(page.getByText("1.200")).toBeVisible();
    await page.getByRole("button", { name: "Đồng bộ" }).first().click();

    await expect.poll(() => syncBody).not.toBeNull();
    expect(syncBody).toMatchObject({ provider: "ga4" });
    expect(Object.keys(syncBody).sort()).toEqual([
      "endDate",
      "provider",
      "startDate",
    ]);
  });
});
