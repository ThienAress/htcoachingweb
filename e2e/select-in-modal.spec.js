import { expect, test } from "@playwright/test";

test("an option list opens above a modal that uses a very high z-index", async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-e2e-role": "admin" } }),
  );
  await page.goto("/trainer/schedule");
  await page.getByRole("button", { name: /Tạo lịch mới/ }).click();

  const modal = page.locator('[class*="z-[100]"]').first();
  await expect(modal).toBeVisible();
  const modalZ = await modal.evaluate((node) => Number(getComputedStyle(node).zIndex));
  expect(modalZ).toBeGreaterThan(60);

  const select = modal.getByRole("combobox").last();
  await select.click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  const listZ = await list.evaluate((node) => Number(getComputedStyle(node).zIndex));
  expect(listZ).toBeGreaterThan(modalZ);

  // Playwright refuses to click an element that another element covers, so this proves the list is on top.
  const option = list.getByRole("option").nth(1);
  const label = (await option.innerText()).trim();
  await option.click();
  await expect(select).toContainText(label);
});
