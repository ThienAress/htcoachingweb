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
      page.getByRole("link", { name: "Nguồn phiên B" }),
    ).toHaveAttribute("href", "/exercises");
    await expect(
      page.getByLabel("Phiên A đang nhận phản hồi"),
    ).toBeVisible();
    await expect(
      page.getByLabel("Phiên B đang nhận phản hồi"),
    ).toHaveCount(0);
    await expect(
      page.getByLabel("Phiên A đang nhận phản hồi"),
    ).toHaveCount(0);
    const activeAnswer = page
      .getByRole("dialog", { name: "HT Assistant" })
      .locator(".markdown-body");
    await expect(activeAnswer).toHaveText("Nội dung ổn định của phiên B. Nguồn phiên B");
    await expect(activeAnswer).not.toContainText("Phản hồi A");

    await page.getByText("Phiên A", { exact: true }).click();
    await expect(page.getByText("Phản hồi A đã hoàn tất ở nền")).toBeVisible();
  });

  test("stops a live response without rendering a late suffix", async ({ page }) => {
    test.setTimeout(60000);
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-e2e-role": "user",
          "x-e2e-ai-scenario": "stop-response",
        },
      }),
    );

    await page.goto("/");
    await page.getByRole("button", { name: "Mở HT Assistant" }).click();
    const input = page
      .getByPlaceholder("Hỏi về tập luyện, dinh dưỡng...")
      .first();
    await input.fill("Dừng câu trả lời đang phát");
    await input.press("Enter");

    await expect(
      page.getByText("Đoạn phản hồi đã phát trước khi dừng."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Dừng phản hồi" }).click();

    await expect(page.getByRole("button", { name: "Gửi tin nhắn" })).toBeVisible();
    await expect(input).toBeEnabled();
    await expect(
      page.getByText("Đoạn phản hồi đã phát trước khi dừng."),
    ).toBeVisible();
    const releaseResponse = await page.request.post(
      "http://127.0.0.1:5100/api/e2e/stop-response/release",
    );
    expect(releaseResponse.status()).toBe(200);
    expect(await releaseResponse.json()).toEqual({ success: true, released: false });
    await expect(page.getByText("Suffix không được phát sau Stop.")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  for (const recovery of [
    {
      action: "Retry",
      initialQuestion: "Câu hỏi gây lỗi provider",
      finalQuestion: "Câu hỏi gây lỗi provider",
    },
    {
      action: "Edit",
      initialQuestion: "Câu hỏi cần chỉnh sau lỗi provider",
      finalQuestion: "Câu hỏi đã chỉnh và phục hồi",
    },
  ]) {
    test(`recovers a provider failure with ${recovery.action} and renders its citation`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      let aiScenario = "provider-failure";
      const chatRequests = [];
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().endsWith("/api/ai/chat")
        ) {
          chatRequests.push(JSON.parse(request.postData() || "{}"));
        }
      });
      await page.route("**/api/**", (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            "x-e2e-role": "user",
            "x-e2e-ai-scenario": aiScenario,
          },
        }),
      );

      await page.goto("/");
      await page.getByRole("button", { name: "Mở HT Assistant" }).click();
      const input = page
        .getByPlaceholder("Hỏi về tập luyện, dinh dưỡng...")
        .first();
      await input.fill(recovery.initialQuestion);
      await input.press("Enter");

      await expect(page.getByRole("button", { name: "Dừng phản hồi" })).toBeVisible();
      await expect(input).toBeDisabled();
      const error = page.getByRole("alert");
      await expect(error).toContainText("Nhà cung cấp AI tạm thời không khả dụng");
      await expect(input).toBeEnabled();
      await expect(page.getByRole("button", { name: "Gửi tin nhắn" })).toBeVisible();
      await expect(error.getByRole("button", { name: /Thử lại/ })).toBeEnabled();

      aiScenario = "provider-recovery";
      if (recovery.action === "Retry") {
        await error.getByRole("button", { name: /Thử lại/ }).click();
      } else {
        await page.getByTitle("Chỉnh sửa câu hỏi").click();
        await page.locator("textarea:focus").fill(recovery.finalQuestion);
        await page.getByRole("button", { name: "Cập nhật" }).click();
      }

      await expect(page.getByText("Phản hồi đã phục hồi có nguồn.")).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Nguồn Knowledge Base" }),
      ).toHaveAttribute("href", "/exercises");
      await expect(error).toHaveCount(0);
      await expect(input).toBeEnabled();
      await expect(
        page.getByText(recovery.finalQuestion, { exact: true }),
      ).toHaveCount(1);
      expect(chatRequests).toHaveLength(2);
      expect(chatRequests[1]).toMatchObject({
        conversationId: "conversation-provider-failure",
        message: recovery.finalQuestion,
      });
      expect(chatRequests[0].requestId).not.toBe(chatRequests[1].requestId);
      if (recovery.action === "Edit") {
        await expect(
          page.getByText(recovery.initialQuestion, { exact: true }),
        ).toHaveCount(0);
      }
    });
  }

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
