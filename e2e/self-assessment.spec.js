import { expect, test } from "@playwright/test";

const routeAs = async (page, accessMode) => {
  await page.route("**/api/**", (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-e2e-role": "user",
        "x-e2e-access-mode": accessMode,
      },
    }),
  );
};

const choose = async (page, name, option) => {
  await page.getByRole("combobox", { name }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

test.describe("Đánh giá bản thân HT Fitness+", () => {
  test("thành viên Fitness+ làm đánh giá từ đầu tới kết quả rồi chỉ xem khi hết hạn", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await routeAs(page, "self_managed");
    await page.goto("/dashboard/self-assessment");

    await expect(page.getByRole("heading", { name: "Đánh giá bản thân", level: 1 })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Điều hướng bảng theo dõi" })
        .getByRole("link", { name: "Đánh giá bản thân" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Bắt đầu đánh giá" }).click();
    await page.getByLabel(/Tôi đồng ý cho phép lưu/).check();
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    await expect(page.getByText("Số đo cơ bản")).toBeVisible();
    await page.getByLabel("Tuổi", { exact: true }).fill("30");
    await page.getByLabel("Chiều cao (cm)").fill("175");
    await page.getByLabel("Cân nặng (kg)").fill("80");
    await choose(page, "Giới tính sinh học", "Nam");
    await choose(page, "Tình trạng hiện tại", "Đang tập đều");
    await choose(page, "Kinh nghiệm tập", "Có kinh nghiệm (6 tháng đến 2 năm)");
    await choose(page, "Mục tiêu chính", "Tăng cơ");
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    await expect(page.getByRole("heading", { name: "Push-Up" })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await choose(page, "Cách hít đất bạn đã làm", "Hít đất quỳ");
    await page.getByLabel("Số lần", { exact: true }).fill("20");
    await page.getByRole("button", { name: "Xem kết quả" }).click();

    await expect(page.getByText("Mức thể lực tổng: Khá")).toBeVisible();
    await expect(page.getByRole("link", { name: "Mở thư viện bài tập" })).toHaveAttribute("href", "/exercises");
    await expect(page.getByText("Nên làm lại sau 28 ngày")).toBeVisible();

    // Làm lại sớm: hiện hộp xác nhận mềm, chọn "Để sau" thì giữ nguyên kết quả.
    await page.getByRole("button", { name: "Làm lại đánh giá" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Làm lại sớm hơn khuyến nghị?");
    await dialog.getByRole("button", { name: "Để sau" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Mức thể lực tổng: Khá")).toBeVisible();

    // Gói hết hạn: xem lại được kết quả nhưng không còn thao tác ghi.
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await routeAs(page, "expired");
    await page.reload();
    await expect(page.getByText("chỉ xem lại được kết quả")).toBeVisible();
    await expect(page.getByText("Mức thể lực tổng: Khá")).toBeVisible();
    await expect(page.getByRole("button", { name: "Làm lại đánh giá" })).toHaveCount(0);
    await expect(
      page
        .getByRole("navigation", { name: "Điều hướng bảng theo dõi" })
        .getByRole("link", { name: "Đánh giá bản thân" }),
    ).toBeVisible();
  });

  test("khách coaching không thấy mục Đánh giá bản thân trên sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route("**/api/**", (route) =>
      route.continue({ headers: { ...route.request().headers(), "x-e2e-role": "user" } }),
    );
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Điều hướng bảng theo dõi" });
    await expect(nav.getByRole("link", { name: "Hôm nay" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Đánh giá bản thân" })).toHaveCount(0);
  });
});
