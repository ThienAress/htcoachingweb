import { expect, test } from "@playwright/test";

const trainer = {
  _id: "trainer-hoang-thien-e2e",
  slug: "hoang-thien",
  name: "Hoàng Thiện",
  title: "Huấn luyện viên cá nhân",
  headline: "Đồng hành bằng lộ trình phù hợp",
  images: [],
};

const stories = [
  {
    _id: "story-one-e2e",
    slug: "hanh-trinh-mot",
    name: "Khách hàng Một",
    result: "Hoàn thành mục tiêu đầu tiên",
    trainerId: trainer._id,
  },
  {
    _id: "story-two-e2e",
    slug: "hanh-trinh-hai",
    name: "Khách hàng Hai",
    result: "Duy trì tiến bộ bền vững",
    trainerId: trainer._id,
  },
];

test("trainer customer results form a single column without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/trainers/hoang-thien?*", (route) =>
    route.fulfill({ json: { success: true, data: trainer } }),
  );
  await page.route("**/api/customer-stories?*", (route) =>
    route.fulfill({ json: { success: true, data: stories } }),
  );

  await page.goto("/huan-luyen-vien/hoang-thien/");

  const results = page.getByRole("region", { name: "Kết quả khách hàng" });
  const cards = results.locator("article");
  await expect(cards).toHaveCount(2);

  const firstBox = await cards.nth(0).boundingBox();
  const secondBox = await cards.nth(1).boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 1);
  expect(
    await results.evaluate((node) => node.scrollWidth === node.clientWidth),
  ).toBe(true);
});
