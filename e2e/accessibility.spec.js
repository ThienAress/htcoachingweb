import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const useRole = async (page, role) => {
  await page.route("**/api/**", (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-e2e-role": role,
      },
    }),
  );
};

const expectNoCriticalViolations = async (page) => {
  const results = await new AxeBuilder({ page })
    .exclude("phantom-ui")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const violations = results.violations
    .filter((item) => item.impact === "critical")
    .map((item) => ({
      id: item.id,
      impact: item.impact,
      targets: item.nodes.map((node) => node.target.join(" ")).slice(0, 5),
    }));
  expect(violations).toEqual([]);
};

test("public and auth screens pass critical accessibility smoke", async ({
  page,
}) => {
  await page.goto("/");
  await expectNoCriticalViolations(page);
  await page.goto("/login");
  await expectNoCriticalViolations(page);
});

test("admin financial screen passes critical accessibility smoke", async ({
  page,
}) => {
  await useRole(page, "admin");
  await page.goto("/admin/deposits");
  await expectNoCriticalViolations(page);
});

test("trainer schedule passes critical accessibility smoke", async ({
  page,
}) => {
  await useRole(page, "trainer");
  await page.goto("/training-schedule");
  await expectNoCriticalViolations(page);
});

test("F1 mobile workflow screen passes critical accessibility smoke", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useRole(page, "trainer");
  await page.goto("/f1-customers");
  await expectNoCriticalViolations(page);
});
