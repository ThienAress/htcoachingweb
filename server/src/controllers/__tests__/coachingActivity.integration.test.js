import {
  afterAll,
  afterEach,
  beforeAll,
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
import AuditLog from "../../models/AuditLog.js";
import CoachingComment from "../../models/CoachingComment.js";
import CoachingCommentRevision from "../../models/CoachingCommentRevision.js";
import DailyJournal from "../../models/DailyJournal.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import coachingActivityRoutes from "../../routes/coachingActivity.routes.js";
import { csvEscape } from "../../services/coachingActivityExport.service.js";
import { addDaysToDateKey, getVietnamDateKey } from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/coaching-activity", coachingActivityRoutes);
  app.use(errorHandler);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("Coaching activity and export", () => {
  it("returns generic events without raw health or comment content", async () => {
    const client = await createTestUser({
      email: "activity-client@example.com",
    });
    const journal = await DailyJournal.create({
      clientId: client.user._id,
      dateKey: today,
      wellness: { pain: 8, painArea: "Chi tiết riêng" },
      notes: { private: "Không được export" },
      status: "submitted",
      submittedAt: new Date(),
      revision: 2,
    });
    const weekly = await WeeklyCheckin.create({
      clientId: client.user._id,
      weekStartDateKey: addDaysToDateKey(today, -1),
      body: { note: "Nội dung sức khỏe" },
      status: "reviewed",
      submittedAt: new Date(Date.now() - 60_000),
      trainerReview: {
        trainerId: client.user._id,
        message: "Review riêng",
        reviewedAt: new Date(),
      },
      revision: 3,
    });
    const comment = await CoachingComment.create({
      clientId: client.user._id,
      targetType: "daily_journal",
      targetId: journal._id,
      actorId: client.user._id,
      actorRole: "user",
      body: "Comment riêng",
      revision: 1,
    });
    await CoachingCommentRevision.create({
      commentId: comment._id,
      clientId: client.user._id,
      revision: 1,
      actorId: client.user._id,
      actorRole: "user",
      action: "create",
      requestId: "a1111111-1111-4111-8111-111111111111",
      payloadFingerprint: "a".repeat(64),
    });
    const response = await withAuth(
      request(app).get("/api/coaching-activity?days=7"),
      client.accessToken,
    );
    const serialized = JSON.stringify(response.body.data);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetType: "daily_journal",
          sourceId: String(journal._id),
        }),
        expect.objectContaining({
          targetType: "weekly_checkin",
          sourceId: String(weekly._id),
        }),
        expect.objectContaining({
          targetType: "coaching_comment",
          sourceId: String(comment._id),
        }),
      ]),
    );
    for (const secret of [
      "Không được export",
      "Nội dung sức khỏe",
      "Comment riêng",
      "Chi tiết riêng",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("exports JSON/CSV with source IDs and creates minimal audit records", async () => {
    const client = await createTestUser({
      email: "activity-export@example.com",
    });
    await DailyJournal.create({
      clientId: client.user._id,
      dateKey: today,
      status: "submitted",
      submittedAt: new Date(),
      revision: 1,
    });
    const json = await withAuth(
      request(app).get("/api/coaching-activity/export?days=30&format=json"),
      client.accessToken,
    );
    const csv = await withAuth(
      request(app).get("/api/coaching-activity/export?days=30&format=csv"),
      client.accessToken,
    );

    expect(json.body.data.timeZone).toBe("Asia/Ho_Chi_Minh");
    expect(json.body.data.items[0].sourceId).toBeTruthy();
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toContain("attachment");
    expect(csv.text).toContain("eventType,occurredAt,timeZone,targetType,sourceId,dateKey");
    expect(
      await AuditLog.countDocuments({
        actorId: client.user._id,
        action: "export_coaching_activity",
      }),
    ).toBe(2);
  });

  it("escapes CSV formulas and rejects unbounded ranges", async () => {
    const client = await createTestUser({
      email: "activity-range@example.com",
    });
    const invalid = await withAuth(
      request(app).get("/api/coaching-activity?days=365"),
      client.accessToken,
    );
    const quote = String.fromCharCode(34);

    expect(csvEscape("=SUM(A1:A2)")).toBe(
      quote + "'=SUM(A1:A2)" + quote,
    );
    expect(csvEscape("a,b")).toBe(quote + "a,b" + quote);
    expect(invalid.status).toBe(400);
  });
});
