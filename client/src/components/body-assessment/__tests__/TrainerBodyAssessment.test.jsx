import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TrainerBodyAssessment } from "../TrainerBodyAssessment";
import { assessmentValues, assessmentFormSchema, assessmentActionCheck, missingMassFields } from "../bodyAssessment";
import { AssessmentFields } from "../AssessmentFields";

const mocks = vi.hoisted(() => ({ record: null, pending: false, mutation: null }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { _id: "actor" } }) }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { assessment: mocks.record }, isLoading: false, isError: false }),
  useQueryClient: () => ({ setQueryData: vi.fn(), invalidateQueries: vi.fn(), cancelQueries: vi.fn(), removeQueries: vi.fn() }),
  useMutation: (config) => { mocks.mutation = config; return { mutate: vi.fn(), isPending: mocks.pending }; },
  useIsMutating: () => mocks.pending ? 1 : 0,
}));
vi.mock("../../../services/bodyAssessment.service", () => ({
  bodyAssessmentKey: (actor, client, ...parts) => ["body-assessments", actor, client, ...parts],
  getBodyAssessment: vi.fn(), saveBodyAssessment: vi.fn(), publishBodyAssessment: vi.fn(),
}));
beforeEach(() => { mocks.record = null; mocks.pending = false; });
const html = () => renderToStaticMarkup(<TrainerBodyAssessment clientId="student" dateKey="2026-09-08" />);

describe("Trainer body assessment form contract", () => {
  it("counts blank raw form fields as missing while preserving zero", () => {
    const values = assessmentValues();
    values.segments.leftArm.leanKg = "0";
    expect(missingMassFields(values)).toHaveLength(9);
  });
  it("rejects impossible and future dates through the form resolver", () => {
    expect(assessmentFormSchema.safeParse({ ...assessmentValues(), measuredDateKey: "2999-01-01" }).success).toBe(false);
    expect(assessmentFormSchema.safeParse({ ...assessmentValues(), measuredDateKey: "2026-02-30" }).success).toBe(false);
  });
  it("renders first empty draft instead of crashing on null assessment", () => {
    expect(html()).toContain("Lưu nháp");
  });
  it("does not offer publish without an actual draft", () => {
    mocks.record = { revision: 2, draft: null, published: assessmentValues() };
    expect(html()).toMatch(/<button[^>]*disabled=""[^>]*>Gửi cho học viên<\/button>/);
  });
  it("locks period navigation while a command is pending", () => {
    mocks.pending = true;
    const rendered = html();
    expect(rendered).toMatch(/<input[^>]*type="month"[^>]*disabled=""/);
    expect(rendered).toMatch(/Kỳ theo dõi<select[^>]*disabled=""/);
  });
  it("opens the mobile panel containing a validation error", () => {
    const rendered = renderToStaticMarkup(<AssessmentFields register={(name) => ({ name })} setFocus={vi.fn()} errors={{ segments: { leftArm: { fatKg: { message: "Invalid" } } } }} disabled={false} />);
    expect(rendered).toMatch(/aria-pressed="true"[^>]*>Khối mỡ<\/button>/);
  });
  it("only requires a reason for saving corrections, not republishing an already saved correction", () => {
    const values = assessmentFormSchema.parse({ ...assessmentValues(), measuredDateKey: "2026-09-08", deviceLabel: "Test" });
    values.segments.leftArm.leanKg = 2;
    const assessment = { published: values, draft: values };
    expect(assessmentActionCheck({ action: "save", assessment, values })).toMatchObject({ field: "reason" });
    expect(assessmentActionCheck({ action: "publish", assessment, values, dirty: false, confirmPartial: true })).toEqual({ partial: false });
    expect(assessmentActionCheck({ action: "publish", assessment, values, dirty: true })).toMatchObject({ error: "Hãy lưu nháp các thay đổi trước khi gửi." });
  });
});
