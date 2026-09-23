import { test, expect } from "@playwright/test";

const redirectUri = "https://vertexaisearch.cloud.google.com/grounding/redirect?source=cdc";
const history = {
  conversationId: "conversation-citations",
  messages: [
    { _id: "user-1", role: "user", content: "Creatine có ích không?" },
    { _id: "tool-call-1", role: "assistant", content: "" },
    {
      _id: "tool-1",
      role: "tool",
      content: "Nguồn đã kiểm chứng.",
      uiCard: {
        cardType: "webSources",
        data: {
          topic: "Creatine monohydrate và hiệu suất tập luyện có tiêu đề rất dài để kiểm tra co hẹp trên màn hình nhỏ",
          searchedAt: "2026-09-20T03:42:00.000Z",
          sources: [{
            title: "CDC — Creatine guidance (vertexaisearch.cloud.google.com)",
            uri: redirectUri,
          }],
        },
      },
    },
    {
      _id: "assistant-1",
      role: "assistant",
      content: `Creatine có thể hỗ trợ hiệu suất tập luyện cường độ cao theo [nguồn đã kiểm chứng](<${redirectUri}>).`,
    },
  ],
};

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`renders grounded citations without exposing transport host (${viewport.name})`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/**", (route) => route.continue({
      headers: { ...route.request().headers(), "x-e2e-role": "user" },
    }));
    await page.route("**/api/ai/history", (route) => route.fulfill({ json: { success: true, data: history } }));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Mở HT Assistant" }).click();
    await expect(page.getByText("Creatine có thể hỗ trợ hiệu suất")).toBeVisible();

    const dialog = page.getByRole("dialog", { name: "HT Assistant" });
    const chip = dialog.getByRole("link", { name: /Mở nguồn: CDC — Creatine guidance/ });
    await expect(chip).toHaveAttribute("href", redirectUri);
    await expect(chip).not.toContainText("vertexaisearch.cloud.google.com");
    await expect(dialog.getByText("Nguồn tham khảo", { exact: true })).toBeVisible();
    await expect(dialog.getByText("vertexaisearch.cloud.google.com", { exact: true })).toHaveCount(0);

    await dialog.getByText("Nguồn tham khảo", { exact: true }).click();
    await expect(dialog.locator("details").getByRole("link")).toBeVisible();
    await expect(dialog.locator("details")).toBeVisible();
    const bounds = await dialog.locator("details").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: testInfo.outputPath(`citation-dialog-${viewport.name}.png`) });
  });
}
