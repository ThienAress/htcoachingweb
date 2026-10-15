import path from "node:path";
import { expect, test } from "@playwright/test";

const CUSTOMER_ID = "100000000000000000000001";

const useTrainer = async (page) => {
  await page.route("**/api/**", (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-e2e-role": "trainer",
        "x-e2e-trainer-access": "true",
      },
    }),
  );
};

test("F1 desktop sidebar can be collapsed and reopened", async ({ page }) => {
  await useTrainer(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/f1-customers");

  const sidebar = page.locator("#f1-navigation");
  await expect(sidebar).toHaveCSS("width", "288px");

  await page.getByRole("button", { name: "Thu menu F1" }).click();
  await expect(sidebar).toHaveCSS("width", "0px");

  await page.getByRole("button", { name: "Mở menu F1" }).click();
  await expect(sidebar).toHaveCSS("width", "288px");
});

test("F1 create, intake, private media, assessment command and AI report", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await useTrainer(page);
  page.on("dialog", (dialog) => dialog.accept());
  let mediaUploads = 0;
  page.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      response.url().endsWith("/f1-customers/" + CUSTOMER_ID + "/media")
    ) {
      mediaUploads += 1;
    }
  });

  await page.goto("/f1-customers");
  const openCreate = page.getByTestId("f1-open-create");
  await openCreate.focus();
  await expect(openCreate).toBeFocused();
  await page.keyboard.press("Enter");

  await page.locator('[name="fullName"]').fill("Nguyen Minh Khang");
  await page.locator('[name="age"]').fill("30");
  await page.getByRole("combobox", { name: "Giới tính" }).click();
  await page.getByRole("option", { name: "Nam" }).click();
  await page.locator('[name="occupation"]').fill("Engineer");
  await page.locator('[name="phone"]').fill("0912345678");
  await page.locator('[name="email"]').fill("phase9.f1@gmail.com");
  await page.getByTestId("f1-create-submit").click();

  const intakeForm = page.getByTestId("f1-intake-form");
  await expect(intakeForm).toBeVisible();
  await page.getByTestId("f1-intake-next").click();
  const injuriesSwitch = page.getByRole("switch", {
    name: "Có chấn thương cần lưu ý không?",
  });
  await injuriesSwitch.click();
  await expect(injuriesSwitch).toHaveAttribute("aria-checked", "true");
  await page.locator('[name="healthScreening.injuries"]').fill("Trật vai cũ");
  await page.getByRole("switch", { name: "Có bệnh lý hiện tại không?" }).click();
  await expect(
    page.locator('[name="healthScreening.currentConditions"]'),
  ).toBeVisible();
  for (let step = 0; step < 2; step += 1) {
    await page.getByTestId("f1-intake-next").click();
  }
  await page.locator('[name="bodyMetrics.heightCm"]').fill("175");
  await page.locator('[name="bodyMetrics.weightKg"]').fill("78");
  await page.getByTestId("f1-intake-next").click();
  await page.getByRole("combobox", { name: "Trước đây đã từng tập chưa?" }).click();
  await page.getByRole("option", { name: "Chưa từng tập" }).click();
  await page.getByRole("combobox", { name: "Mục tiêu chính" }).click();
  await page.getByRole("option", { name: "Giảm mỡ" }).click();
  await page
    .locator('[name="trainingProfileGoal.targetWeightKg"]')
    .fill("70");
  await page.getByTestId("f1-intake-next").click();
  await expect(page.getByTestId("f1-intake-submit")).toBeVisible();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(path.resolve("client/src/assets/images/hero/hero1.webp"));
  await expect(page.getByText("hero1.webp", { exact: true })).toBeVisible();

  await page
    .getByTestId("f1-intake-submit")
    .evaluate((button) => button.click());
  await expect(intakeForm).toBeHidden();
  await expect(page.getByTestId("f1-open-assessment")).toBeEnabled();
  await expect.poll(() => mediaUploads).toBe(2);

  // Sau khi lưu khảo sát, báo cáo tổng quát tự mở ở giữa màn hình.
  const summary = page.getByTestId("f1-summary-report");
  await expect(summary).toBeVisible();
  await expect(
    summary.getByRole("heading", { name: "Báo cáo tổng quát khách hàng" }),
  ).toBeVisible();
  await summary.getByRole("button", { name: "Đóng báo cáo" }).click();
  await expect(summary).toBeHidden();

  await page.getByTestId("f1-open-assessment").click();
  await page
    .getByRole("checkbox", { name: "Không có biểu hiện tư thế sai" })
    .first()
    .check();
  await expect(
    page
      .getByRole("checkbox", { name: "Không có biểu hiện tư thế sai" })
      .first(),
  ).toBeChecked();

  const pushCard = page
    .getByTestId("f1-exercise-card")
    .filter({ hasText: "Upper Push" });
  // Gợi ý và bài tập chỉ hiện sau khi chọn cấp độ rồi chọn bài.
  await expect(pushCard.getByText("Gợi ý khởi đầu")).toHaveCount(0);
  const pick = async (card, label, option) => {
    await card.getByRole("combobox", { name: label }).click();
    await card.getByRole("option", { name: option, exact: true }).click();
  };
  await pick(pushCard, "Chọn cấp độ cho bài test", "Mức dễ");
  await expect(pushCard.getByText("Gợi ý khởi đầu")).toHaveCount(0);
  await pick(pushCard, "Chọn bài tập", "Wall Push-Up");
  await expect(pushCard.getByText("Gợi ý khởi đầu")).toBeVisible();
  await pick(pushCard, "Cách ghi kết quả", "Theo số lần (reps)");
  await pushCard.getByLabel("Số hiệp (set)").fill("3");
  await pushCard.getByLabel("Số lần mỗi hiệp (reps)").fill("10");
  await expect(pushCard.getByText("Tổng hợp:")).toContainText("Trung bình");
  await pushCard
    .getByLabel("Tên bài test riêng của HLV")
    .fill("Squat nhảy 30 giây");
  await pushCard.getByRole("button", { name: "Thêm" }).click();
  await expect(pushCard.getByText("Bài riêng của HLV").first()).toBeVisible();

  const assessmentStatus = await page.evaluate(async (customerId) => {
    const response = await fetch(
      "http://127.0.0.1:5100/api/f1-customers/" +
        customerId +
        "/assessments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-E2E-Role": "trainer",
        },
        body: JSON.stringify({ provider: "e2e-mock" }),
      },
    );
    return response.status;
  }, CUSTOMER_ID);
  expect(assessmentStatus).toBe(201);

  await page.goto("/f1-customers");
  await page.getByTestId("f1-open-customer").click();
  await expect(page.getByTestId("f1-open-ai-report")).toBeEnabled();
  await page.getByTestId("f1-open-ai-report").click();

  await page
    .getByTestId("f1-generate-ai-report")
    .evaluate((button) => button.click());
  await expect(page.getByTestId("f1-ai-report-content")).toBeVisible();
});
