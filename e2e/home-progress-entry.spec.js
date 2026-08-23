import { expect, test } from "@playwright/test";

const useActor = async (page, role) => {
  await page.route("**/api/**", (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-e2e-role": role },
    }),
  );
};

test.describe("homepage Today Dashboard entry", () => {
  test("does not interrupt an anonymous visitor with a persona or progress prompt", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("pricingViewMode");
      sessionStorage.removeItem("ht_today_progress_prompt_dismissed");
    });

    await page.goto("/");

    await expect(page.getByRole("dialog", { name: "Bạn là ai?" })).toHaveCount(0);
    await expect(page.getByTestId("today-progress-prompt")).toHaveCount(0);
    await expect(page.locator("header a[href='/login']:visible").first()).toBeVisible();
  });

  test("opens the canonical dashboard for a returning authenticated customer", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.addInitScript(() => {
      localStorage.setItem("pricingViewMode", "customer");
      sessionStorage.removeItem("ht_today_progress_prompt_dismissed");
    });
    await useActor(page, "user");

    await page.goto("/");

    const prompt = page.getByTestId("today-progress-prompt");
    await expect(prompt).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("dialog", { name: "Bạn là ai?" })).toHaveCount(0);
    await prompt.getByRole("button", { name: "Mở kế hoạch hôm nay" }).click();

    await expect(page).toHaveURL(
      /\/dashboard\/today\/\d{4}-\d{2}-\d{2}$/,
    );
    await expect(
      page.getByRole("heading", { name: "Tổng quan hôm nay" }),
    ).toBeVisible();
  });

  test("dismisses the mobile prompt for the rest of the browser session", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("pricingViewMode", "customer");
      sessionStorage.removeItem("ht_today_progress_prompt_dismissed");
    });
    await useActor(page, "user");

    await page.goto("/");

    const prompt = page.getByTestId("today-progress-prompt");
    await expect(prompt).toBeVisible();
    const box = await prompt.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);

    await prompt
      .getByRole("button", { name: "Ẩn nhắc nhở kế hoạch hôm nay" })
      .click();
    await expect(prompt).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("today-progress-prompt")).toHaveCount(0);
  });

  test("does not show the customer prompt for the trainer pricing persona", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("pricingViewMode", "trainer");
      sessionStorage.removeItem("ht_today_progress_prompt_dismissed");
    });

    await page.goto("/");
    await page.waitForTimeout(1500);

    await expect(page.getByTestId("today-progress-prompt")).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Bạn là ai?" })).toHaveCount(0);
  });
});
