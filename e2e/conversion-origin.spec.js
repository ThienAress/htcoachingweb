import { expect, test } from "@playwright/test";

const booking = {
  _id: "66b000000000000000000001",
  name: "Booking Lead",
  package: "Online",
  status: "completed",
  createdAt: "2026-08-05T08:00:00.000Z",
};
const contact = {
  _id: "66c000000000000000000001",
  name: "Contact Lead",
  package: "Online",
  status: "processed",
  createdAt: "2026-08-05T09:00:00.000Z",
};

test.describe("Explicit conversion origin controls", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "admin" },
      }),
    );
    await page.route("**/api/bookings**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [booking],
          pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
        }),
      }),
    );
    await page.route("**/api/contact**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [contact],
          pagination: { total: 1, page: 1, limit: 100, totalPages: 1 },
        }),
      }),
    );
  });

  test("creates an Order with only the selected Booking ID", async ({ page }) => {
    let submitted = null;
    await page.route("**/api/orders**", async (route) => {
      if (route.request().method() === "POST") {
        submitted = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { _id: "order-1", ...submitted, status: "pending" },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { orders: [], total: 0, page: 1, totalPages: 1 },
        }),
      });
    });
    await page.route("**/api/user/trainer-assignment-candidates**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { trainers: [], total: 0, page: 1, totalPages: 1 },
        }),
      }),
    );

    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Tạo đơn mới" }).click();
    await page.getByLabel("Loại nguồn", { exact: true }).selectOption("booking");
    await page.getByLabel("Bản ghi nguồn", { exact: true }).selectOption(booking._id);
    await page.getByLabel(/Họ tên/).fill("Order Customer");
    await page.getByLabel(/Email/).fill("order@example.com");
    await page.getByLabel(/Số điện thoại/).fill("0912345678");
    await page.getByLabel(/Gói tập/).selectOption("Cơ Bản(Online)");
    await page.getByLabel(/Số buổi/).fill("12");
    await page.getByLabel(/Phòng tập/).selectOption("Home gym");
    await page.getByLabel(/Thời gian/).fill("Thứ 2, 8 giờ");
    await page.getByRole("button", { name: "Lưu" }).click();

    await expect.poll(() => submitted).not.toBeNull();
    expect(submitted.originBookingId).toBe(booking._id);
    expect(submitted).not.toHaveProperty("originContactMessageId");
    expect(submitted).not.toHaveProperty("originType");
    expect(submitted).not.toHaveProperty("originId");
  });

  test("creates F1 with only the selected Contact ID", async ({ page }) => {
    let submitted = null;
    await page.route("**/api/f1-customers**", async (route) => {
      if (route.request().method() === "POST") {
        submitted = route.request().postDataJSON();
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { _id: "f1-1", ...submitted, status: "new" },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
        }),
      });
    });

    await page.goto("/f1-customers");
    await page.getByRole("button", { name: "Thêm khách hàng F1" }).click();
    await page.getByLabel("Loại nguồn", { exact: true }).selectOption("contact");
    await page.getByLabel("Bản ghi nguồn", { exact: true }).selectOption(contact._id);
    await page.getByLabel("Họ và tên").fill("Khach Hang F1");
    await page.getByLabel("Tuổi").fill("30");
    await page.getByLabel("Giới tính").selectOption("female");
    await page.getByLabel("Nghề nghiệp").fill("Van phong");
    await page.getByLabel("Số điện thoại").fill("0912345678");
    await page.getByLabel("Gmail").fill("customer@gmail.com");
    await page.getByRole("button", {
      name: "Tạo khách hàng và vào đánh giá thông tin",
    }).click();

    await expect.poll(() => submitted).not.toBeNull();
    expect(submitted.originContactMessageId).toBe(contact._id);
    expect(submitted).not.toHaveProperty("originBookingId");
    expect(submitted).not.toHaveProperty("originType");
    expect(submitted).not.toHaveProperty("originId");
  });
});
