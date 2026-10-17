import { expect, test } from "@playwright/test";

const asRole = (page, role) =>
  page.route("**/api/**", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-e2e-role": role } }),
  );

const openPricing = async (page, tab) => {
  await page.addInitScript(() => localStorage.setItem("pricingViewMode", "customer"));
  await page.goto("/");
  const pricing = page.locator("#pricing");
  await pricing.scrollIntoViewIfNeeded();
  await pricing.getByRole("button", { name: tab, exact: true }).click();
  return pricing;
};

test.describe("pricing tabs", () => {
  test("show shared benefits once, no session count, and a lone trial plan in the middle", async ({ page }) => {
    const pricing = await openPricing(page, "1-1");
    await expect(pricing.getByText("Tất cả gói đều gồm")).toBeVisible();
    await expect(pricing.getByText("Tập 1 kèm 1")).toHaveCount(1);
    await expect(pricing.getByText(/buổi mỗi tuần/)).toHaveCount(0);
    await expect(pricing.getByRole("heading", { name: "Cơ bản" })).toBeVisible();

    await pricing.getByRole("button", { name: "ONLINE", exact: true }).click();
    await expect(pricing.getByText("Tất cả gói đều gồm")).toBeVisible();
    await expect(pricing.getByText(/Online Coaching/)).toHaveCount(1);
    await expect(pricing.getByRole("link", { name: "Đăng ký" })).toHaveCount(3);

    await pricing.getByRole("button", { name: "Trải nghiệm", exact: true }).click();
    const cards = pricing.locator("article");
    await expect(cards).toHaveCount(1);
    const box = await cards.first().boundingBox();
    const section = await pricing.boundingBox();
    expect(Math.abs(box.x + box.width / 2 - (section.x + section.width / 2))).toBeLessThan(4);
  });
});

test.describe.serial("admin edits pricing gifts", () => {
  test("an admin changes the VIP gifts and the home page shows them", async ({ page }) => {
    await asRole(page, "admin");
    await page.goto("/admin/pricing-gifts");

    await expect(page).toHaveTitle(/Quà tặng gói tập \| HTCOACHING/);
    const vip = page.locator("section", { has: page.getByRole("heading", { name: "1-1 · VIP" }) });
    await expect(vip.getByText("Đang dùng mặc định")).toBeVisible();
    await expect(vip.getByLabel("Danh sách quà tặng")).toHaveValue(/Balo cao cấp Degrey/);
    await expect(vip.getByRole("button", { name: "Lưu" })).toBeDisabled();

    await vip.getByLabel("Danh sách quà tặng").fill("Áo thun HT\nÁo thun HT\n\nKhăn tập");
    await vip.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText(/Đã lưu quà tặng/)).toBeVisible();
    await expect(vip.getByText("Đã chỉnh")).toBeVisible();
    await expect(vip.getByLabel("Danh sách quà tặng")).toHaveValue("Áo thun HT\nKhăn tập");
  });

  test("a visitor sees the saved gifts, the other plans keep their defaults", async ({ page }) => {
    const pricing = await openPricing(page, "1-1");

    const vip = pricing.locator("article", { has: page.getByRole("heading", { name: "VIP" }) });
    await expect(vip.getByText("Áo thun HT")).toBeVisible();
    await expect(vip.getByText("Khăn tập")).toBeVisible();
    await expect(vip.getByText("Balo cao cấp Degrey")).toHaveCount(0);

    const basic = pricing.locator("article", { has: page.getByRole("heading", { name: "Cơ bản" }) });
    await expect(basic.getByText("Shaker Bình Lắc Cao Cấp 600ml")).toBeVisible();
  });

  test("an admin can give a plan no gifts and restore the default", async ({ page }) => {
    await asRole(page, "admin");
    await page.goto("/admin/pricing-gifts");

    const vip = page.locator("section", { has: page.getByRole("heading", { name: "1-1 · VIP" }) });
    await vip.getByLabel("Danh sách quà tặng").fill("");
    await vip.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText(/Đã lưu quà tặng/)).toBeVisible();

    await vip.getByRole("button", { name: "Khôi phục mặc định" }).click();
    await expect(page.getByText("Đã khôi phục quà tặng mặc định.")).toBeVisible();
    await expect(vip.getByText("Đang dùng mặc định")).toBeVisible();
    await expect(vip.getByLabel("Danh sách quà tặng")).toHaveValue(/Balo cao cấp Degrey/);
  });

  test("the editor refuses more than eight gifts before sending", async ({ page }) => {
    await asRole(page, "admin");
    await page.goto("/admin/pricing-gifts");

    const trial = page.locator("section", { has: page.getByRole("heading", { name: "Trải nghiệm · Gói trải nghiệm" }) });
    await trial.getByLabel("Danh sách quà tặng").fill(Array.from({ length: 9 }, (_, i) => `Quà ${i + 1}`).join("\n"));
    await trial.getByRole("button", { name: "Lưu" }).click();
    await expect(trial.getByRole("alert")).toContainText("tối đa 8 quà");
  });
});
