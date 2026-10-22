import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import FitnessSelfAssessment from "../../models/FitnessSelfAssessment.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import Order from "../../models/Order.js";
import fitnessSelfAssessmentRoutes from "../fitnessSelfAssessment.routes.js";
import todayDashboardRoutes from "../todayDashboard.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/fitness-self-assessments", fitnessSelfAssessmentRoutes);
  app.use("/api/today-dashboard", todayDashboardRoutes);
  await FitnessSelfAssessment.init();
});

afterEach(async () => {
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

const makeMember = async (email, { active = true } = {}) => {
  const member = await createTestUser({ email });
  await FitnessSubscription.create({
    userId: member.user._id,
    planCode: "fitness_plus_essential",
    planTitle: "Nền tảng",
    billingCycle: "month",
    amount: 99000,
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + (active ? 86_400_000 : -30_000)),
    status: active ? "active" : "expired",
    isActive: active,
  });
  return member;
};

const put = (token, body) => withAuth(request(app).put("/api/fitness-self-assessments/me/draft"), token).send(body);
const submit = (token, id) => withAuth(request(app).post(`/api/fitness-self-assessments/${id}/submit`), token).send({});
const readMe = (token) => withAuth(request(app).get("/api/fitness-self-assessments/me"), token);

const screeningStep = { step: 1, consent: { allowDataStorage: true }, screening: { painLevel: 0 } };
const profileStep = {
  step: 2,
  profile: { age: 30, gender: "male", heightCm: 175, weightKg: 80, restingHeartRate: 60, sleepHours: 8 },
  training: { currentlyTraining: true, trainingExperience: "intermediate", trainingDaysPerWeek: 4, primaryGoal: "muscle_gain" },
};
const testsStep = {
  step: 3,
  tests: {
    upperBodyPush: { variant: "standard", reps: 36 },
    coreEndurance: { variant: "full", seconds: 100 },
    cardio: { variant: "standard", minutes: 14, endHeartRate: 130 },
  },
};

describe("Đánh giá bản thân HT Fitness+: luồng chính", () => {
  it("yêu cầu đăng nhập", async () => {
    const response = await request(app).get("/api/fitness-self-assessments/me");
    expect(response.status).toBe(401);
  });

  it("lưu nháp từng bước, nộp bài và đọc kết quả có gợi ý", async () => {
    const member = await makeMember("self-assess-flow@example.com");
    const token = member.accessToken;

    const first = await put(token, screeningStep);
    expect(first.status).toBe(200);
    expect(first.body.data.systemFlags.testPermission).toBe("full_test");
    expect((await put(token, profileStep)).status).toBe(200);
    const withTests = await put(token, testsStep);
    expect(withTests.status).toBe(200);
    expect(withTests.body.data.draftStep).toBe(3);
    expect(withTests.body.data.result).toBeNull();

    const done = await submit(token, withTests.body.data.id);
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe("completed");
    const { scoring, recommendation } = done.body.data.result;
    expect(scoring.metrics.upperBodyPush.level).toBe("excellent");
    expect(scoring.metrics.cardio.vo2max).toBe(47.9);
    // Kinh nghiệm trung bình: dù kết quả tốt vẫn bắt đầu ở giai đoạn 2, chỉ người tập lâu năm mới vào giai đoạn 3.
    expect(recommendation.startPhase.code).toBe("phase_2");
    expect(recommendation.libraryPath).toBe("/exercises");

    const state = await readMe(token);
    expect(state.body.data.canWrite).toBe(true);
    expect(state.body.data.draft).toBeNull();
    expect(state.body.data.latestCompleted.id).toBe(done.body.data.id);
    expect(state.body.data.retest.recommendedAfterDays).toBe(28);
    expect(state.body.data.retest.isEarly).toBe(true);
    expect(state.headers["cache-control"]).toContain("no-store");
  });

  it("cho làm lại sớm: tạo bản nháp mới, điền sẵn hồ sơ nhưng không điền sẵn bài test", async () => {
    const member = await makeMember("self-assess-retest@example.com");
    const token = member.accessToken;
    await put(token, screeningStep);
    await put(token, profileStep);
    const tests = await put(token, testsStep);
    await submit(token, tests.body.data.id);

    const again = await put(token, { step: 1, screening: { painLevel: 2 } });
    expect(again.status).toBe(200);
    expect(again.body.data.status).toBe("draft");
    expect(again.body.data.profile.age).toBe(30);
    expect(again.body.data.tests.upperBodyPush.reps).toBeNull();
    expect(again.body.data.id).not.toBe(tests.body.data.id);
  });

  it("hold_test: không nhận bài test nhưng vẫn nộp được và nhận khuyến nghị an toàn", async () => {
    const member = await makeMember("self-assess-hold@example.com");
    const token = member.accessToken;
    await put(token, { ...screeningStep, screening: { warningSigns: ["chest_pain"] } });
    const profile = await put(token, profileStep);
    expect(profile.body.data.systemFlags.testPermission).toBe("hold_test");

    const blocked = await put(token, testsStep);
    expect(blocked.status).toBe(422);
    expect(blocked.body.code).toBe("SELF_ASSESSMENT_TEST_BLOCKED");

    const done = await submit(token, profile.body.data.id);
    expect(done.status).toBe(200);
    expect(done.body.data.result.recommendation.mode).toBe("hold");
  });

  it("modified_test: chỉ nhận biến thể giảm tải", async () => {
    const member = await makeMember("self-assess-modified@example.com");
    const token = member.accessToken;
    await put(token, { ...screeningStep, screening: { painLevel: 6 } });
    await put(token, profileStep);
    const rejected = await put(token, { step: 3, tests: { upperBodyPush: { variant: "standard", reps: 20 } } });
    expect(rejected.status).toBe(422);
    const accepted = await put(token, { step: 3, tests: { upperBodyPush: { variant: "knee", reps: 20 } } });
    expect(accepted.status).toBe(200);
  });

  it("không thể bỏ qua phần sàng lọc bằng cách gọi API trực tiếp", async () => {
    const member = await makeMember("self-assess-skip-screening@example.com");
    const token = member.accessToken;
    await put(token, { step: 1, consent: { allowDataStorage: true } });
    await put(token, profileStep);
    const tests = await put(token, testsStep);
    const response = await submit(token, tests.body.data.id);
    expect(response.status).toBe(422);
    expect(response.body.code).toBe("SELF_ASSESSMENT_INCOMPLETE");
  });

  it("modified_test: giá trị không kèm biến thể bị từ chối", async () => {
    const member = await makeMember("self-assess-no-variant@example.com");
    const token = member.accessToken;
    await put(token, { ...screeningStep, screening: { painLevel: 6 } });
    await put(token, profileStep);
    const response = await put(token, { step: 3, tests: { upperBodyPush: { reps: 20 } } });
    expect(response.status).toBe(422);
    expect(response.body.code).toBe("SELF_ASSESSMENT_TEST_BLOCKED");
  });

  it("lưu nháp chạy xen nộp bài không ghi đè bản đã hoàn tất", async () => {
    const member = await makeMember("self-assess-race@example.com");
    await put(member.accessToken, screeningStep);
    const stale = await FitnessSelfAssessment.findOne({ userId: member.user._id });
    const fresh = await FitnessSelfAssessment.findOne({ userId: member.user._id });
    fresh.status = "completed";
    await fresh.save();
    stale.set("screening.injuries", "ghi đè muộn");
    await expect(stale.save()).rejects.toThrow();
    const stored = await FitnessSelfAssessment.findById(fresh._id).lean();
    expect(stored.status).toBe("completed");
    expect(stored.screening.injuries).toBe("");
  });

  it("đổi sàng lọc sang hold thì bài test đã nhập bị gỡ", async () => {
    const member = await makeMember("self-assess-reflag@example.com");
    const token = member.accessToken;
    await put(token, screeningStep);
    await put(token, profileStep);
    await put(token, testsStep);
    const changed = await put(token, { step: 1, screening: { warningSigns: ["dizziness"] } });
    expect(changed.body.data.systemFlags.testPermission).toBe("hold_test");
    expect(changed.body.data.tests.upperBodyPush.reps).toBeNull();
  });

  it("nộp thiếu thông tin thì bị từ chối bằng mã ổn định", async () => {
    const member = await makeMember("self-assess-incomplete@example.com");
    const token = member.accessToken;
    const draft = await put(token, screeningStep);
    const response = await submit(token, draft.body.data.id);
    expect(response.status).toBe(422);
    expect(response.body.code).toBe("SELF_ASSESSMENT_INCOMPLETE");
  });
});

describe("Đánh giá bản thân HT Fitness+: quyền và dữ liệu", () => {
  it("chặn ghi với user thường, HLV, admin và khách coaching", async () => {
    const plain = await createTestUser({ email: "self-assess-plain@example.com" });
    const trainer = await createTestUser({ email: "self-assess-trainer@example.com", role: "trainer" });
    const admin = await createTestUser({ email: "self-assess-admin@example.com", role: "admin" });
    const coaching = await createTestUser({ email: "self-assess-coaching@example.com" });
    await Order.create({
      userId: coaching.user._id,
      trainerId: trainer.user._id,
      name: "Coaching Client",
      email: "self-assess-coaching@example.com",
      package: "PT 10",
      sessions: 5,
      totalSessions: 10,
      status: "approved",
    });

    for (const actor of [plain, trainer, admin, coaching]) {
      const response = await put(actor.accessToken, screeningStep);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("SELF_ASSESSMENT_ENTITLEMENT_REQUIRED");
      expect(response.body.message).toContain("HT Fitness+");
    }
    expect(await FitnessSelfAssessment.countDocuments()).toBe(0);
  });

  it("gói hết hạn: xem lại được bản cũ nhưng mọi thao tác ghi bị chặn", async () => {
    const member = await makeMember("self-assess-expired@example.com", { active: false });
    const completed = await FitnessSelfAssessment.create({
      userId: member.user._id,
      status: "completed",
      draftStep: 4,
      completedAt: new Date(),
      nextEligibleAt: new Date(Date.now() + 86_400_000),
      result: { version: "test", scoring: { overallLevel: "good" }, recommendation: { mode: "plan" } },
    });
    const draft = await FitnessSelfAssessment.create({ userId: member.user._id });

    const state = await readMe(member.accessToken);
    expect(state.status).toBe(200);
    expect(state.body.data.canWrite).toBe(false);
    expect(state.body.data.latestCompleted.id).toBe(String(completed._id));

    const list = await withAuth(request(app).get("/api/fitness-self-assessments?limit=5"), member.accessToken);
    expect(list.body.data.items).toHaveLength(1);

    expect((await put(member.accessToken, screeningStep)).status).toBe(403);
    expect((await submit(member.accessToken, draft._id)).status).toBe(403);
  });

  it("không đọc hoặc nộp bản của người khác", async () => {
    const owner = await makeMember("self-assess-owner@example.com");
    const other = await makeMember("self-assess-other@example.com");
    await put(owner.accessToken, screeningStep);
    const ownerDraft = await FitnessSelfAssessment.findOne({ userId: owner.user._id });

    const otherState = await readMe(other.accessToken);
    expect(otherState.body.data.draft).toBeNull();
    expect(otherState.body.data.latestCompleted).toBeNull();
    const stolen = await submit(other.accessToken, ownerDraft._id);
    expect(stolen.status).toBe(404);
    expect(JSON.stringify(otherState.body)).not.toContain(String(owner.user._id));
  });

  it("không nhận cờ an toàn, trạng thái, userId hoặc khóa lạ từ client", async () => {
    const member = await makeMember("self-assess-allowlist@example.com");
    const token = member.accessToken;
    for (const body of [
      { systemFlags: { testPermission: "full_test" } },
      { status: "completed" },
      { userId: String(member.user._id) },
      { result: {} },
      { screening: { reviewDecision: "approve_full_test" } },
      { tests: { upperBodyPush: { reps: 5, score: 100 } } },
      { tests: { constructor: { reps: 1 } } },
    ]) {
      const response = await put(token, { ...screeningStep, ...body });
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(response.body.code).toBe("SELF_ASSESSMENT_INVALID_INPUT");
    }
    expect(await FitnessSelfAssessment.countDocuments()).toBe(0);
  });

  it("từ chối giá trị vô lý và yêu cầu đồng ý lưu dữ liệu", async () => {
    const member = await makeMember("self-assess-validate@example.com");
    const token = member.accessToken;
    const bad = await put(token, { ...screeningStep, profile: { age: 5 } });
    expect(bad.status).toBe(400);
    const noConsent = await put(token, { step: 2, profile: { age: 30 } });
    expect(noConsent.status).toBe(400);
    expect(noConsent.body.code).toBe("SELF_ASSESSMENT_CONSENT_REQUIRED");
  });

  it("không có đường tải ảnh hoặc file", async () => {
    const member = await makeMember("self-assess-upload@example.com");
    const response = await withAuth(
      request(app).post("/api/fitness-self-assessments/me/photos"),
      member.accessToken,
    ).send({});
    expect(response.status).toBe(404);
  });
});

describe("cờ lịch sử trong prompt-eligibility", () => {
  it("báo người đã từng làm đánh giá, kể cả khi gói đã hết hạn", async () => {
    const member = await makeMember("self-assess-flag@example.com", { active: false });
    const before = await withAuth(request(app).get("/api/today-dashboard/prompt-eligibility"), member.accessToken);
    expect(before.body.data.hasSelfAssessmentHistory).toBe(false);
    expect(before.body.data.accessMode).toBe("blocked");

    await FitnessSelfAssessment.create({ userId: member.user._id, status: "completed", completedAt: new Date() });
    const after = await withAuth(request(app).get("/api/today-dashboard/prompt-eligibility"), member.accessToken);
    expect(after.body.data.hasSelfAssessmentHistory).toBe(true);
  });
});
