import { test, expect } from "@playwright/test";

const useRole = async (page, role) => {
  await page.route("**/api/**", (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-e2e-role": role },
    }),
  );
};

const getNextMonday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  const date = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)),
  );
  const appDay = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1;
  date.setUTCDate(date.getUTCDate() + (((0 - appDay + 7) % 7) || 7));
  return (
    date.getUTCFullYear() +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getUTCDate()).padStart(2, "0")
  );
};

const trainingDateKey = getNextMonday();

test("client sees a concrete training occurrence and assigned trainer", async ({
  page,
}) => {
  await useRole(page, "user");
  await page.goto("/book-training");

  await expect(page.getByText(trainingDateKey, { exact: true })).toBeVisible();
  await expect(page.getByText(/E2E Trainer/).first()).toBeVisible();
  await expect(page.getByText("E2E concrete occurrence")).toBeVisible();
});

test("trainer calendar navigates by concrete week without losing occurrences", async ({
  page,
}) => {
  await useRole(page, "trainer");
  await page.goto("/training-schedule");

  await expect(page.getByText("1 buổi tập", { exact: true })).toBeVisible();
  await page.getByTitle("Tuần sau").click();
  await expect(page.getByText("E2E Client", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(trainingDateKey.slice(5), { exact: true }),
  ).toBeVisible();
});

test("admin lead transition sends the current revision", async ({ page }) => {
  await useRole(page, "admin");
  let transitionBody = null;
  await page.route("**/api/bookings/lead-booking-e2e/status", async (route) => {
    transitionBody = route.request().postDataJSON();
    await route.fallback();
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/admin/bookings");
  await expect(page.getByText("E2E Lead Client")).toBeVisible();
  await page.getByTitle("Đã liên hệ").click();

  await expect.poll(() => transitionBody).toEqual({
    status: "contacted",
    revision: 0,
  });
});
