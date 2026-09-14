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
    const input = page.getByPlaceholder("Hỏi về tập luyện, dinh dưỡng...").first();
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

  test("reveals a coalesced SSE answer before its full response is displayed", async ({ page }) => {
    test.setTimeout(60000);
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-e2e-role": "user",
          "x-e2e-ai-scenario": "paced-final",
        },
      }),
    );
    const expectedAnswer =
      "HT Assistant đang trả lời theo từng đoạn. " +
      "Tăng tải vừa sức và nghỉ đủ giữa các buổi tập. ".repeat(35) +
      "Kết thúc phản hồi thử nghiệm.";

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const historyResponse = page.waitForResponse("**/api/ai/history");
    await page.getByRole("button", { name: "Mở HT Assistant" }).click();
    await historyResponse;

    const input = page.getByPlaceholder("Hỏi về tập luyện, dinh dưỡng...").first();
    const chatResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/ai/chat"),
    );
    await input.fill("Trả lời tăng dần cho tôi");
    await input.press("Enter");

    const response = await chatResponse;
    expect(response.status()).toBe(200);
    // The message wrapper is the only stable assistant-content boundary in ChatBubble.
    const answer = page.getByRole("dialog", { name: "HT Assistant" })
      .locator(".markdown-body");
    await expect(answer).toContainText("HT Assistant đang trả lời");
    await expect(answer).not.toHaveText(expectedAnswer);
    await expect(page.getByRole("button", { name: "Dừng phản hồi" })).toBeVisible();

    await response.finished();
    await expect(answer).toHaveText(expectedAnswer);
    await expect(page.getByRole("button", { name: "Gửi tin nhắn" })).toBeVisible();
  });

  test("keeps conversation A streaming while the user views conversation B", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-e2e-role": "user",
          "x-e2e-ai-scenario": "conversation-switch",
        },
      }),
    );

    await page.goto("/");
    await page.getByRole("button", { name: "Mở HT Assistant" }).click();
    await expect(page.getByText("Phiên A", { exact: true })).toBeVisible();

    const input = page
      .getByPlaceholder("Hỏi về tập luyện, dinh dưỡng...")
      .first();
    await input.fill("Tiếp tục trả lời ở phiên A");
    await input.press("Enter");
    await expect(page.getByText(/Phản hồi A đang chạy/)).toBeVisible();
    await expect(
      page.getByLabel("Phiên A đang nhận phản hồi"),
    ).toBeVisible();

    await page.getByText("Phiên B", { exact: true }).click();
    await expect(page.getByText("Nội dung ổn định của phiên B")).toBeVisible();
    await expect(
      page.getByLabel("Phiên A đang nhận phản hồi"),
    ).toBeVisible();
    await expect(
      page.getByLabel("Phiên B đang nhận phản hồi"),
    ).toHaveCount(0);
    await expect(
      page.getByLabel("Phiên A đang nhận phản hồi"),
    ).toHaveCount(0);

    await page.getByText("Phiên A", { exact: true }).click();
    await expect(page.getByText("Phản hồi A đã hoàn tất ở nền")).toBeVisible();
  });

  test("submits an opaque confirmation token and settles the card", async ({
    page,
  }) => {
    let confirmationBody;
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-e2e-role": "user",
          "x-e2e-ai-scenario": "confirmation",
        },
      }),
    );
    page.on("request", (request) => {
      if (request.url().endsWith("/api/ai/tool-confirmations/confirm")) {
        confirmationBody = request.postDataJSON();
      }
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Mở HT Assistant" }).click();
    const input = page
      .getByPlaceholder("Hỏi về tập luyện, dinh dưỡng...")
      .first();
    await input.fill("Thực hiện hành động đã kiểm tra");
    await input.press("Enter");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();

    await expect(page.getByText("Đã xác nhận và xử lý hành động.")).toBeVisible();
    expect(confirmationBody).toEqual({
      token: "abcdefghijklmnopqrstuvwxyzABCDEFGH123456789",
    });
    await expect(
      page.getByRole("button", { name: "Xác nhận", exact: true }),
    ).toHaveCount(0);
  });
});
