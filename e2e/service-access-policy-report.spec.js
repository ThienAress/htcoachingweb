import { expect, test } from "@playwright/test";

const status = { code: "implemented", rank: 1, label: "Đã code" };
const snapshot = {
  featureLabel: "HT Assistant",
  group: { key: "ai_support", label: "AI hỗ trợ" },
  priority: { code: "F0", rank: 0, label: "Cần ưu tiên ngay" },
  primaryValue: "Hỗ trợ người dùng tập luyện và dinh dưỡng.",
  audiences: ["Cộng đồng", "Khách hàng", "HLV"],
};
const historyRecord = {
  improvementKey: "conversation_continuity",
  opportunity: "Giữ phản hồi khi chuyển cuộc trò chuyện",
  result: "Phản hồi tiếp tục chạy đúng conversation nguồn.",
  snapshot,
  milestones: [{ status, statusDate: "2026-08-10" }],
};
const matrix = {
  version: "2026-08-10",
  columns: [],
  services: [],
  trainerPlans: { columns: [], benefits: [] },
  communityFeatures: {
    version: "2026-08-10.3",
    reportOptions: {
      audiences: [
        { key: "community", label: "Cộng đồng" },
        { key: "customer", label: "Khách hàng" },
        { key: "trainer", label: "HLV" },
      ],
      statuses: [status],
      dateRange: { from: "2026-08-10", to: "2026-08-10" },
    },
    items: [
      {
        featureKey: "ht_assistant",
        label: "HT Assistant",
        group: snapshot.group,
        priority: snapshot.priority,
        primaryValue: snapshot.primaryValue,
        audiences: snapshot.audiences,
        audienceKeys: ["community", "customer", "trainer"],
        currentImprovement: {
          improvementKey: "production_validation",
          description: "Xác minh production luồng chạy nền.",
          openedAt: "2026-08-10",
        },
        improvementHistory: [historyRecord],
      },
      {
        featureKey: "tdee_calculator",
        label: "TDEE Calculator",
        group: { key: "nutrition", label: "Dinh dưỡng" },
        priority: { code: "F1", rank: 1, label: "Ưu tiên kế tiếp" },
        primaryValue: "Ước tính nhu cầu năng lượng.",
        audiences: ["Cộng đồng"],
        audienceKeys: ["community"],
        currentImprovement: null,
        improvementHistory: [],
      },
    ],
  },
};
const report = {
  filters: {
    from: "2026-08-10",
    to: "2026-08-10",
    group: "all",
    audience: "all",
    status: "all",
  },
  summary: {
    eventCount: 1,
    improvementCount: 1,
    featureCount: 1,
    productionVerifiedCount: 0,
    openF0Count: 1,
    latestDate: "2026-08-10",
  },
  timeline: [
    {
      date: "2026-08-10",
      features: [
        {
          featureKey: "ht_assistant",
          featureLabel: "HT Assistant",
          improvementCount: 1,
          improvements: [
            {
              eventKey: "ht_assistant:conversation_continuity:implemented:2026-08-10",
              opportunity: historyRecord.opportunity,
              status,
            },
          ],
        },
      ],
    },
  ],
  rows: [],
};

test.describe("Community feature improvement report", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "admin" },
      }),
    );
  });

  test("shows daily improvements and downloads the filtered PDF", async ({
    page,
  }) => {
    await page.route(
      "**/api/admin/service-access-policies/community-features/report*",
      async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.endsWith(".pdf")) {
          await route.fulfill({
            status: 200,
            contentType: "application/pdf",
            headers: {
              "Content-Disposition":
                'attachment; filename="bao-cao-cai-tien.pdf"',
            },
            body: "%PDF-1.7 mock report",
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: report }),
        });
      },
    );
    await page.route(
      "**/api/admin/service-access-policies",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: matrix }),
        });
      },
    );

    await page.goto("/admin/service-access-policies");

    const reportRegion = page.getByRole("region", {
      name: "Báo cáo lịch sử cải tiến",
    });
    await expect(
      reportRegion.getByRole("heading", { name: "Báo cáo lịch sử cải tiến" }),
    ).toBeVisible();
    await expect(page.getByText("Cập nhật theo ngày")).toBeVisible();
    await expect(reportRegion.getByText(historyRecord.opportunity)).toBeVisible();

    const filteredReportRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname.endsWith("/community-features/report") &&
        url.searchParams.get("audience") === "customer"
      );
    });
    await page.getByLabel("Lọc theo đối tượng").selectOption("customer");
    await filteredReportRequest;
    await expect(page.getByRole("row", { name: /HT Assistant/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /TDEE Calculator/ })).toHaveCount(0);

    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Tải báo cáo cải tiến PDF" })
      .click();
    await download;
  });
});
