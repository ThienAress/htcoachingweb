import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: {}, actor: { _id: "student-1" } }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: mocks.actor }) }));
vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => mocks.query,
  useQueryClient: () => ({ removeQueries: vi.fn() }),
}));
import { BodyAssessmentReport } from "../BodyAssessmentReport";
import { BodyAssessmentHistory } from "../BodyAssessmentHistory";

const record = (week, date, leanKg, deviceLabel = "InBody A") => ({
  weekStartDateKey: week,
  draft: { note: "PRIVATE DRAFT NEVER DISPLAY" },
  published: { measuredDateKey: date, deviceLabel, referenceBasis: "device-standard", segments: { trunk: { leanKg, fatKg: 12, leanReferencePercent: 110 } } },
});
const current = record("2026-09-07", "2026-09-08", 28.5);
const previous = record("2026-08-31", "2026-09-01", 28);
const renderReport = () => renderToStaticMarkup(<BodyAssessmentReport />);

beforeEach(() => {
  mocks.actor = { _id: "student-1" };
  mocks.query = { data: { pages: [{ items: [current, previous], pagination: { page: 1, limit: 20, total: 2 } }] }, isPending: false, isError: false, hasNextPage: false };
});

describe("BodyAssessmentReport published reader", () => {
  it("compares published measurements and never renders drafts", () => {
    const html = renderReport();
    expect(html).toContain("Phân bố thành phần cơ thể");
    expect(html).toContain("Phân bổ cơ nạc từng vùng");
    expect(html).toContain("Phân bổ mỡ từng vùng");
    expect(html).toContain("28,5 kg");
    expect(html).toContain("+0,5 kg");
    expect((html.match(/\+0,5 kg/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain("PRIVATE DRAFT");
  });
  it("shows a clear empty state for draft-only or no data", () => {
    mocks.query.data.pages[0].items = [{ draft: current.draft }];
    expect(renderReport()).toContain("Chưa có kết quả đo được gửi");
  });
  it("does not invent a comparison for a single measurement", () => {
    mocks.query.data.pages[0].items = [current];
    expect(renderReport()).toContain("Cần ít nhất hai lần đo để so sánh");
  });
  it("blocks stale measurements after access is denied", () => {
    mocks.query.isError = true;
    mocks.query.error = { response: { status: 403 } };
    const html = renderReport();
    expect(html).toContain("không còn quyền");
    expect(html).not.toContain("28,5 kg");
  });
  it("warns when the measurement device differs", () => {
    mocks.query.data.pages[0].items = [current, record("2026-08-31", "2026-09-01", 28, "Different")];
    expect(renderReport()).toContain("Khác thiết bị");
  });
  it("offers pagination rather than silently truncating date selection", () => {
    mocks.query.hasNextPage = true;
    expect(renderReport()).toContain("Tải thêm lần đo");
  });
  it("announces loading without rendering cached health values", () => {
    mocks.query.isPending = true;
    const html = renderReport();
    expect(html).toContain("Đang tải kết quả đo");
    expect(html).not.toContain("28,5 kg");
  });
  it("keeps a read failure explicit with retry and hides stale data", () => {
    mocks.query.isError = true;
    mocks.query.error = { response: { status: 500 } };
    const html = renderReport();
    expect(html).toContain("Thử lại");
    expect(html).not.toContain("28,5 kg");
  });
});

describe("BodyAssessmentHistory", () => {
  it("uses measurement dates, keeps missing points and never turns them into zero", () => {
    const html = renderToStaticMarkup(<BodyAssessmentHistory items={[current, record("2026-08-31", "2026-09-01", null), record("2026-08-24", "2026-08-25", 27)]} region="trunk" field="leanKg" unit="kg" referenceSnapshot={current.published} />);
    expect(html).toContain("2 điểm đo");
    expect(html).toMatch(/d="M[^"]+ M/);
    expect(html).not.toContain(">0 kg<");
  });
  it("shows same-device reference values above 100 without treating them as body-fat percent", () => {
    const html = renderToStaticMarkup(<BodyAssessmentHistory items={[current]} region="trunk" field="leanReferencePercent" unit="%" referenceSnapshot={current.published} />);
    expect(html).toContain("110 %");
    expect(html).toContain("Mới có một điểm đo phù hợp");
  });
  it("does not connect reference history across mismatched devices", () => {
    const html = renderToStaticMarkup(<BodyAssessmentHistory items={[record("2026-08-31", "2026-09-01", 28, "Different")]} region="trunk" field="leanReferencePercent" unit="%" referenceSnapshot={current.published} />);
    expect(html).toContain("Chưa có số đo phù hợp");
    expect(html).not.toContain("110 %");
  });
});
