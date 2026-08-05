import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("contract administration", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "admin" },
      }),
    );
  });

  test("loads the active contract and sends its cancel transition", async ({ page }) => {
    let cancelCalls = 0;
    page.on("dialog", (dialog) => dialog.accept());
    await page.route("**/api/contracts/contract-e2e/cancel", async (route) => {
      cancelCalls += 1;
      await route.fallback();
    });

    await page.goto("/admin/contracts");
    await expect(page.getByText("E2E Client").first()).toBeVisible();
    await page.getByTitle("Hủy").click();
    await expect.poll(() => cancelCalls).toBe(1);
  });
});

test.describe("contract handwritten signing", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("ht_language", "en");
    });
    await page.route("**/api/**", (route) =>
      route.continue({
        headers: { ...route.request().headers(), "x-e2e-role": "user" },
      }),
    );
  });

  test("requires reading, consent and a drawn signature before signing", async ({
    page,
  }) => {
    const contractId = "contract-signing-e2e";
    const trainerSignature =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+XgW+WQAAAABJRU5ErkJggg==";
    let status = "sent";
    let viewCalls = 0;
    let signPayload = null;

    const contractResponse = () => ({
      success: true,
      data: {
        _id: contractId,
        status,
        clientId: { _id: "000000000000000000000003" },
        clientInfo: {
          name: "E2E Client",
          email: "client.e2e@example.test",
          phone: "0901234567",
        },
        trainerInfo: {
          name: "E2E Trainer",
          email: "trainer.e2e@example.test",
          phone: "0912345678",
          birthYear: 1999,
          address: "Ho Chi Minh City",
        },
        trainerSignature,
        packageDetails: {
          packageName: "PT 10",
          sessions: 10,
          pricePerSession: 500000,
          totalAmount: 5000000,
          startDate: "2026-08-03T00:00:00.000Z",
          endDate: "2026-09-03T00:00:00.000Z",
        },
        customSections: [
          {
            title: "E2E terms",
            content: "The agreement is locked before it is sent.",
            items: ["The client agrees to sign after reviewing the agreement."],
          },
        ],
        ...(status === "signed"
          ? {
              signedAt: "2026-08-03T08:00:00.000Z",
              signatureImage: signPayload.signatureImage,
            }
          : {}),
      },
    });

    await page.route(`**/api/contracts/${contractId}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(contractResponse()),
      }),
    );
    await page.route(`**/api/contracts/${contractId}/view`, (route) => {
      viewCalls += 1;
      status = "viewed";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(contractResponse()),
      });
    });
    await page.route(`**/api/contracts/${contractId}/sign`, async (route) => {
      signPayload = route.request().postDataJSON();
      status = "signed";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(contractResponse()),
      });
    });

    await page.goto(`/contracts/${contractId}`);

    const consent = page.getByRole("checkbox");
    const signButton = page.getByRole("button", {
      name: /Confirm and sign agreement/i,
    });
    await expect(page.getByText("HTCOACHING")).toBeVisible();
    await expect(consent).toBeDisabled();
    await expect(signButton).toBeDisabled();

    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect.poll(() => viewCalls).toBe(1);
    await expect(consent).toBeEnabled();

    await consent.check();
    const canvas = page.getByLabel("Signature drawing area");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box.x + 30, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 110, { steps: 6 });
    await page.mouse.move(box.x + 170, box.y + 55, { steps: 6 });
    await page.mouse.up();

    const accessibility = await new AxeBuilder({ page })
      .exclude("phantom-ui")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations
        .filter((item) => item.impact === "critical")
        .map((item) => item.id),
    ).toEqual([]);

    await expect(signButton).toBeEnabled();
    await signButton.click();

    await expect(page.getByText(/Agreement signed/i).first()).toBeVisible();
    expect(signPayload.acceptedTerms).toBe(true);
    expect(signPayload.signatureImage).toMatch(/^data:image\/png;base64,/);
  });
});
