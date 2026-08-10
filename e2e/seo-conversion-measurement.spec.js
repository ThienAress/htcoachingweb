import { expect, test } from "@playwright/test";

const analyticsEvents = (page) =>
  page.evaluate(() =>
    (window.dataLayer || [])
      .map((entry) => Array.from(entry))
      .filter(([command]) => command === "event"),
  );

test.describe("public SEO/conversion measurement", () => {
  test("Hero consultation CTA keeps navigation without local GA4 emission", async ({
    page,
  }) => {
    await page.goto("/");

    await page.locator('a[href="#contact"]').first().click();

    await expect(page).toHaveURL(/#contact$/);
    expect(await analyticsEvents(page)).toEqual([]);
  });

  test("Contact success sends sanitized attribution without local GA4 or PII", async ({
    page,
  }) => {
    let requestBody = null;
    await page.route("**/api/contact", async (route) => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { _id: "contact-e2e" } }),
      });
    });
    await page.goto(
      "/?utm_source=Google&utm_medium=Organic&utm_campaign=Macro%20Launch",
    );

    const contact = page.locator("#contact");
    await contact.getByPlaceholder("Họ và tên").fill("Nguyen Van Test");
    await contact.getByPlaceholder("Email").fill("contact.e2e@gmail.com");
    await contact.getByPlaceholder("Số điện thoại").fill("0912345678");
    await contact
      .getByPlaceholder("Trang cá nhân FB or ZALO")
      .fill("https://www.facebook.com/test.user");
    await contact.locator("select").selectOption("ONLINE");
    await contact.getByRole("button", { name: "Gửi thông tin" }).click();

    await expect.poll(() => requestBody).not.toBeNull();
    expect(requestBody.attribution).toMatchObject({
      source: "google",
      medium: "organic",
      campaign: "Macro Launch",
      landingPath: "/",
      contentType: "page",
    });
    expect(requestBody.attribution).not.toHaveProperty("rawIp");

    await expect(contact.getByPlaceholder("Họ và tên")).toHaveValue("");
    expect(await analyticsEvents(page)).toEqual([]);
  });
});
