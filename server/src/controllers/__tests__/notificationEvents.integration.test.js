import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";
import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { errorHandler } from "../../middlewares/errorHandler.js";
import Order from "../../models/Order.js";
import coachingCommentRoutes from "../../routes/coachingComment.routes.js";
import dailyJournalRoutes from "../../routes/dailyJournal.routes.js";
import notificationRoutes from "../../routes/notification.routes.js";
import weeklyCheckinRoutes from "../../routes/weeklyCheckin.routes.js";
import {
  addDaysToDateKey,
  getAppDayOfWeek,
  getMonthWeekPeriod,
  getVietnamDateKey,
} from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const currentWeek = getMonthWeekPeriod(today).startDateKey;

const createAssigned = async () => {
  const trainer = await createTestUser({
    email: "notification-events-trainer@example.com",
    role: "trainer",
  });
  const client = await createTestUser({
    email: "notification-events-client@example.com",
  });
  await Order.create({
    userId: client.user._id,
    trainerId: trainer.user._id,
    name: "Tên cũ trong đơn hàng",
    email: client.user.email,
    package: "PT",
    sessions: 5,
    totalSessions: 5,
    status: "approved",
  });
  return { client, trainer };
};

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/daily-journals", dailyJournalRoutes);
  app.use("/api/weekly-checkins", weeklyCheckinRoutes);
  app.use("/api/coaching-comments", coachingCommentRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use(errorHandler);
});
beforeEach(() => {
  process.env.TODAY_JOURNAL_WRITES_ENABLED = "true";
  process.env.TODAY_WEEKLY_CHECKIN_WRITES_ENABLED = "true";
  process.env.TODAY_COMMENT_WRITES_ENABLED = "true";
});
afterEach(async () => {
  delete process.env.TODAY_JOURNAL_WRITES_ENABLED;
  delete process.env.TODAY_WEEKLY_CHECKIN_WRITES_ENABLED;
  delete process.env.TODAY_COMMENT_WRITES_ENABLED;
  await clearCollections();
});
afterAll(teardownTestDB);

describe("Notification domain events", () => {
  it("emits contextual deduplicated journal/comment/weekly notifications to the other party", async () => {
    const data = await createAssigned();
    const savedJournal = await withAuth(
      request(app)
        .put("/api/daily-journals/" + today)
        .send({
          expectedRevision: 0,
          requestId: "91111111-2222-4222-8222-111111111111",
          patch: { wellness: { energy: 8 } },
        }),
      data.client.accessToken,
    );
    const submitPayload = {
      expectedRevision: 1,
      requestId: "92222222-2222-4222-8222-222222222222",
    };
    const submittedJournal = await withAuth(
      request(app)
        .post("/api/daily-journals/" + today + "/submit")
        .send(submitPayload),
      data.client.accessToken,
    );
    const replayJournal = await withAuth(
      request(app)
        .post("/api/daily-journals/" + today + "/submit")
        .send(submitPayload),
      data.client.accessToken,
    );
    const correctedJournal = await withAuth(
      request(app)
        .post("/api/daily-journals/" + today + "/corrections")
        .send({
          expectedRevision: 2,
          requestId: "92333333-2222-4222-8222-222222222222",
          patch: { wellness: { energy: 7 } },
        }),
      data.client.accessToken,
    );
    const comment = await withAuth(
      request(app).post("/api/coaching-comments").send({
        targetType: "daily_journal",
        targetId: savedJournal.body.data._id,
        requestId: "93333333-2222-4222-8222-333333333333",
        body: "Em đã hoàn thành",
      }),
      data.client.accessToken,
    );
    const weeklySaved = await withAuth(
      request(app)
        .put("/api/weekly-checkins/" + currentWeek)
        .send({
          expectedRevision: 0,
          requestId: "94444444-2222-4222-8222-444444444444",
          patch: { body: { energy: 8 } },
        }),
      data.client.accessToken,
    );
    const weeklySubmitted = await withAuth(
      request(app)
        .post("/api/weekly-checkins/" + currentWeek + "/submit")
        .send({
          expectedRevision: weeklySaved.body.data.revision,
          requestId: "95555555-2222-4222-8222-555555555555",
        }),
      data.client.accessToken,
    );
    const reviewed = await withAuth(
      request(app)
        .post(
          "/api/weekly-checkins/trainer/clients/" +
            data.client.user._id +
            "/" +
            currentWeek +
            "/review",
        )
        .send({
          expectedRevision: weeklySubmitted.body.data.revision,
          requestId: "96666666-2222-4222-8222-666666666666",
          review: { message: "Tiếp tục duy trì" },
        }),
      data.trainer.accessToken,
    );
    const corrected = await withAuth(
      request(app)
        .post(
          "/api/weekly-checkins/" +
            currentWeek +
            "/corrections",
        )
        .send({
          expectedRevision: reviewed.body.data.revision,
          requestId: "97777777-2222-4222-8222-777777777777",
          reason: "Cập nhật sau review",
          patch: { body: { energy: 7 } },
        }),
      data.client.accessToken,
    );
    const trainerInbox = await withAuth(
      request(app).get("/api/notifications?status=unread"),
      data.trainer.accessToken,
    );
    const clientInbox = await withAuth(
      request(app).get("/api/notifications?status=unread"),
      data.client.accessToken,
    );
    const trainerNotifications = trainerInbox.body.data.items;
    const clientNotifications = clientInbox.body.data.items;

    expect(submittedJournal.status).toBe(200);
    expect(replayJournal.body.idempotentReplay).toBe(true);
    expect(correctedJournal.status).toBe(200);
    expect(comment.status).toBe(201);
    expect(reviewed.status).toBe(200);
    expect(corrected.status).toBe(200);
    expect(
      trainerNotifications.map((item) => item.type).sort(),
    ).toEqual([
      "coaching_comment_created",
      "journal_corrected",
      "journal_submitted",
      "weekly_corrected",
      "weekly_submitted",
    ]);
    expect(clientNotifications.map((item) => item.type)).toEqual([
      "weekly_reviewed",
    ]);
    expect(
      trainerNotifications.find((item) => item.type === "journal_submitted"),
    ).toMatchObject({
      title: "Khách hàng Test User đã gửi nhật ký ngày",
      missingFields: [
        "hunger",
        "stress",
        "soreness",
        "pain",
      ],
      deepLink:
        "/trainer/clients/" + data.client.user._id + "?tab=tasks&date=" + today + "#journal",
    });
    expect(
      trainerNotifications.find((item) => item.type === "journal_corrected"),
    ).toMatchObject({
      title: "Khách hàng Test User đã cập nhật nhật ký ngày",
      deepLink:
        "/trainer/clients/" + data.client.user._id + "?tab=tasks&date=" + today + "#journal",
    });
    expect(
      trainerNotifications.find((item) => item.type === "weekly_submitted"),
    ).toMatchObject({
      title: "Khách hàng Test User đã gửi báo cáo tuần",
      missingFields: [
        "weightKg",
        "waistCm",
        "bodyFatPercent",
        "skeletalMusclePercent",
      ],
      deepLink:
        "/trainer/clients/" +
        data.client.user._id +
        "?date=" +
        currentWeek +
        "#weekly-report",
    });
    expect(clientNotifications[0]).toMatchObject({
      title: "Huấn luyện viên đã nhận xét báo cáo tuần",
      deepLink:
        "/dashboard/today/" + currentWeek + "/journal#weekly-report",
    });
  });
});
