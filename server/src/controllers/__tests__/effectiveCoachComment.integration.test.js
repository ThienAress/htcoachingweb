import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import {
  clearCollections, createTestApp, createTestUser, setupTestDB, teardownTestDB, withAuth,
} from "../../__tests__/setup.js";
import Order from "../../models/Order.js";
import DailyJournal from "../../models/DailyJournal.js";
import CoachingComment from "../../models/CoachingComment.js";
import CoachingCommentRevision from "../../models/CoachingCommentRevision.js";
import InAppNotification from "../../models/InAppNotification.js";
import AuditLog from "../../models/AuditLog.js";
import routes from "../../routes/coachingComment.routes.js";
import { getVietnamDateKey } from "../../utils/dateKey.js";

let app;
const account = (role = "user") => createTestUser({ role, email: `${randomUUID()}@example.com` });
const fixture = async () => {
  const lead = await account("admin");
  const otherAdmin = await account("admin");
  const client = await account();
  vi.stubEnv("DEFAULT_ADMIN_TRAINER_ID", String(lead.user._id));
  vi.stubEnv("ADMIN_EMAIL", "");
  vi.stubEnv("TODAY_COMMENT_WRITES_ENABLED", "true");
  const order = await Order.create({
    userId: client.user._id, trainerId: null, package: "PT",
    status: "approved", sessions: 5, totalSessions: 5,
  });
  const journal = await DailyJournal.create({
    clientId: client.user._id, trainerIdAtCreation: lead.user._id,
    dateKey: getVietnamDateKey(), revision: 1,
  });
  const payload = { targetType: "daily_journal", targetId: String(journal._id), requestId: randomUUID(), body: "Synthetic coaching feedback" };
  const create = (token = lead.accessToken, body = payload) => withAuth(request(app).post("/api/coaching-comments").send(body), token);
  return { lead, otherAdmin, client, order, journal, payload, create };
};

beforeAll(async () => {
  await setupTestDB();
  await Promise.all([CoachingComment.init(), CoachingCommentRevision.init(), InAppNotification.init()]);
  app = createTestApp();
  app.use("/api/coaching-comments", routes);
});
afterEach(async () => { vi.unstubAllEnvs(); await clearCollections(); });
afterAll(teardownTestDB);

describe("Designated admin coaching comments HTTP", () => {
  it("preserves admin authorship and auditing through create, edit and remove", async () => {
    const ctx = await fixture();
    const created = await ctx.create();
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ actorId: String(ctx.lead.user._id), actorRole: "admin", isMine: true });
    const id = created.body.data._id;
    const edited = await withAuth(request(app).patch(`/api/coaching-comments/${id}`).send({
      expectedRevision: 1, requestId: randomUUID(), body: "Synthetic corrected feedback",
    }), ctx.lead.accessToken);
    expect(edited.status).toBe(200);
    const removed = await withAuth(request(app).delete(`/api/coaching-comments/${id}`).send({
      expectedRevision: 2, requestId: randomUUID(),
    }), ctx.lead.accessToken);
    expect(removed.body.data).toMatchObject({ actorRole: "admin", status: "removed", revision: 3 });
    const revisions = await CoachingCommentRevision.find({ commentId: id }).sort({ revision: 1 }).lean();
    expect(revisions.map(item => item.actorRole)).toEqual(["admin", "admin", "admin"]);
    expect(await AuditLog.countDocuments({ actorId: ctx.lead.user._id, actorRole: "admin", action: "write_coaching_comment" })).toBe(3);
    const notifications = await InAppNotification.find({ targetId: id }).lean();
    expect(notifications.map(item => String(item.recipientId))).toEqual([String(ctx.client.user._id)]);
  });

  it("blocks other admins from reading, commenting or impersonating the lead", async () => {
    const ctx = await fixture();
    const created = await ctx.create();
    expect(created.status).toBe(201);
    const otherWrite = await ctx.create(ctx.otherAdmin.accessToken, { ...ctx.payload, requestId: randomUUID() });
    expect(otherWrite.status).toBe(403);
    const read = await withAuth(request(app).get(`/api/coaching-comments/daily_journal/${ctx.journal._id}`), ctx.otherAdmin.accessToken);
    expect(read.status).toBe(403);
    const edit = await withAuth(request(app).patch(`/api/coaching-comments/${created.body.data._id}`).send({
      expectedRevision: 1, requestId: randomUUID(), body: "Synthetic unauthorized feedback",
    }), ctx.otherAdmin.accessToken);
    expect(edit.status).toBe(403);
    expect(await CoachingComment.countDocuments()).toBe(1);
  });

  it("rechecks current assignment before replay and never routes customer reply to the operator", async () => {
    const ctx = await fixture();
    const reply = await ctx.create(ctx.client.accessToken);
    expect(reply.status).toBe(201);
    const notifications = await InAppNotification.find({ targetId: reply.body.data._id }).lean();
    expect(notifications.map(item => String(item.recipientId))).toEqual([String(ctx.lead.user._id)]);
    const leadPayload = { ...ctx.payload, requestId: randomUUID() };
    const created = await ctx.create(ctx.lead.accessToken, leadPayload);
    expect(created.status).toBe(201);
    await Order.updateOne({ _id: ctx.order._id }, { $set: { trainerId: ctx.otherAdmin.user._id } });
    expect((await ctx.create(ctx.lead.accessToken, leadPayload)).status).toBe(403);
  });
});
