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
    let releaseHistory = () => {};
    const historyGate = new Promise((resolve) => {
      releaseHistory = resolve;
    });
    await page.route("**/api/ai/history", async (route) => {
      await historyGate;
      await route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "user" },
      });
    });

    await page.goto("/");
    const historyResponse = page.waitForResponse("**/api/ai/history");
    await page.getByRole("button", { name: "Mở HT Assistant" }).click();
    const input = page.getByPlaceholder("Hỏi bất kỳ điều gì...").first();
    const chatResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/ai/chat"),
    );
    await input.fill("Tạo một buổi tập an toàn");
    await input.press("Enter");
    expect((await chatResponse).status()).toBe(200);
    releaseHistory();
    expect((await historyResponse).status()).toBe(200);
    await expect(page.getByText("Phản hồi AI deterministic")).toBeVisible();
  });
});
