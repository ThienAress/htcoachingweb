import { expect, test } from "@playwright/test";
import { getVietnamDateKey, getMonthWeekPeriod } from "../client/src/utils/vietnamDate.js";

// Recon: real local DOM on 4174, synthetic x-e2e-role identities, 2026-09-08.
// Only assessment responses are overridden; auth and surrounding workspace use mock-api.cjs.
const CLIENT_ID = "000000000000000000000003";
const today = getVietnamDateKey();
const week = getMonthWeekPeriod(today).startDateKey;
const oldDate = new Date(`${today}T12:00:00+07:00`);
oldDate.setUTCDate(oldDate.getUTCDate() - 21);
const previousDate = oldDate.toISOString().slice(0, 10);
const previousWeek = getMonthWeekPeriod(previousDate).startDateKey;
const segments = (leanKg) => ({
  leftArm: { leanKg: 2.7, fatKg: 1.1, leanReferencePercent: 98, fatReferencePercent: 130 },
  rightArm: { leanKg: 2.8, fatKg: 1.2, leanReferencePercent: 102, fatReferencePercent: 135 },
  trunk: { leanKg, fatKg: 11.6, leanReferencePercent: 110, fatReferencePercent: 210 },
  leftLeg: { leanKg: 8.3, fatKg: 2.2, leanReferencePercent: 101, fatReferencePercent: 140 },
  rightLeg: { leanKg: null, fatKg: null, leanReferencePercent: null, fatReferencePercent: null },
});
const published = (date, leanKg) => ({ measuredDateKey: date, deviceLabel: "Máy đo E2E", referenceBasis: "ideal_weight", segments: segments(leanKg), note: "Dữ liệu kiểm thử tổng hợp" });
const makeStore = (withCurrent = false) => ({
  record: withCurrent ? { id: "assessment-current", weekStartDateKey: week, revision: 2, published: published(today, 28.5), draft: published(today, 28.5) } : null,
  previous: { id: "assessment-previous", weekStartDateKey: previousWeek, published: published(previousDate, 28) },
  deny: false,
});

const installFixture = async (page, role, store) => {
  await page.route("**/api/**", (route) => route.continue({ headers: { ...route.request().headers(), "x-e2e-role": role } }));
  await page.route("**/api/body-assessments**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (data, status = 200) => route.fulfill({ status, json: { success: status === 200, data }, headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4174", "Access-Control-Allow-Credentials": "true" } });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:4174", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type,x-csrf-token", "Access-Control-Allow-Methods": "GET,PUT,POST" } });
    if (store.deny) return json(null, 403);
    if (req.method() === "PUT") {
      const body = req.postDataJSON();
      if (body.expectedRevision !== (store.record?.revision || 0)) return json(null, 409);
      store.record = { ...store.record, id: "assessment-current", weekStartDateKey: week, revision: (store.record?.revision || 0) + 1, draft: structuredClone(body.draft) };
      return json({ assessment: store.record });
    }
    if (req.method() === "POST") {
      const body = req.postDataJSON();
      if (body.expectedRevision !== store.record.revision) return json(null, 409);
      store.record.published = structuredClone(store.record.draft);
      store.record.draft = null;
      store.record.revision += 1;
      return json({ assessment: store.record });
    }
    if (url.pathname.endsWith(week)) return json({ assessment: store.record });
    const items = [store.record, store.previous].filter((item) => item?.published)
      .map(({ id, weekStartDateKey, published: snapshot }) => ({ id, weekStartDateKey, published: snapshot }));
    return json({ items, pagination: { page: 1, limit: 20, total: items.length } });
  });
};

test("trainer saves/publishes, draft edits stay private, republish updates one comparison", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const store = makeStore();
  await installFixture(page, "trainer", store);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/trainer/clients/${CLIENT_ID}?tab=tasks`);
  const editor = page.getByRole("region", { name: "Kết quả đo thành phần cơ thể", exact: true });
  await expect(editor.getByRole("button", { name: "Gửi cho học viên", exact: true })).toBeDisabled();
  await editor.getByLabel("Ngày đo thực tế").fill(today);
  await editor.getByLabel("Thiết bị hoặc nguồn đo").fill("Máy đo E2E");
  await editor.getByLabel("Mức tham chiếu trên phiếu").selectOption("ideal_weight");
  await editor.getByRole("spinbutton", { name: "Phân bổ cơ nạc từng vùng — Bụng — kg", exact: true }).fill("28.5");
  await editor.getByRole("spinbutton", { name: "Phân bổ cơ nạc từng vùng — Bụng — % tham chiếu", exact: true }).fill("110");
  await editor.getByRole("spinbutton", { name: "Phân bổ mỡ từng vùng — Bụng — kg", exact: true }).fill("11.6");
  await editor.getByRole("button", { name: "Lưu nháp", exact: true }).click();
  await expect(page.getByText("Đã lưu nháp kết quả đo", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Gửi cho học viên", exact: true }).click();
  await editor.getByRole("button", { name: "Vẫn gửi", exact: true }).click();
  await expect(page.getByText("Đã gửi kết quả đo cho học viên", { exact: true })).toBeVisible();

  const studentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const student = await studentContext.newPage();
    await installFixture(student, "user", store);
    await student.goto("/dashboard/progress#composition");
    const report = student.getByRole("region", { name: "Phân bố thành phần cơ thể", exact: true });
    const leanComparison = report.getByRole("table", { name: /Đối chiếu cơ nạc/ });
    const trunkRow = leanComparison.getByRole("row", { name: /Bụng/ });
    await expect(trunkRow.getByRole("cell", { name: "28,5", exact: true })).toBeVisible();
    await expect(report.getByRole("cell", { name: "+0,5 kg", exact: true })).toBeVisible();
    await editor.getByRole("spinbutton", { name: "Phân bổ cơ nạc từng vùng — Bụng — kg", exact: true }).fill("29");
    await editor.getByLabel("Lý do cập nhật").fill("Điều chỉnh số đo kiểm thử");
    await editor.getByRole("button", { name: "Lưu nháp", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Gửi cho học viên", exact: true })).toBeEnabled();
    await student.reload();
    await expect(trunkRow.getByRole("cell", { name: "28,5", exact: true })).toBeVisible();
    await expect(trunkRow.getByRole("cell", { name: "29", exact: true })).toHaveCount(0);
    await editor.getByRole("button", { name: "Gửi cho học viên", exact: true }).click();
    await editor.getByRole("button", { name: "Vẫn gửi", exact: true }).click();
    await expect.poll(() => store.record.published.segments.trunk.leanKg).toBe(29);
    await student.reload();
    await expect(trunkRow.getByRole("cell", { name: "29", exact: true })).toBeVisible();
    await expect(report.getByRole("combobox", { name: "Lần đo đang xem" }).locator("option")).toHaveCount(2);
  } finally { await studentContext.close(); }
});

for (const width of [1440, 390, 320]) {
  test(`published diagrams and weekly groups remain usable at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const store = makeStore(true);
    await installFixture(page, "user", store);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/dashboard/progress#composition");
    const report = page.getByRole("region", { name: "Phân bố thành phần cơ thể", exact: true });
    await expect(report.getByLabel("Lần đo đang xem")).toBeVisible();
    await report.screenshot({ path: testInfo.outputPath(`report-lean-${width}.png`) });
    if (width < 768) await report.getByRole("button", { name: "Khối mỡ", exact: true }).click();
    await expect(report.getByRole("heading", { name: "Phân bổ mỡ từng vùng", exact: true })).toBeVisible();
    await report.screenshot({ path: testInfo.outputPath(`report-fat-${width}.png`) });
    await report.getByLabel("Giá trị hiển thị").selectOption("%");
    await expect(report.getByText(/có thể trên 100%/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    store.deny = true;
    await page.reload();
    await expect(report.getByText("Bạn không còn quyền xem kết quả đo này.")).toBeVisible();
    await expect(report.getByText("28,5 kg", { exact: true })).toHaveCount(0);

    await page.goto(`/dashboard/today/${today}/journal`);
    await page.getByRole("tab", { name: /Nhật ký báo cáo tuần/ }).click();
    const group = page.getByRole("button", { name: /Số đo vòng/ });
    await group.click();
    await page.getByRole("spinbutton", { name: "Vòng eo (cm)", exact: true }).fill("80");
    await page.getByRole("spinbutton", { name: "Vòng hông (cm)", exact: true }).fill("100");
    await expect(page.locator("output")).toHaveText("0,8");
    await group.click();
    await expect(page.getByText("Vòng eo: 80 cm · Vòng hông: 100 cm", { exact: true })).toBeVisible();
    await group.click();
    await page.getByRole("spinbutton", { name: "Vòng hông (cm)", exact: true }).fill("29");
    await group.click();
    await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
    await expect(group).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("spinbutton", { name: "Vòng hông (cm)", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`weekly-invalid-${width}.png`) });
  });
}
