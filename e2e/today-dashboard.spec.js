import { expect, test } from "@playwright/test";

const getVietnamDateKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return values.year + "-" + values.month + "-" + values.day;
};

test.describe("Today Dashboard private journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-e2e-role": "user",
        },
      }),
    );
  });

  test("renders the active Today state on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/today/" + getVietnamDateKey());

    await expect(page).toHaveURL(
      new RegExp("/dashboard/today/" + getVietnamDateKey() + "$")
    );
    await expect(
      page.getByRole("heading", { name: "Tổng quan hôm nay" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "E2E Strength Session" }),
    ).toBeVisible();
    await expect(page.getByLabel("Giấc ngủ (giờ)")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Điều hướng bảng theo dõi" }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/i,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("persists wellness after reload", async ({ page }) => {
    await page.goto(
      "/dashboard/today/" + getVietnamDateKey() + "/journal",
    );
    const sleep = page.getByLabel("Giấc ngủ (giờ)");

    await sleep.fill("7.5");
    await expect(page.getByText("Đã lưu", { exact: true })).toBeVisible();
    await page.reload();

    await expect(page.getByLabel("Giấc ngủ (giờ)")).toHaveValue("7.5");
  });

  test("switches daily modules without losing the selected date", async ({
    page,
  }) => {
    const dateKey = getVietnamDateKey();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/today/" + dateKey);

    const navigation = page.getByRole("navigation", {
      name: "Điều hướng bảng theo dõi",
    });
    await navigation.getByRole("link", { name: "Dinh dưỡng" }).click();
    await expect(page).toHaveURL(
      new RegExp("/dashboard/today/" + dateKey + "/nutrition$")
    );
    await expect(
      page.getByRole("heading", { name: "Dinh dưỡng hôm nay" }),
    ).toBeVisible();

    await navigation.getByRole("link", { name: "Nhật ký" }).click();
    await expect(page).toHaveURL(
      new RegExp("/dashboard/today/" + dateKey + "/journal$")
    );
    await expect(page.getByLabel("Giấc ngủ (giờ)")).toBeVisible();
  });

  test("keeps the desktop sidebar visible while opening training", async ({
    page,
  }) => {
    const dateKey = getVietnamDateKey();
    await page.goto("/dashboard/today/" + dateKey);

    const navigation = page.getByRole("navigation", {
      name: "Điều hướng bảng theo dõi",
    });
    await expect(navigation).toBeVisible();
    await navigation.getByRole("link", { name: "Tập luyện" }).click();

    await expect(page).toHaveURL(
      new RegExp("/dashboard/today/" + dateKey + "/training$"),
    );
    await expect(
      page.getByRole("heading", { name: "Lịch & bài tập", level: 1 }),
    ).toBeVisible();
    await expect(navigation).toBeVisible();
  });

  test("keeps only the Customer Dashboard entry in the account menu", async ({
    page,
  }) => {
    await page.goto("/tdee-calculator");
    await page.getByRole("button", { name: "Mở menu tài khoản" }).click();

    const menu = page.getByTestId("account-dropdown-menu");
    await expect(
      menu.getByRole("button", { name: "Dashboard học viên" }),
    ).toBeVisible();
    for (const oldLabel of [
      "Lịch sử checkin",
      "Đăng ký giờ tập",
      "Giáo án tập luyện",
      "Giáo án online",
      "Gợi ý meal plan",
      "Hệ thống bài tập",
    ]) {
      await expect(
        menu.getByRole("button", { name: oldLabel, exact: true }),
      ).toHaveCount(0);
    }
  });

  test("opens every legacy customer tool from its Dashboard module", async ({
    page,
  }) => {
    const dateKey = getVietnamDateKey();
    await page.goto("/dashboard/today/" + dateKey + "/training");

    for (const [name, path] of [
      ["Đăng ký giờ tập", "/book-training"],
      ["Mở giáo án trực tuyến", "/online-coaching"],
      ["Xem giáo án tập luyện", "/workout-plans"],
      ["Xem lịch sử điểm danh", "/my-history"],
      ["Hệ thống bài tập", "/exercises/"],
    ]) {
      await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute(
        "href",
        path,
      );
    }

    await page.goto("/dashboard/today/" + dateKey + "/nutrition");
    await expect(
      page.getByRole("link", { name: "Tính TDEE và tạo thực đơn" }),
    ).toHaveAttribute("href", "/tdee-calculator/");
  });

  test("shows a saved meal plan in a fresh browser context", async ({
    browser,
  }) => {
    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
    try {
      const firstPage = await firstContext.newPage();
      await firstPage.route("**/api/**", (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            "x-e2e-role": "user",
          },
        }),
      );
      await firstPage.goto("/");
      const saved = await firstPage.evaluate(async () => {
        const response = await fetch(
          "http://127.0.0.1:5100/api/saved-meal-plans",
          {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: crypto.randomUUID() }),
          },
        );
        return response.status;
      });
      expect(saved).toBe(201);
      await firstContext.close();

      const secondPage = await secondContext.newPage();
      await secondPage.route("**/api/**", (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            "x-e2e-role": "user",
          },
        }),
      );
      await secondPage.goto("/mealplan");
      await expect(secondPage.getByText("Thực đơn E2E đã lưu")).toBeVisible();
    } finally {
      await firstContext.close().catch(() => {});
      await secondContext.close().catch(() => {});
    }
  });

  test("renders Progress and keeps missing metrics explicit", async ({
    page,
  }) => {
    await page.goto("/progress");

    await expect(page).toHaveURL(/\/dashboard\/progress$/);
    await expect(
      page.getByRole("heading", { name: "Tổng quan hoạt động của bạn" }),
    ).toBeVisible();
    await expect(page.getByText("50%").first()).toBeVisible();
    await expect(page.getByText("Chưa có dữ liệu").first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/i,
    );
  });

  test("opens the notification popover with keyboard-safe dismissal", async ({
    page,
  }) => {
    await page.goto("/notifications");
    const trigger = page.getByRole("button", {
      name: /Thông báo, 1 chưa đọc/,
    });

    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Thông báo và tùy chọn" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Thông báo và tùy chọn" }),
    ).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("uses the server deepLink from the notification inbox", async ({
    page,
  }) => {
    await page.goto("/notifications");
    await page
      .getByRole("button", { name: /HLV đã review Weekly Check-in/ })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/progress$/);
  });
});
