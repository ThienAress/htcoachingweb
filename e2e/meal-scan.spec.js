import path from "node:path";
import { expect, test } from "@playwright/test";

const FIXTURE_IMAGE = path.resolve(
  "client/src/assets/images/hero/hero1.webp",
);

const range = (min, estimate, max) => ({ min, estimate, max });
const MEAL_SCAN_RESULT = {
  mealName: "Cơm gà nướng E2E",
  confidence: "medium",
  confidenceReasons: ["Khẩu phần được ước tính từ một góc ảnh."],
  imageAssessment: {
    status: "ok",
    foodVisible: true,
    quality: "good",
    scenario: "plated_meal",
    servingsVisible: 1,
    nutritionLabelVisible: false,
    barcodeVisible: false,
    issues: [],
  },
  total: {
    calories: range(558, 643, 744),
    protein: range(44.3, 51.9, 62.3),
    carb: range(44.8, 56, 67.2),
    fat: range(20.2, 21, 22.2),
  },
  declaredIngredients: [
    {
      name: "Dầu ô liu",
      grams: 15,
      status: "included",
      includedInTotal: true,
      sourceType: "macro_formula",
      calories: range(135, 135, 135),
      protein: range(0, 0, 0),
      carb: range(0, 0, 0),
      fat: range(15, 15, 15),
    },
  ],
  items: [
    {
      id: "chicken-e2e",
      label: "Ức gà nướng",
      portionGrams: range(130, 150, 180),
      calories: range(215, 248, 297),
      protein: range(40, 46.5, 55.8),
      carb: range(0, 0, 0),
      fat: range(4.7, 5.4, 6.5),
      note: "Không nhìn rõ lượng dầu ướp.",
      needsConfirmation: true,
      dataSource: "visual_estimate",
    },
    {
      id: "rice-e2e",
      label: "Cơm trắng",
      portionGrams: range(160, 200, 240),
      calories: range(208, 260, 312),
      protein: range(4.3, 5.4, 6.5),
      carb: range(44.8, 56, 67.2),
      fat: range(0.5, 0.6, 0.7),
      note: "",
      needsConfirmation: false,
      dataSource: "visual_estimate",
    },
  ],
  questions: ["Gà có thêm dầu hoặc sốt không?"],
  disclaimer: "Kết quả chỉ là khoảng ước tính từ ảnh.",
  allergyDisclaimer: "Không dùng ảnh để xác nhận an toàn dị ứng.",
};

const authenticateUser = async (page) => {
  await page.route("**/api/**", (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-e2e-role": "user",
      },
    }),
  );
};

const mockAnalysis = async (page, { status = 200, body } = {}) => {
  const state = { requests: 0 };
  await page.route("**/api/meal-scans/analyze", async (route) => {
    state.requests += 1;
    const requestBody = route.request().postDataJSON();
    expect(requestBody.image).toMatch(/^data:image\/(?:webp|jpeg);base64,/);
    expect(requestBody.locale).toBe("vi");
    expect(requestBody.declaredIngredients).toEqual([
      { name: "Dầu ô liu", grams: 15 },
    ]);
    expect(requestBody.providerDataUseAccepted).toBe(true);
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store" },
      body: JSON.stringify(
        body ?? { success: true, data: MEAL_SCAN_RESULT },
      ),
    });
  });
  return state;
};

const prepareScan = async (page) => {
  await page.goto("/quet-mon-an");
  await page.getByLabel("Chọn ảnh món ăn").setInputFiles(FIXTURE_IMAGE);
  await expect(
    page.getByAltText("Ảnh món ăn đã chọn để phân tích"),
  ).toBeVisible();

  const analyze = page.getByRole("button", { name: "Phân tích món ăn" });
  await expect(analyze).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Bổ sung thành phần bạn biết" }),
  ).toBeVisible();

  await page.getByLabel("Tên thành phần 1").fill("Dầu ô liu");
  await page
    .getByRole("spinbutton", { name: /Trọng lượng gram của/ })
    .fill("15");
  await page.getByRole("button", { name: "Khóa thông tin" }).click();
  await expect(page.getByText("Đã khóa thông tin")).toBeVisible();
  await expect(analyze).toBeEnabled();
};

const confirmAnalysis = async (page) => {
  await page.getByRole("button", { name: "Phân tích món ăn" }).click();
  const dialog = page.getByRole("dialog", {
    name: /Xác nhận gửi ảnh tới HT COACHING/,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Tôi hiểu và đồng ý" }).click();
};

const uploadAndAnalyze = async (page) => {
  await prepareScan(page);
  await confirmAnalysis(page);
};

test.describe("Meal Scan anonymous journey", () => {
  test("locks ingredient context and confirms quota before analysis", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const analysis = await mockAnalysis(page);
    await prepareScan(page);

    await page.getByRole("button", { name: "Phân tích món ăn" }).click();
    const dialog = page.getByRole("dialog", {
      name: /Xác nhận gửi ảnh tới HT COACHING/,
    });
    await dialog.getByRole("button", { name: "Quay lại điều chỉnh" }).click();
    expect(analysis.requests).toBe(0);

    await confirmAnalysis(page);
    await expect(
      page.getByRole("heading", { name: "Cơm gà nướng E2E" }),
    ).toBeVisible();
    await expect(page.getByText("Thành phần bạn khai báo")).toBeVisible();
    await expect(page.getByText("Dầu ô liu")).toBeVisible();
    await expect(page.getByText("15 g", { exact: true })).toBeVisible();
    await expect(page.getByText("Đã tính vào tổng")).toBeVisible();
    await expect(
      page.getByText("+135 kcal · Đạm 0 g · Tinh bột 0 g · Chất béo 15 g"),
    ).toBeVisible();
    expect(analysis.requests).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("prompts an exhausted guest trial to log in", async ({ page }) => {
    await mockAnalysis(page, {
      status: 429,
      body: {
        success: false,
        code: "MEAL_SCAN_ANONYMOUS_LIMITED",
        message: "Provider fallback message",
      },
    });
    await uploadAndAnalyze(page);

    await expect(page.getByRole("alert")).toContainText(
      "Bạn đã dùng hết 1 lượt quét không cần tài khoản.",
    );
    await expect(
      page.getByRole("link", { name: "Đăng nhập để quét tiếp" }),
    ).toBeVisible();
  });
});

test.describe("Meal Scan authenticated local journey", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test("renders the simplified result with Vietnamese macros and score", async ({
    page,
  }) => {
    await mockAnalysis(page);
    await uploadAndAnalyze(page);

    await expect(
      page.getByRole("heading", { name: "Cơm gà nướng E2E" }),
    ).toBeVisible();
    await expect(page.getByText("Chất đạm", { exact: true })).toBeVisible();
    await expect(page.getByText("Tinh bột", { exact: true })).toBeVisible();
    await expect(page.getByText("Chất béo", { exact: true })).toBeVisible();
    await expect(page.getByText("Điểm cân bằng macro")).toBeVisible();
    await expect(page.getByText("9/10")).toBeVisible();
    await expect(page.getByText(/^643\s*kcal$/)).toBeVisible();
    await expect(
      page.getByText("Khoảng có thể từ ảnh:", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Thành phần AI ước tính")).toBeVisible();
    await expect(
      page.getByText("Khẩu phần", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Đạm 5.4 g · Tinh bột 56 g · Chất béo 0.6 g"),
    ).toBeVisible();
    await expect(page.getByText(/legacy_unknown/)).toHaveCount(0);
    await expect(page.getByText("Kiểm tra trước khi xác nhận")).toHaveCount(0);
  });

  test("localizes the authenticated trial quota response", async ({ page }) => {
    await mockAnalysis(page, {
      status: 429,
      body: {
        success: false,
        code: "MEAL_SCAN_RATE_LIMITED",
        message: "Provider fallback message",
        meta: {
          quota: {
            serviceKey: "meal_scan",
            tier: "user",
            limit: 1,
            remaining: 0,
            resetAt: null,
            windows: [
              {
                key: "lifetime",
                limit: 1,
                remaining: 0,
                resetAt: null,
                period: "lifetime",
                periodLabel: "lifetime",
              },
            ],
          },
        },
      },
    });
    await uploadAndAnalyze(page);

    await expect(page.getByRole("alert")).toContainText(
      "Bạn đã dùng hết hạn mức Meal Scan hiện tại.",
    );
    await expect(
      page.getByRole("link", { name: "Xem gói để tiếp tục" }),
    ).toBeVisible();
  });

  test("does not send an entitled user back to pricing on quota exhaustion", async ({
    page,
  }) => {
    await mockAnalysis(page, {
      status: 429,
      body: {
        success: false,
        code: "MEAL_SCAN_RATE_LIMITED",
        message: "Bạn đã dùng hết hạn mức Meal Scan hiện tại. Vui lòng thử lại sau.",
        meta: {
          quota: {
            serviceKey: "meal_scan",
            tier: "trainer",
            limit: 20,
            remaining: 0,
            resetAt: "2026-08-19T00:00:00.000Z",
            windows: [
              {
                key: "daily",
                limit: 20,
                remaining: 0,
                resetAt: "2026-08-19T00:00:00.000Z",
                period: "rolling_day",
                periodLabel: "ngày",
              },
              {
                key: "monthly",
                limit: 600,
                remaining: 580,
                resetAt: "2026-09-17T00:00:00.000Z",
                period: "rolling_30_days",
                periodLabel: "30 ngày",
              },
            ],
          },
        },
      },
    });
    await uploadAndAnalyze(page);

    await expect(page.getByRole("alert")).toContainText(
      "Vui lòng thử lại sau.",
    );
    await expect(
      page.getByRole("link", { name: "Xem gói để tiếp tục" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Thử phân tích lại" }),
    ).toBeVisible();
  });

  test("shows the stable 422 retake error", async ({ page }) => {
    await mockAnalysis(page, {
      status: 422,
      body: {
        success: false,
        code: "MEAL_SCAN_NO_FOOD",
        message:
          "Ảnh chưa có món ăn hoặc đồ uống có thể phân tích. Hãy chụp lại phần ăn rõ hơn.",
      },
    });
    await uploadAndAnalyze(page);

    await expect(page.getByRole("alert")).toContainText(
      "Ảnh chưa có món ăn hoặc đồ uống có thể phân tích",
    );
    await expect(
      page.getByRole("button", { name: "Thử phân tích lại" }),
    ).toBeVisible();
  });

  test("keeps the simplified result usable at 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAnalysis(page);
    await uploadAndAnalyze(page);

    await expect(
      page.getByRole("heading", { name: "Cơm gà nướng E2E" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
