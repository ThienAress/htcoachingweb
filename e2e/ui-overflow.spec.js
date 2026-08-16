import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 820 },
  { name: "desktop-1440", width: 1440, height: 1000 },
];

const SURFACES = [
  { name: "homepage", path: "/" },
  { name: "login", path: "/login" },
  { name: "admin shell", path: "/admin/deposits", role: "admin" },
  { name: "trainer shell", path: "/trainer", role: "trainer" },
  { name: "customer shell", path: "/dashboard", role: "user" },
  {
    name: "F1 shell",
    path: "/f1-customers",
    role: "trainer",
    trainerAccess: true,
  },
];

const useRole = async (page, surface) => {
  if (!surface.role) return;
  await page.route("**/api/**", (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-e2e-role": surface.role,
        ...(surface.trainerAccess
          ? { "x-e2e-trainer-access": "true" }
          : {}),
      },
    }),
  );
};

const inspectHorizontalOverflow = (page) =>
  page.evaluate(() => {
    const documentElement = document.documentElement;
    const body = document.body;
    const viewportWidth = documentElement.clientWidth;
    const documentWidth = Math.max(
      documentElement.scrollWidth,
      body?.scrollWidth ?? 0,
    );

    const selectorFor = (element) => {
      const tag = element.tagName.toLowerCase();
      if (element.id) return `${tag}#${CSS.escape(element.id)}`;
      const testId = element.getAttribute("data-testid");
      if (testId) return `${tag}[data-testid="${testId}"]`;
      const classNames = [...element.classList]
        .filter(Boolean)
        .slice(0, 2)
        .map((name) => `.${CSS.escape(name)}`)
        .join("");
      return `${tag}${classNames}`;
    };

    const culprits = [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          selector: selectorFor(element),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          position: style.position,
          overflowX: style.overflowX,
        };
      })
      .filter(
        (item) =>
          item.width > 0 &&
          item.right > viewportWidth + 1,
      )
      .slice(0, 8);

    return {
      viewportWidth,
      documentWidth,
      overflow: Math.max(0, documentWidth - viewportWidth),
      culprits,
    };
  });

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const surface of SURFACES) {
      test(`${surface.name} has no document-level horizontal overflow`, async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await useRole(page, surface);
        await page.goto(surface.path);
        await page.locator("#root").waitFor({ state: "visible" });
        await page.evaluate(async () => {
          await document.fonts?.ready;
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        });

        const report = await inspectHorizontalOverflow(page);
        const resolvedPath = new URL(page.url()).pathname;
        const diagnostic = [
          `Horizontal overflow on ${surface.name}`,
          `route=${surface.path}`,
          `resolved=${resolvedPath}`,
          `viewport=${viewport.width}x${viewport.height}`,
          `documentWidth=${report.documentWidth}`,
          `overflow=${report.overflow}`,
          `culprits=${JSON.stringify(report.culprits)}`,
        ].join(" | ");

        expect(report.documentWidth, diagnostic).toBeLessThanOrEqual(
          report.viewportWidth + 1,
        );
      });
    }
  });
}
