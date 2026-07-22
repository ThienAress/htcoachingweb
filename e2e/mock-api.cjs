const http = require("node:http");

const PORT = 5100;
const getVietnamDateKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return values.year + "-" + values.month + "-" + values.day;
};
const addDays = (dateKey, amount) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return (
    date.getUTCFullYear() +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getUTCDate()).padStart(2, "0")
  );
};
const appDay = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
};
const todayKey = getVietnamDateKey();
const daysUntilNextMonday = ((0 - appDay(todayKey) + 7) % 7) || 7;
const TRAINING_DATE_KEY = addDays(todayKey, daysUntilNextMonday);
const ACTORS = {
  admin: {
    _id: "000000000000000000000001",
    id: "000000000000000000000001",
    name: "E2E Admin",
    email: "admin.e2e@example.test",
    role: "admin",
  },
  trainer: {
    _id: "000000000000000000000002",
    id: "000000000000000000000002",
    name: "E2E Trainer",
    email: "trainer.e2e@example.test",
    role: "trainer",
  },
  user: {
    _id: "000000000000000000000003",
    id: "000000000000000000000003",
    name: "E2E Client",
    email: "client.e2e@example.test",
    role: "user",
  },
};
const F1_CUSTOMER_ID = "100000000000000000000001";
const F1_INTAKE_ID = "100000000000000000000002";
const F1_ASSESSMENT_ID = "100000000000000000000003";
const F1_REPORT_ID = "100000000000000000000004";
let f1Created = false;
let f1Status = "new";
let f1Intake = null;
let f1Assessment = null;
let f1Report = null;
const currentF1Customer = () => ({
  _id: F1_CUSTOMER_ID,
  code: "F1-E2E-001",
  fullName: "Nguyen Minh Khang",
  age: 30,
  gender: "male",
  occupation: "Engineer",
  phone: "0912345678",
  email: "phase9.f1@gmail.com",
  assignedTrainerId: ACTORS.trainer._id,
  status: f1Status,
  readinessStatus: f1Intake ? "ready" : "pending",
  testPermission: f1Intake ? "full_test" : "",
  lastIntakeId: f1Intake?._id || null,
  lastAssessmentId: f1Assessment?._id || null,
  lastAiReportId: f1Report?._id || null,
});

const sendJson = (res, body, status = 200) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "X-CSRF-Token": "e2e-csrf-token",
  });
  res.end(JSON.stringify(body));
};

const handleApi = (req, res, path) => {
  const role = req.headers["x-e2e-role"];
  const actor = ACTORS[role] || null;
  if (!["GET", "HEAD"].includes(req.method)) req.resume();

  if (path === "/api/user/me") {
    return actor
      ? sendJson(res, actor)
      : sendJson(res, null);
  }
  if (path === "/api/trainer-subscriptions/my") {
    return req.headers["x-e2e-trainer-access"] === "true"
      ? sendJson(res, {
          success: true,
          data: { _id: "subscription-e2e", status: "active" },
        })
      : sendJson(res, { success: false, message: "No subscription" }, 404);
  }
  if (path === "/api/site-settings") {
    return sendJson(res, { success: true, data: {} });
  }
  if (path === "/api/f1-customers/dashboard/summary") {
    return sendJson(res, {
      success: true,
      data: { total: f1Created ? 1 : 0 },
    });
  }
  if (path === "/api/f1-customers" && req.method === "GET") {
    return sendJson(res, {
      success: true,
      data: f1Created ? [currentF1Customer()] : [],
      pagination: {
        page: 1,
        limit: 10,
        total: f1Created ? 1 : 0,
        totalPages: 1,
      },
    });
  }
  if (path === "/api/f1-customers" && req.method === "POST") {
    f1Created = true;
    f1Status = "new";
    f1Intake = null;
    f1Assessment = null;
    f1Report = null;
    return sendJson(
      res,
      { success: true, data: currentF1Customer() },
      201,
    );
  }
  if (
    path ===
      "/api/f1-customers/" + F1_CUSTOMER_ID + "/intake/latest" &&
    req.method === "GET"
  ) {
    return sendJson(res, { success: true, data: f1Intake });
  }
  if (
    path ===
      "/api/f1-customers/" + F1_CUSTOMER_ID + "/intake/submit" &&
    req.method === "POST"
  ) {
    f1Status = "intake_completed";
    f1Intake = {
      _id: F1_INTAKE_ID,
      customerId: F1_CUSTOMER_ID,
      isDraft: false,
      bodyMetrics: { restingHeartRate: 68 },
      systemFlags: {
        testPermission: "full_test",
        readinessStatus: "ready",
        holdReasons: [],
        cautionReasons: [],
      },
      consent: {
        allowDataStorage: true,
        allowMediaStorage: true,
        allowAiAnalysis: true,
        version: "2026-07",
      },
    };
    return sendJson(res, { success: true, data: f1Intake });
  }
  if (
    path === "/api/f1-customers/" + F1_CUSTOMER_ID + "/media" &&
    req.method === "POST"
  ) {
    req.on("end", () => {
      sendJson(
        res,
        {
          success: true,
          data: {
            _id: "100000000000000000000010",
            customerId: F1_CUSTOMER_ID,
            intakeId: F1_INTAKE_ID,
            type: "posture_front",
            status: "ready",
            contentPath:
              "/api/f1-customers/" +
              F1_CUSTOMER_ID +
              "/media/100000000000000000000010/content",
          },
        },
        201,
      );
    });
    return;
  }
  if (
    path === "/api/f1-customers/" + F1_CUSTOMER_ID + "/media" &&
    req.method === "GET"
  ) {
    return sendJson(res, { success: true, data: [] });
  }
  if (
    path ===
      "/api/f1-customers/" +
        F1_CUSTOMER_ID +
        "/assessment-starter-suggestions" &&
    req.method === "GET"
  ) {
    return sendJson(res, {
      success: true,
      data: { sections: { strength: [], endurance: [], cardio: [] } },
    });
  }
  if (
    path ===
      "/api/f1-customers/" + F1_CUSTOMER_ID + "/assessments/latest" &&
    req.method === "GET"
  ) {
    return sendJson(res, { success: true, data: f1Assessment });
  }
  if (
    path ===
      "/api/f1-customers/" + F1_CUSTOMER_ID + "/assessments" &&
    req.method === "POST"
  ) {
    f1Status = "assessment_completed";
    f1Assessment = {
      _id: F1_ASSESSMENT_ID,
      customerId: F1_CUSTOMER_ID,
      intakeId: F1_INTAKE_ID,
      overallPhysicalLevel: "average",
    };
    return sendJson(res, { success: true, data: f1Assessment }, 201);
  }
  if (
    path ===
      "/api/f1-customers/" + F1_CUSTOMER_ID + "/ai-reports/latest" &&
    req.method === "GET"
  ) {
    return sendJson(res, { success: true, data: f1Report });
  }
  if (
    path ===
      "/api/f1-customers/" +
        F1_CUSTOMER_ID +
        "/ai-reports/generate" &&
    req.method === "POST"
  ) {
    f1Status = "ai_report_generated";
    f1Report = {
      _id: F1_REPORT_ID,
      customerId: F1_CUSTOMER_ID,
      intakeId: F1_INTAKE_ID,
      assessmentId: F1_ASSESSMENT_ID,
      engineVersion: "e2e-provider-mock",
      version: 1,
      status: "draft",
      inputSummary: {},
      safetyDecision: { status: "ready", reasons: [] },
      phaseRecommendation: {
        startPhase: "phase_1",
        rationale: ["E2E deterministic rationale"],
      },
      executiveSummary: "E2E deterministic F1 report",
      priorityFindings: [],
      trainingFocus: [],
      precautions: [],
      coachNotes: [],
    };
    return sendJson(res, { success: true, data: f1Report }, 201);
  }
  if (path === "/api/training-booking/my-trainer") {
    return sendJson(res, {
      success: true,
      data: { _id: ACTORS.trainer._id, name: ACTORS.trainer.name },
    });
  }
  if (path === "/api/training-booking/my-booking") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: "schedule-client-e2e",
          trainerId: { _id: ACTORS.trainer._id, name: ACTORS.trainer.name },
          clientId: ACTORS.user._id,
          clientName: ACTORS.user.name,
          occurrenceDateKey: TRAINING_DATE_KEY,
          dayOfWeek: 0,
          startTime: "09:00",
          endTime: "10:00",
          startAt: TRAINING_DATE_KEY + "T02:00:00.000Z",
          endAt: TRAINING_DATE_KEY + "T03:00:00.000Z",
          exerciseType: "Tự do (Khách đăng ký)",
          notes: "E2E concrete occurrence",
          revision: 0,
          status: "scheduled",
        },
      ],
    });
  }
  if (path === "/api/training-booking/busy-times") {
    return sendJson(res, { success: true, data: [] });
  }
  if (
    path === "/api/training-booking/book" &&
    req.method === "POST"
  ) {
    return sendJson(
      res,
      {
        success: true,
        data: { _id: "schedule-created-e2e", revision: 0 },
      },
      201,
    );
  }
  if (
    path.startsWith("/api/training-booking/book/") &&
    ["PUT", "DELETE"].includes(req.method)
  ) {
    return sendJson(res, {
      success: true,
      data: { _id: "schedule-client-e2e", revision: 1 },
    });
  }
  if (path === "/api/training-schedules/my-clients") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: ACTORS.user._id,
          name: ACTORS.user.name,
          email: ACTORS.user.email,
        },
      ],
    });
  }
  if (
    path === "/api/training-schedules" &&
    req.method === "GET"
  ) {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: "schedule-trainer-e2e",
          trainerId: ACTORS.trainer._id,
          clientId: { _id: ACTORS.user._id, name: ACTORS.user.name },
          clientName: ACTORS.user.name,
          occurrenceDateKey: TRAINING_DATE_KEY,
          dayOfWeek: 0,
          startTime: "09:00",
          endTime: "10:00",
          exerciseType: "Gym",
          notes: "E2E trainer calendar",
          color: "#3b82f6",
          revision: 0,
          status: "scheduled",
        },
      ],
    });
  }
  if (
    path === "/api/training-schedules" &&
    ["POST", "DELETE"].includes(req.method)
  ) {
    return sendJson(res, {
      success: true,
      data: { _id: "schedule-created-e2e", revision: 0 },
    });
  }
  if (
    path.startsWith("/api/training-schedules/") &&
    ["PUT", "PATCH", "DELETE"].includes(req.method)
  ) {
    return sendJson(res, {
      success: true,
      data: { _id: "schedule-trainer-e2e", revision: 1 },
    });
  }
  if (path === "/api/bookings" && req.method === "GET") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: "lead-booking-e2e",
          name: "E2E Lead Client",
          phone: "0912345678",
          email: "lead.e2e@gmail.com",
          package: "PT 10",
          sessions: 10,
          gym: "Waystation",
          schedule: "Monday 09:00",
          status: "pending",
          revision: 0,
          gifts: [],
          createdAt: "2026-07-19T00:00:00.000Z",
        },
      ],
      pagination: { total: 1, page: 1, limit: 9, totalPages: 1 },
    });
  }
  if (
    path === "/api/bookings/lead-booking-e2e/status" &&
    req.method === "PATCH"
  ) {
    return sendJson(res, {
      success: true,
      data: { _id: "lead-booking-e2e", status: "contacted", revision: 1 },
    });
  }
  if (
    path === "/api/bookings/lead-booking-e2e/archive" &&
    req.method === "PATCH"
  ) {
    return sendJson(res, {
      success: true,
      data: { _id: "lead-booking-e2e", isArchived: true, revision: 1 },
    });
  }
  if (path === "/api/orders/checkin-options") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: "order-e2e",
          name: "E2E Client",
          email: "client.e2e@example.test",
          package: "PT 10",
          sessions: 8,
          totalSessions: 10,
        },
      ],
    });
  }
  if (path === "/api/checkin" && req.method === "GET") {
    return sendJson(res, {
      success: true,
      data: [],
      pagination: { total: 0, page: 1, limit: 5, totalPages: 1 },
    });
  }
  if (path === "/api/checkin" && req.method === "POST") {
    return sendJson(res, {
      success: true,
      data: { _id: "checkin-e2e", remainingSessions: 7 },
    });
  }
  if (path === "/api/coaching/my-plans") {
    return sendJson(res, {
      success: true,
      data: [
        {
          dateString: "2026-07-19",
          date: "2026-07-19T00:00:00.000Z",
          title: "E2E Strength Day",
          clientStatus: "pending",
          exercises: [{ _id: "exercise-e2e", name: "Squat", completed: false }],
          trainerId: { name: "E2E Trainer" },
        },
      ],
    });
  }
  if (path === "/api/coaching/my-plans/2026-07-19") {
    return sendJson(res, {
      success: true,
      data: {
        _id: "plan-e2e",
        dateString: "2026-07-19",
        date: "2026-07-19T00:00:00.000Z",
        title: "E2E Strength Day",
        clientStatus: "pending",
        clientFeedbackText: "",
        trainerId: { name: "E2E Trainer" },
        exercises: [
          {
            _id: "exercise-e2e",
            name: "Squat",
            sets: 4,
            reps: "10",
            completed: false,
            clientFeedbackNote: "",
          },
        ],
      },
    });
  }
  if (path === "/api/coaching/trainer/clients") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: ACTORS.user.id,
          name: ACTORS.user.name,
          email: ACTORS.user.email,
          package: "PT 10",
        },
      ],
    });
  }
  if (path.startsWith("/api/coaching/trainer/clients/")) {
    return sendJson(res, { success: true, data: [] });
  }
  if (path === "/api/knowledge-base/stats") {
    return sendJson(res, {
      success: true,
      data: { total: 1, topUsed: [], byCategory: [] },
    });
  }
  if (path === "/api/knowledge-base/categories") {
    return sendJson(res, {
      success: true,
      data: [{ value: "general", label: "Chung" }],
    });
  }
  if (path === "/api/knowledge-base") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: "kb-e2e",
          question: "E2E verified question",
          answer: "E2E verified answer",
          category: "general",
          status: "draft",
          embeddingStatus: "failed",
          usageCount: 1,
          variantCount: 0,
        },
      ],
      pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
    });
  }
  if (path === "/api/recipes/admin/list") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: "recipe-e2e",
          name: "E2E Protein Bowl",
          slug: "e2e-protein-bowl",
          source: "manual",
          isPublished: false,
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  }
  if (path === "/api/blog/admin") {
    return sendJson(res, {
      success: true,
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });
  }
  if (path === "/api/contracts") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: "contract-e2e",
          status: "draft",
          clientInfo: { name: "E2E Client", email: ACTORS.user.email },
          trainerInfo: { name: "E2E Trainer" },
          packageDetails: { packageName: "PT 10" },
          createdAt: "2026-07-19T00:00:00.000Z",
        },
      ],
    });
  }
  if (path === "/api/admin/deposits") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: "deposit-e2e",
          amount: 500000,
          depositCode: "HTC-E2E-0001",
          status: "pending",
          userId: { name: "E2E Client", email: ACTORS.user.email },
          createdAt: "2026-07-19T00:00:00.000Z",
        },
        {
          _id: "deposit-paid-e2e",
          amount: 250000,
          depositCode: "HTC-E2E-PAID",
          status: "success",
          userId: { name: "E2E Paid Client", email: "paid.e2e@example.test" },
          createdAt: "2026-07-19T01:00:00.000Z",
          paidAt: "2026-07-19T01:05:00.000Z",
          approvedBy: { name: "E2E Admin" },
        },
      ],
    });
  }
  if (
    path === "/api/admin/deposits/deposit-paid-e2e/reverse" &&
    req.method === "POST"
  ) {
    return sendJson(res, {
      success: true,
      message: "Đã hoàn tác giao dịch nạp tiền",
    });
  }
  if (path === "/api/trainer-subscriptions/all") {
    return sendJson(res, {
      success: true,
      data: [
        {
          _id: "subscription-admin-e2e",
          planTitle: "Tiêu chuẩn",
          endDate: "2026-12-31T00:00:00.000Z",
          userId: {
            name: "E2E Subscriber",
            email: "subscriber.e2e@example.test",
          },
        },
      ],
      pagination: { total: 1, totalPages: 1, currentPage: 1 },
    });
  }
  if (
    path ===
      "/api/trainer-subscriptions/subscription-admin-e2e/cancel" &&
    req.method === "POST"
  ) {
    return sendJson(res, {
      success: true,
      message: "Đã hủy gói và giữ nguyên ledger",
    });
  }
  if (path === "/api/me/wallet") {
    return sendJson(res, { success: true, data: { balance: 500000 } });
  }
  if (path === "/api/ai/conversations" || path === "/api/ai/history") {
    return sendJson(res, { success: true, data: [] });
  }
  if (
    path === "/api/ai/conversations/conversation-e2e" &&
    req.method === "GET"
  ) {
    return sendJson(res, {
      success: true,
      data: {
        conversationId: "conversation-e2e",
        title: "E2E conversation",
        messages: [
          {
            _id: "message-user-e2e",
            role: "user",
            content: "Tạo một buổi tập an toàn",
          },
          {
            _id: "message-assistant-e2e",
            role: "assistant",
            content: "Phản hồi AI deterministic",
          },
        ],
        context: {},
      },
    });
  }
  if (path === "/api/ai/chat" && req.method === "POST") {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.end(
      [
        'data: {"type":"conversation","conversationId":"conversation-e2e"}',
        "",
        'data: {"type":"text","content":"Phản hồi AI deterministic"}',
        "",
        'data: {"type":"done","conversationId":"conversation-e2e"}',
        "",
      ].join("\n"),
    );
    return;
  }
  if (path === "/api/recipes/categories" || path === "/api/recipes/areas") {
    return sendJson(res, { success: true, data: [] });
  }

  return req.method === "GET"
    ? sendJson(res, {
        success: true,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      })
    : sendJson(res, { success: true, data: {} });
};

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-CSRF-Token, X-E2E-Role, X-E2E-Trainer-Access, X-Request-Id",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "X-CSRF-Token");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const path = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
  if (path === "/health") return sendJson(res, { success: true });
  if (path.startsWith("/api/")) return handleApi(req, res, path);
  return sendJson(res, { success: false, message: "Not found" }, 404);
});

server.listen(PORT, "127.0.0.1");
const close = () => server.close(() => process.exit(0));
process.on("SIGTERM", close);
process.on("SIGINT", close);
