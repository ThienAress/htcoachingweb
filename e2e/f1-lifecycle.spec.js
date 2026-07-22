import path from "node:path";
import { expect, test } from "@playwright/test";

const CUSTOMER_ID = "100000000000000000000001";

const useTrainer = async (page) => {
  await page.route("**/api/**", (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-e2e-role": "trainer",
      },
    }),
  );
};

test("F1 create, intake, private media, assessment command and AI report", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await useTrainer(page);
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
  await page.locator('[name="gender"]').selectOption("male");
  await page.locator('[name="occupation"]').fill("Engineer");
  await page.locator('[name="phone"]').fill("0912345678");
  await page.locator('[name="email"]').fill("phase9.f1@gmail.com");
  await page.getByTestId("f1-create-submit").click();

  const intakeForm = page.getByTestId("f1-intake-form");
  await expect(intakeForm).toBeVisible();
  for (let step = 0; step < 4; step += 1) {
    await page.getByTestId("f1-intake-next").click();
  }
  await page
    .locator('[name="trainingProfileGoal.trainingExperience"]')
    .selectOption("none");
  await page
    .locator('[name="trainingProfileGoal.primaryGoal"]')
    .selectOption("fat_loss");
  await page
    .locator('[name="trainingProfileGoal.targetWeightKg"]')
    .fill("70");
  await page.getByTestId("f1-intake-next").click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(path.resolve("client/src/assets/images/hero/hero1.webp"));

  const completedDialog = page.waitForEvent("dialog");
  await page
    .getByTestId("f1-intake-form")
    .evaluate((form) => form.requestSubmit());
  const dialog = await completedDialog;
  expect(dialog.message()).toContain("intake");
  await dialog.accept();
  await expect(page.getByTestId("f1-open-assessment")).toBeEnabled();
  expect(mediaUploads).toBe(2);

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

  const generatedResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response
        .url()
        .endsWith("/f1-customers/" + CUSTOMER_ID + "/ai-reports/generate"),
  );
  await page.getByTestId("f1-generate-ai-report").click();
  expect((await generatedResponse).status()).toBe(201);
  await expect(page.getByTestId("f1-ai-report-content")).toBeVisible();
});
