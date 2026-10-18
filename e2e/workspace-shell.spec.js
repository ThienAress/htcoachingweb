import { expect, test } from "@playwright/test";

const asRole = (page, role, extra = {}) =>
  page.route("**/api/**", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-e2e-role": role, ...extra } }),
  );

const NAVY = "rgb(28, 45, 66)";
const BRAND_ORANGE = "rgb(255, 85, 0)";

const sidebarFacts = (page, selector) =>
  page.evaluate((sel) => {
    const aside = document.querySelector(sel);
    const active = aside.querySelector('a[aria-current="page"], a.bg-primary, button.bg-primary');
    return {
      bg: getComputedStyle(aside).backgroundColor,
      width: Math.round(aside.getBoundingClientRect().width),
      brand: aside.innerText.includes("HTCOACHING"),
      subtitle: ["Khu HLV", "Quản trị", "Khách hàng F1"].find((text) => aside.innerText.includes(text)) || null,
      activeBg: active ? getComputedStyle(active).backgroundColor : null,
      home: [...aside.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/"),
    };
  }, selector);

test.describe("work areas share one sidebar", () => {
  test("trainer, admin and F1 use the same navy sidebar, brand block and orange active item", async ({ page }) => {
    await asRole(page, "admin", { "x-e2e-trainer-access": "true" });

    await page.goto("/trainer");
    await expect(page.locator("#trainer-sidebar")).toBeVisible();
    const trainer = await sidebarFacts(page, "#trainer-sidebar");

    await page.goto("/admin/users");
    await expect(page.locator("#admin-desktop-sidebar")).toBeVisible();
    const admin = await sidebarFacts(page, "#admin-desktop-sidebar");

    await page.goto("/f1-customers");
    await expect(page.locator("#f1-navigation")).toBeVisible();
    const f1 = await sidebarFacts(page, "#f1-navigation");

    expect({ trainer: trainer.subtitle, admin: admin.subtitle, f1: f1.subtitle }).toEqual({
      trainer: "Khu HLV",
      admin: "Quản trị",
      f1: "Khách hàng F1",
    });
    for (const facts of [trainer, admin, f1]) {
      expect(facts).toMatchObject({ bg: NAVY, width: 256, brand: true, activeBg: BRAND_ORANGE, home: true });
    }
  });

  test("the trainer sidebar stays navy in the light theme", async ({ page }) => {
    await asRole(page, "admin", { "x-e2e-trainer-access": "true" });
    await page.addInitScript(() => localStorage.setItem("trainerWorkspaceTheme", "light"));
    await page.goto("/trainer");

    await expect(page.locator("#trainer-sidebar")).toBeVisible();
    const facts = await sidebarFacts(page, "#trainer-sidebar");
    expect(facts.bg).toBe(NAVY);
    const brandColor = await page.locator("#trainer-sidebar").getByText("HTCOACHING").evaluate((n) => getComputedStyle(n).color);
    expect(brandColor).toBe("rgb(255, 255, 255)");
  });
});

test.describe("floating contact button", () => {
  const activeIcons = (page) =>
    page.evaluate(
      () => document.querySelectorAll('button[aria-label="Mở liên hệ nhanh"] [aria-hidden="true"].opacity-100').length,
    );

  test("shows one channel icon at a time and keeps the orange ring", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Mở liên hệ nhanh" });
    await expect(button).toBeVisible();
    expect(await button.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe(BRAND_ORANGE);
    expect(await activeIcons(page)).toBe(1);

    const first = await button.evaluate((n) => n.innerHTML);
    await expect.poll(() => button.evaluate((n) => n.innerHTML), { timeout: 8000 }).not.toBe(first);
    expect(await activeIcons(page)).toBe(1);
  });

  test("keeps a single static icon when the user asks for reduced motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    const button = page.getByRole("button", { name: "Mở liên hệ nhanh" });
    await expect(button).toBeVisible();
    const before = await button.evaluate((n) => n.innerHTML);
    await page.waitForTimeout(4500);
    expect(await button.evaluate((n) => n.innerHTML)).toBe(before);
    await context.close();
  });
});
