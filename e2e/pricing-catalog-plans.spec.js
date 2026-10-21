import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const fixture = (name) =>
  JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf8"));

const fulfillJson = (body) => ({
  status: 200,
  contentType: "application/json",
  headers: {
    "Access-Control-Allow-Origin": "http://127.0.0.1:4174",
    "Access-Control-Allow-Credentials": "true",
  },
  body: JSON.stringify(body),
});

const openPricing = async (page, { trainer = false, tab } = {}) => {
  await page.route("**/api/fitness-plus-subscriptions/catalog", (route) =>
    route.fulfill(fulfillJson(fixture("fitness-plus-catalog.json"))),
  );
  await page.route("**/api/trainer-subscriptions/catalog", (route) =>
    route.fulfill(fulfillJson(fixture("trainer-plan-catalog.json"))),
  );
  await page.addInitScript(() => localStorage.setItem("pricingViewMode", "customer"));
  await page.goto("/");
  const pricing = page.locator("#pricing");
  await pricing.scrollIntoViewIfNeeded();
  if (trainer) {
    await pricing.getByRole("button", { name: "Huấn luyện viên", exact: true }).click();
  }
  if (tab) await pricing.getByRole("button", { name: tab, exact: true }).click();
  return pricing;
};

test.describe("HT FITNESS+ plans", () => {
  test("list the shared tools once and show each plan's credits and price", async ({ page }) => {
    const pricing = await openPricing(page, { tab: "HT FITNESS+" });

    await expect(pricing.getByText("Tất cả gói đều gồm")).toBeVisible();
    await expect(pricing.getByText("Gợi ý Meal Plan theo mục tiêu")).toHaveCount(1);
    await expect(pricing.getByText("Credit AI dùng chung cho HT Assistant và Meal Scan.")).toHaveCount(0);

    const cards = pricing.locator("article");
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText("360");
    await expect(cards.nth(1)).toContainText("720");
    await expect(cards.nth(2)).toContainText("1200");
    await expect(cards.nth(0)).toContainText("Tối đa 30 credit mỗi giờ");
    await expect(cards.nth(2)).toContainText("Tối đa 80 credit mỗi giờ");
    await expect(cards.nth(1)).toContainText("199.000");
    await expect(pricing.getByRole("button", { name: "Mua" })).toHaveCount(3);

    await pricing.getByRole("button", { name: "Năm", exact: true }).click();
    await expect(cards.nth(1)).toContainText("1.990.000");
  });
});

test.describe("trainer plans", () => {
  test("list shared tools once, show student capacity big and F1 only where included", async ({ page }) => {
    const pricing = await openPricing(page, { trainer: true });

    await expect(pricing.getByText("Tất cả gói đều gồm")).toBeVisible();
    await expect(pricing.getByText("Tạo hồ sơ tập luyện cho học viên")).toHaveCount(1);

    const cards = pricing.locator("article");
    // Dùng thử là một dải riêng phía trên, không còn là thẻ thứ 4; 3 thẻ còn lại là gói trả phí.
    await expect(cards).toHaveCount(3);
    const capacities = await cards.evaluateAll((nodes) =>
      nodes.map((node) => node.querySelector("p.font-display")?.textContent?.trim()),
    );
    expect(capacities).toEqual(["5", "20", "50"]);

    await expect(cards.nth(0)).not.toContainText("F1 CRM");
    await expect(cards.nth(1)).toContainText("F1 CRM");
    await expect(cards.nth(2)).toContainText("F1 CRM");

    const trialStrip = pricing.locator("section[aria-label='Dùng thử']");
    await expect(trialStrip).toContainText("tối đa 3 học viên");
    await expect(trialStrip.getByRole("button", { name: "Bắt đầu miễn phí" })).toBeVisible();
    await expect(pricing.getByRole("button", { name: "Bắt đầu miễn phí" })).toHaveCount(1);
    await expect(pricing.getByRole("button", { name: "Mua" })).toHaveCount(3);

    await pricing.getByRole("button", { name: "Năm", exact: true }).click();
    await expect(cards.nth(0)).toContainText("2.000.000");

    // Thẻ năm không tràn ra ngoài khung thẻ.
    const overflowing = await cards.evaluateAll((nodes) =>
      nodes.filter((node) => node.scrollWidth > node.clientWidth + 1).length,
    );
    expect(overflowing).toBe(0);
  });
});

const nowPlus = (days) => new Date(Date.now() + days * 86400000).toISOString();

test.describe("plan states for subscribers", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route("**/api/**", (route) =>
      route.continue({ headers: { ...route.request().headers(), "x-e2e-role": "user" } }),
    );
  });

  test("HT FITNESS+ monthly subscriber: current plan locked, yearly upgrade shows the discounted total", async ({ page }) => {
    await page.route("**/api/fitness-plus-subscriptions/me", (route) =>
      route.fulfill(
        fulfillJson({
          success: true,
          data: {
            planCode: "fitness_plus_essential",
            planTitle: "Nền tảng",
            billingCycle: "month",
            amount: 99000,
            startDate: nowPlus(-15),
            endDate: nowPlus(15),
          },
        }),
      ),
    );
    await page.route("**/api/fitness-plus-subscriptions/quotes**", (route) =>
      route.fulfill(
        fulfillJson({
          success: true,
          data: {
            eligible: true,
            action: "upgrade_to_year",
            planCode: "fitness_plus_essential",
            billingCycle: "year",
            listAmount: 990000,
            creditAmount: 49500,
            amount: 940500,
            remainingDays: 15,
            periodDays: 30,
          },
        }),
      ),
    );
    const pricing = await openPricing(page, { tab: "HT FITNESS+" });
    const cards = pricing.locator("article");

    await expect(cards.nth(0).getByRole("button", { name: "Đang sử dụng" })).toBeDisabled();
    await pricing.getByRole("button", { name: "Năm", exact: true }).click();
    const upgrade = cards.nth(0).getByRole("button", { name: "Nâng cấp lên gói năm" });
    await expect(upgrade).toBeEnabled();
    await upgrade.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("940.500");
    await expect(dialog).toContainText("49.500");
    await expect(dialog).toContainText("còn 15 ngày");
  });

  test("trainer plans: same locked state, only upgrades to yearly of the same or a higher plan stay open", async ({ page }) => {
    await page.route("**/api/trainer-subscriptions/me", (route) =>
      route.fulfill(
        fulfillJson({
          success: true,
          data: {
            planCode: "professional",
            planTitle: "Chuyên nghiệp",
            billingCycle: "month",
            amount: 250000,
            startDate: nowPlus(-10),
            endDate: nowPlus(20),
          },
          freeTrial: { status: "used", reason: null, claimedAt: null },
        }),
      ),
    );
    const pricing = await openPricing(page, { trainer: true });

    await expect(pricing.getByRole("button", { name: "Đang sử dụng" })).toHaveCount(1);
    await expect(pricing.getByRole("button", { name: "Đang sử dụng" })).toBeDisabled();
    await expect(pricing.getByRole("button", { name: "Không khả dụng" })).toHaveCount(2);
    await expect(pricing.getByText("Bạn có thể nâng cấp lên gói năm của cùng gói hoặc gói cao hơn.").first()).toBeVisible();

    await pricing.getByRole("button", { name: "Năm", exact: true }).click();
    // Chuyên nghiệp và Cao cấp lên năm được nâng cấp; Tiêu chuẩn (gói thấp hơn) bị khóa.
    await expect(pricing.getByRole("button", { name: "Nâng cấp lên gói năm" })).toHaveCount(2);
    await expect(pricing.getByRole("button", { name: "Không khả dụng" })).toHaveCount(1);
  });

  test('account menu shows name - plan on one line, never truncates the plan and hides the email', async ({ page }) => {
    await page.route("**/api/trainer-subscriptions/me", (route) =>
      route.fulfill(
        fulfillJson({
          success: true,
          data: { planCode: "professional", planTitle: "Chuyên nghiệp", billingCycle: "month", amount: 250000, startDate: nowPlus(-1), endDate: nowPlus(29) },
          freeTrial: { status: "used", reason: null, claimedAt: null },
        }),
      ),
    );
    await openPricing(page);
    await page.locator("[aria-controls=\"account-dropdown-menu\"]").first().click();
    const title = page.getByTestId("account-menu-title");
    const badge = page.getByTestId("account-plan-badge");
    await expect(title).toContainText("E2E Client");
    await expect(title).toContainText("Chuyên nghiệp");
    await expect(title.locator("span").nth(1)).toHaveText("-");
    await expect(badge).toHaveText("Chuyên nghiệp");
    const clipped = await badge.evaluate((node) => node.scrollWidth > node.clientWidth);
    expect(clipped).toBe(false);
    // Email chỉ xem ở trang Tài khoản, không hiện trong menu.
    await expect(page.getByTestId("account-dropdown-menu")).not.toContainText("@");
  });
});
