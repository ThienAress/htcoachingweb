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
    await expect(pricing.getByRole("heading", { name: "Quyền lợi khách hàng" })).toBeVisible();
    await expect(pricing.getByRole("heading", { name: "Quyền lợi hệ thống" })).toBeVisible();
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
    await page.goto("/admin/pricing");

    await expect(page).toHaveTitle(/Bảng giá \| HTCOACHING/);
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
    await page.goto("/admin/pricing");

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
    await page.goto("/admin/pricing");

    const trial = page.locator("section", { has: page.getByRole("heading", { name: "Trải nghiệm · Gói trải nghiệm" }) });
    await trial.getByLabel("Danh sách quà tặng").fill(Array.from({ length: 9 }, (_, i) => `Quà ${i + 1}`).join("\n"));
    await trial.getByRole("button", { name: "Lưu" }).click();
    await expect(trial.getByRole("alert")).toContainText("tối đa 8 quà");
  });
});

const openFirstPlanAsVisitor = async (page) => {
  const pricing = await openPricing(page, "1-1");
  await pricing.locator("article").first().getByRole("link", { name: "Đăng ký" }).click();
  return pricing;
};

test.describe.serial("admin edits the sign-in offer and the plan content", () => {
  test("the old gifts address lands on the pricing page", async ({ page }) => {
    await asRole(page, "admin");
    await page.goto("/admin/pricing-gifts");
    await expect(page).toHaveURL(/\/admin\/pricing$/);
    await expect(page.getByRole("heading", { name: "Bảng giá", level: 1 })).toBeVisible();
  });

  test("a new percentage reaches the sign-in offer a visitor sees", async ({ page }) => {
    await asRole(page, "admin");
    await page.goto("/admin/pricing");
    const promo = page.locator("section", { has: page.getByRole("heading", { name: "Ưu đãi lần đăng ký đầu" }) });
    await promo.getByLabel("Phần trăm giảm").fill("20");
    await promo.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText(/Đã lưu ưu đãi/)).toBeVisible();
    await expect(promo.getByText("Đang bật · giảm 20%")).toBeVisible();

    const visitor = await page.context().newPage();
    await openFirstPlanAsVisitor(visitor);
    await expect(visitor.getByText("GIẢM 20%")).toBeVisible();
    await visitor.close();
  });

  test("switching the offer off skips the sign-in offer and goes straight to registration", async ({ page }) => {
    await asRole(page, "admin");
    await page.goto("/admin/pricing");
    const promo = page.locator("section", { has: page.getByRole("heading", { name: "Ưu đãi lần đăng ký đầu" }) });
    await promo.getByLabel("Bật ưu đãi cho khách đăng ký lần đầu").uncheck();
    await promo.getByRole("button", { name: "Lưu" }).click();
    await expect(promo.getByText("Đang tắt")).toBeVisible();

    const visitor = await page.context().newPage();
    await openFirstPlanAsVisitor(visitor);
    await expect(visitor.getByText("ƯU ĐÃI ĐẶC BIỆT")).toHaveCount(0);
    await expect(visitor).toHaveURL(/\/register/);
    await visitor.close();

    await promo.getByRole("button", { name: "Khôi phục mặc định" }).click();
    await expect(page.getByText("Đã khôi phục ưu đãi mặc định.")).toBeVisible();
    await expect(promo.getByText("Đang bật · giảm 15%")).toBeVisible();
  });

  test("the offer refuses a percentage outside 1 to 100 before sending", async ({ page }) => {
    await asRole(page, "admin");
    await page.goto("/admin/pricing");
    const promo = page.locator("section", { has: page.getByRole("heading", { name: "Ưu đãi lần đăng ký đầu" }) });
    await promo.getByLabel("Phần trăm giảm").fill("150");
    await promo.getByRole("button", { name: "Lưu" }).click();
    await expect(promo.getByRole("alert")).toContainText("từ 1 đến 100");
  });

  test("an admin rewrites the 1-1 customer benefits and a visitor sees them", async ({ page }) => {
    await asRole(page, "admin");
    await page.goto("/admin/pricing");
    await page.getByRole("tab", { name: "Nội dung các gói" }).click();

    const list = page.locator("section", { has: page.getByRole("heading", { name: "1-1 · Quyền lợi khách hàng" }) });
    await expect(list.getByText("Đang dùng mặc định")).toBeVisible();
    await expect(list.getByLabel("Danh sách quyền lợi")).toHaveValue(/Tập 1 kèm 1/);
    await list.getByLabel("Danh sách quyền lợi").fill("Tập 1 kèm 1 tại phòng riêng\nGiáo án cá nhân hóa");
    await list.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText(/Đã lưu quyền lợi/)).toBeVisible();

    const pricing = await openPricing(await page.context().newPage(), "1-1");
    await expect(pricing.getByText("Tập 1 kèm 1 tại phòng riêng")).toBeVisible();
    await expect(pricing.getByText("Truy cập hệ thống bài tập đa dạng")).toBeVisible();

    await list.getByRole("button", { name: "Khôi phục mặc định" }).click();
    await expect(page.getByText("Đã khôi phục quyền lợi mặc định.")).toBeVisible();
    await expect(list.getByText("Đang dùng mặc định")).toBeVisible();
  });

  test("a benefit list cannot be saved empty", async ({ page }) => {
    await asRole(page, "admin");
    await page.goto("/admin/pricing");
    await page.getByRole("tab", { name: "Nội dung các gói" }).click();
    const list = page.locator("section", { has: page.getByRole("heading", { name: "ONLINE · Quyền lợi hệ thống" }) });
    await list.getByLabel("Danh sách quyền lợi").fill("");
    await list.getByRole("button", { name: "Lưu" }).click();
    await expect(list.getByRole("alert")).toContainText("ít nhất một quyền lợi");
  });
});
