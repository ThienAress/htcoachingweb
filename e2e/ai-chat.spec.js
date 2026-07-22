import { test, expect } from "@playwright/test";

test.describe("AI chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "user" },
      }),
    );
  });

  test("lazy-loads the panel and renders deterministic SSE output", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Mở HT Assistant" }).click();
    const input = page.getByPlaceholder("Hỏi bất kỳ điều gì...").first();
    await input.fill("Tạo một buổi tập an toàn");
    await input.press("Enter");
    await expect(page.getByText("Phản hồi AI deterministic")).toBeVisible();
  });
});
