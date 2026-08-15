import { expect, test } from "@playwright/test";

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

test("F1 mobile menu morph keeps state and reduced-motion behavior", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await useTrainer(page);
  await page.goto("/f1-customers");

  const toggle = page.getByTestId("f1-mobile-menu-toggle");
  await expect(toggle).toHaveAccessibleName("Mở menu F1");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle.locator('[data-icon-state="menu"]')).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAccessibleName("Đóng menu F1");
  await expect(toggle.locator('[data-icon-state="close"]')).toBeVisible();
  await expect(page.locator("#f1-navigation")).toHaveClass(/translate-x-0/);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle.locator('[data-icon-state="menu"]')).toBeVisible();
});
