import { expect, test } from "@playwright/test";

test.describe("exercise library-first experience", () => {
  test("shows the exercise catalog first and keeps the PDF planner secondary", async ({
    page,
  }) => {
    await page.goto("/exercises/");

    await expect(page.locator('[data-exercise-library="true"]')).toBeVisible();
    await expect(page.locator('[data-workout-planner="true"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Goblet Squat" })).toBeVisible();
    await expect(page.getByText("Chân", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Giữ ngực thẳng và hạ hông có kiểm soát."),
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(24);
    await expect(
      page.locator('[aria-label*="trên 5 sao về độ phức tạp kỹ thuật"]'),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Xem thêm bài tập" }).click();
    await expect(page.locator("article")).toHaveCount(30);

    const detailTrigger = page.getByRole("link", { name: "Xem chi tiết" }).first();
    await detailTrigger.click();
    await expect(page).toHaveURL(/\/exercises\/exercise-library-e2e-1\/goblet-squat/);
    await expect(page.getByRole("heading", { name: "Goblet Squat" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Goblet Squat/ })).toBeVisible();
    await expect(page.getByText("Chân", { exact: true }).first()).toBeVisible();
    const detailMuscle = page.locator('[data-exercise-detail-muscle="pill"]');
    await expect(detailMuscle).toHaveText("Chân");
    await expect(detailMuscle.locator("svg")).toHaveCount(0);
    await expect(
      page.getByText("Giữ ngực thẳng và hạ hông có kiểm soát."),
    ).toBeVisible();
    await expect(page.locator("video[controls]")).toBeVisible();
    await expect(
      page.locator('[data-exercise-difficulty-segments="true"]'),
    ).toBeVisible();
    await expect(
      page.locator("[data-exercise-difficulty-segment]"),
    ).toHaveCount(5);
    await expect(
      page.locator('[data-exercise-setup-steps="rail"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-exercise-step-trigger="1"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-exercise-step-trigger="2"]'),
    ).toBeVisible();
    await page.locator('[data-exercise-step-trigger="2"]').click();
    await expect(
      page.locator('[data-exercise-setup-detail="true"]'),
    ).toContainText("Giữ tạ trước ngực");
    await expect(page.getByText("Bước trước", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Bước tiếp", { exact: true })).toHaveCount(0);
    await expect(
      page.locator('[data-exercise-reviews="standalone"]'),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Đánh giá từ người tập" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Quay lại thư viện" }).click();

    await page.getByRole("button", { name: "Tạo lịch tập PDF" }).click();
    await expect(page.locator('[data-workout-planner="true"]')).toBeVisible();
    await expect(page.locator('[data-exercise-library="true"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Quay lại thư viện" }).click();
    await expect(page.locator('[data-exercise-library="true"]')).toBeVisible();
  });

  test("does not overflow horizontally on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/exercises/");
    await expect(page.locator('[data-exercise-library="true"]')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByRole("link", { name: "Xem chi tiết" }).first().click();
    await expect(page.locator('[data-exercise-setup-steps="rail"]')).toBeVisible();
    const detailOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(detailOverflow).toBeLessThanOrEqual(1);
  });
});
