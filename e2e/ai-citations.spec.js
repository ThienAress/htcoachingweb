import { test, expect } from "@playwright/test";

const pubmedUri = "https://pubmed.ncbi.nlm.nih.gov/12345678/";
const legacyRedirectUri = "https://vertexaisearch.cloud.google.com/grounding/redirect?source=cdc";

const sourceCard = (sources) => ({
  cardType: "webSources",
  data: { sources, searchedAt: "2026-09-20T03:42:00.000Z" },
});

const createHistory = (messages) => ({
  conversationId: "conversation-citations",
  messages,
});

const installHistory = async (page, history) => {
  await page.route("**/api/**", (route) => route.continue({
    headers: { ...route.request().headers(), "x-e2e-role": "user" },
  }));
  await page.route("**/api/ai/history", (route) => route.fulfill({
    json: { success: true, data: history },
  }));
};

const openAssistant = async (page, history) => {
  await installHistory(page, history);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Mở HT Assistant" }).click();
  return page.getByRole("dialog", { name: "HT Assistant" });
};

const expectWithinViewport = async (locator, width) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  return box;
};

for (const viewport of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`renders final assistant citation metadata as a compact source link (${viewport.name})`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const dialog = await openAssistant(page, createHistory([
      { _id: "user-1", role: "user", content: "Creatine có ích không?" },
      {
        _id: "assistant-1",
        role: "assistant",
        content: `Creatine có thể hỗ trợ hiệu suất theo [nghiên cứu](${pubmedUri}).`,
        uiCard: sourceCard([{ title: "Creatine evidence", uri: pubmedUri }]),
      },
    ]));

    const chip = dialog.getByRole("link", {
      name: "Mở nguồn Creatine evidence từ PubMed trong thẻ mới",
    });
    await expect(chip).toHaveAttribute("href", pubmedUri);
    await expect(chip).toHaveAttribute("target", "_blank");
    await expect(chip).toHaveAttribute("rel", "noopener noreferrer");
    await expect(chip.getByRole("img", { name: "PubMed" })).toBeVisible();
    await expect(chip).toContainText("PubMed");
    await expect(dialog.getByText("Nguồn tham khảo", { exact: true })).toHaveCount(0);

    await chip.focus();
    await expect(chip).toBeFocused();
    const box = await expectWithinViewport(chip, viewport.width);
    if (viewport.name === "mobile") {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: testInfo.outputPath(`citation-final-${viewport.name}.png`) });
  });
}

test("keeps a compact disclosure when only some validated sources are inline", async ({ page }) => {
  const cdcUri = "https://www.cdc.gov/physical-activity/about/index.html";
  const dialog = await openAssistant(page, createHistory([
    { _id: "user-1", role: "user", content: "Nguồn nào?" },
    {
      _id: "assistant-1",
      role: "assistant",
      content: `Xem [nghiên cứu](${pubmedUri}) trước.`,
      uiCard: sourceCard([
        { title: "Creatine evidence", uri: pubmedUri },
        { title: "Physical activity guidance", uri: cdcUri },
      ]),
    },
  ]));

  await expect(dialog.getByRole("link", {
    name: "Mở nguồn Creatine evidence từ PubMed trong thẻ mới",
  })).toBeVisible();
  const disclosure = dialog.locator("details");
  await expect(disclosure).toBeVisible();
  await disclosure.getByText("Nguồn tham khảo", { exact: true }).click();
  await expect(disclosure.getByRole("link", { name: /Physical activity guidance/ })).toHaveAttribute("href", cdcUri);
});

test("keeps ordinary Markdown links ordinary and binds a publisher to its source URI", async ({ page }) => {
  const ordinaryUri = "https://untrusted.example/page";
  const hostileUri = "https://evil.example/advice";
  const dialog = await openAssistant(page, createHistory([
    { _id: "user-1", role: "user", content: "Cho tôi tham khảo" },
    {
      _id: "assistant-ordinary",
      role: "assistant",
      content: `Xem [liên kết thông thường](${ordinaryUri}).`,
      uiCard: sourceCard([{ title: "Creatine evidence", uri: pubmedUri }]),
    },
    {
      _id: "assistant-hostile",
      role: "assistant",
      content: `Xem [nguồn đã kiểm chứng](${hostileUri}).`,
      uiCard: sourceCard([{ title: "World Health Organization", uri: hostileUri }]),
    },
  ]));

  await expect(dialog.getByRole("link", { name: "liên kết thông thường" })).toHaveAttribute("href", ordinaryUri);
  await expect(dialog.getByRole("link", { name: /Mở nguồn Creatine evidence/ })).toHaveCount(0);
  const hostileChip = dialog.getByRole("link", {
    name: "Mở nguồn World Health Organization từ evil.example trong thẻ mới",
  });
  await expect(hostileChip).toHaveAttribute("href", hostileUri);
  await expect(hostileChip).toContainText("evil.example");
  await expect(hostileChip).not.toContainText("World Health Organization");
});

test("keeps legacy tool-history sources bound to their final assistant turn", async ({ page }) => {
  const dialog = await openAssistant(page, createHistory([
    { _id: "user-1", role: "user", content: "Creatine có ích không?" },
    { _id: "assistant-tool-call", role: "assistant", content: "" },
    {
      _id: "tool-1",
      role: "tool",
      content: "Nguồn đã kiểm chứng.",
      uiCard: sourceCard([{
        title: "CDC — Creatine guidance (vertexaisearch.cloud.google.com)",
        uri: legacyRedirectUri,
      }]),
    },
    {
      _id: "assistant-final",
      role: "assistant",
      content: `Creatine có thể hỗ trợ hiệu suất theo [nguồn](${legacyRedirectUri}).`,
    },
  ]));

  const chip = dialog.getByRole("link", {
    name: "Mở nguồn CDC — Creatine guidance từ Nguồn trong thẻ mới",
  });
  await expect(chip).toHaveAttribute("href", legacyRedirectUri);
  await expect(chip).not.toContainText("vertexaisearch.cloud.google.com");
  await expect(dialog.getByText("Nguồn tham khảo", { exact: true })).toHaveCount(0);
});
