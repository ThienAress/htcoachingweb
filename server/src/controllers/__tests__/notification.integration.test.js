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
import InAppNotification from "../../models/InAppNotification.js";
import AuditLog from "../../models/AuditLog.js";
import NotificationPreference from "../../models/NotificationPreference.js";
import notificationRoutes from "../../routes/notification.routes.js";
import userRoutes from "../../routes/user.routes.js";
import { createInAppNotification } from "../../services/inAppNotification.service.js";
import {
  runInAppNotificationRetentionSweep,
} from "../../services/inAppNotificationPrivacy.service.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/user", userRoutes);
  app.use(errorHandler);
  await InAppNotification.init();
});
afterEach(clearCollections);
beforeEach(() => {
  delete process.env.TODAY_NOTIFICATION_RETENTION_ENFORCE;
});
afterAll(teardownTestDB);

describe("In-app notifications", () => {
  it("deduplicates delivery and stores only a generic non-sensitive title", async () => {
    const recipient = await createTestUser({
      email: "notification-recipient@example.com",
    });
    const actor = await createTestUser({
      email: "notification-actor@example.com",
      role: "trainer",
    });
    const targetId = recipient.user._id;
    const input = {
      recipientId: recipient.user._id,
      actorId: actor.user._id,
      clientId: recipient.user._id,
      type: "coaching_comment_created",
      targetType: "daily_journal",
      targetId,
      dedupeKey: "comment:" + targetId + ":1",
    };
    const first = await createInAppNotification(input);
    const second = await createInAppNotification(input);
    const stored = await InAppNotification.findOne().lean();

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await InAppNotification.countDocuments()).toBe(1);
    expect(stored.title).toBe("Có bình luận coaching mới");
    expect(stored.retentionExpiresAt).toBeNull();
    expect(JSON.stringify(stored)).not.toContain("pain");
    expect(JSON.stringify(stored)).not.toContain("weight");
  });

  it("honors category preference opt-out before creating delivery", async () => {
    const recipient = await createTestUser({
      email: "notification-optout@example.com",
    });
    const preference = await withAuth(
      request(app).put("/api/notifications/preferences").send({
        expectedRevision: 0,
        inAppEnabled: true,
        comments: false,
        journal: true,
        weekly: true,
      }),
      recipient.accessToken,
    );
    const result = await createInAppNotification({
      recipientId: recipient.user._id,
      actorId: recipient.user._id,
      clientId: recipient.user._id,
      type: "coaching_comment_created",
      targetType: "daily_journal",
      targetId: recipient.user._id,
      dedupeKey: "comment:optout",
      allowSelf: true,
    });
    const loaded = await withAuth(
      request(app).get("/api/notifications/preferences"),
      recipient.accessToken,
    );

    expect(preference.status).toBe(200);
    expect(preference.body.data.revision).toBe(1);
    expect(result).toMatchObject({ created: false, suppressed: true });
    expect(loaded.body.data.comments).toBe(false);
    expect(await InAppNotification.countDocuments()).toBe(0);
  });

  it("lists only recipient data and marks one or all notifications read", async () => {
    const recipient = await createTestUser({
      email: "notification-owner@example.com",
    });
    const outsider = await createTestUser({
      email: "notification-outsider@example.com",
    });
    const created = await createInAppNotification({
      recipientId: recipient.user._id,
      actorId: outsider.user._id,
      clientId: recipient.user._id,
      type: "weekly_reviewed",
      targetType: "weekly_checkin",
      targetId: recipient.user._id,
      dedupeKey: "weekly:reviewed:1",
    });
    const list = await withAuth(
      request(app).get("/api/notifications?status=unread"),
      recipient.accessToken,
    );
    const denied = await withAuth(
      request(app).post(
        "/api/notifications/" + created.notification._id + "/read",
      ),
      outsider.accessToken,
    );
    const marked = await withAuth(
      request(app).post(
        "/api/notifications/" + created.notification._id + "/read",
      ),
      recipient.accessToken,
    );
    await createInAppNotification({
      recipientId: recipient.user._id,
      actorId: outsider.user._id,
      clientId: recipient.user._id,
      type: "weekly_submitted",
      targetType: "weekly_checkin",
      targetId: outsider.user._id,
      dedupeKey: "weekly:submitted:2",
    });
    const all = await withAuth(
      request(app).post("/api/notifications/read-all"),
      recipient.accessToken,
    );

    expect(list.body.data.unreadCount).toBe(1);
    expect(list.body.data.items).toHaveLength(1);
    expect(denied.status).toBe(404);
    expect(marked.body.data.readAt).toBeTruthy();
    expect(all.body.data.updated).toBe(1);
  });

  it("rejects stale preference revisions", async () => {
    const recipient = await createTestUser({
      email: "notification-pref-stale@example.com",
    });
    const payload = {
      expectedRevision: 0,
      inAppEnabled: true,
      comments: true,
      journal: false,
      weekly: true,
    };
    await withAuth(
      request(app).put("/api/notifications/preferences").send(payload),
      recipient.accessToken,
    );
    const stale = await withAuth(
      request(app).put("/api/notifications/preferences").send(payload),
      recipient.accessToken,
    );

    expect(stale.status).toBe(409);
  });

  it("joins admin user deletion inventory", async () => {
    const recipient = await createTestUser({
      email: "notification-delete@example.com",
    });
    const admin = await createTestUser({
      email: "notification-delete-admin@example.com",
      role: "admin",
    });
    await withAuth(
      request(app).put("/api/notifications/preferences").send({
        expectedRevision: 0,
        inAppEnabled: true,
        comments: true,
        journal: true,
        weekly: true,
      }),
      recipient.accessToken,
    );
    await createInAppNotification({
      recipientId: recipient.user._id,
      actorId: admin.user._id,
      clientId: recipient.user._id,
      type: "weekly_reviewed",
      targetType: "weekly_checkin",
      targetId: recipient.user._id,
      dedupeKey: "notification:user-delete",
    });
    const deleted = await withAuth(
      request(app).delete("/api/user/" + recipient.user._id),
      admin.accessToken,
    );

    expect(deleted.status).toBe(200);
    expect(await InAppNotification.countDocuments()).toBe(0);
    expect(await NotificationPreference.countDocuments()).toBe(0);
  });

  it("dry-runs by default and gates audited retention enforcement", async () => {
    const recipient = await createTestUser({
      email: "notification-retention@example.com",
    });
    const admin = await createTestUser({
      email: "notification-retention-admin@example.com",
      role: "admin",
    });
    await createInAppNotification({
      recipientId: recipient.user._id,
      actorId: admin.user._id,
      clientId: recipient.user._id,
      type: "weekly_reviewed",
      targetType: "weekly_checkin",
      targetId: recipient.user._id,
      dedupeKey: "notification:retention",
    });
    await InAppNotification.updateOne(
      { recipientId: recipient.user._id },
      { $set: { retentionExpiresAt: new Date(Date.now() - 60_000) } },
    );

    expect(await runInAppNotificationRetentionSweep()).toMatchObject({
      dryRun: true,
      candidates: 1,
      deleted: 0,
    });
    await expect(
      runInAppNotificationRetentionSweep({
        enforce: true,
        actorId: admin.user._id,
      }),
    ).rejects.toMatchObject({
      codeName: "NOTIFICATION_RETENTION_ENFORCEMENT_DISABLED",
    });

    process.env.TODAY_NOTIFICATION_RETENTION_ENFORCE = "true";
    expect(
      await runInAppNotificationRetentionSweep({
        enforce: true,
        actorId: admin.user._id,
      }),
    ).toMatchObject({ dryRun: false, candidates: 1, deleted: 1 });
    expect(await InAppNotification.countDocuments()).toBe(0);
    expect(
      await AuditLog.countDocuments({
        action: "retention_delete_in_app_notification",
      }),
    ).toBe(1);
  });
});
