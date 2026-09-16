import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { clearCollections, createTestApp, createTestUser, setupTestDB, teardownTestDB, withAuth } from "../../__tests__/setup.js";
import Order from "../../models/Order.js";
import User from "../../models/User.js";
import BodyAssessment from "../../models/BodyAssessment.js";
import BodyAssessmentRevision from "../../models/BodyAssessmentRevision.js";
import BodyAssessmentCommand from "../../models/BodyAssessmentCommand.js";
import InAppNotification from "../../models/InAppNotification.js";
import routes from "../../routes/bodyAssessment.routes.js";
import { addDaysToDateKey, getMonthWeekPeriod, getVietnamDateKey } from "../../utils/dateKey.js";

let app;
const today = getVietnamDateKey();
const period = getMonthWeekPeriod(today).startDateKey;
const measurement = () => ({ measuredDateKey: today, deviceLabel: "Synthetic device", segments: { leftArm: { leanKg: 2.1, fatKg: 1.2, fatReferencePercent: 210 } } });
const fixture = async () => {
  const trainer = await createTestUser({ role: "trainer", email: `trainer-${randomUUID()}@example.com` });
  const client = await createTestUser({ email: `client-${randomUUID()}@example.com` });
  const order = await Order.create({ userId: client.user._id, trainerId: trainer.user._id, name: "Synthetic", email: client.user.email, package: "PT", sessions: 5, totalSessions: 5, status: "approved" });
  const path = `/api/body-assessments/trainer/clients/${client.user._id}/${period}`;
  const save = (body, token = trainer.accessToken) => withAuth(request(app).put(path).send(body), token);
  const publish = (revision, extra = {}) => withAuth(request(app).post(`${path}/publish`).send({ expectedRevision: revision, requestId: randomUUID(), confirmPartial: true, ...extra }), trainer.accessToken);
  const read = () => withAuth(request(app).get("/api/body-assessments"), client.accessToken);
  return { trainer, client, order, path, save, publish, read };
};

beforeAll(async () => {
  await setupTestDB();
  await Promise.all([BodyAssessment.init(), BodyAssessmentRevision.init(), BodyAssessmentCommand.init(), InAppNotification.init()]);
  app = createTestApp();
  app.use("/api/body-assessments", routes);
});
beforeEach(() => vi.stubEnv("BODY_ASSESSMENT_WRITES_ENABLED", "true"));
afterEach(async () => { vi.unstubAllEnvs(); vi.restoreAllMocks(); await clearCollections(); });
afterAll(teardownTestDB);

describe("Body assessment publication HTTP", () => {
  it("fails closed while production indexes are not enabled", async () => {
    vi.stubEnv("BODY_ASSESSMENT_WRITES_ENABLED", "false");
    const ctx = await fixture();
    const response = await ctx.save({ expectedRevision: 0, requestId: randomUUID(), draft: measurement() });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("BODY_ASSESSMENT_WRITES_DISABLED");
    expect(await BodyAssessment.countDocuments()).toBe(0);
  });

  it("fails closed when a required production unique index is missing", async () => {
    await BodyAssessment.collection.dropIndex("uniq_body_assessment_period");
    try {
      const ctx = await fixture();
      const response = await ctx.save({
        expectedRevision: 0,
        requestId: randomUUID(),
        draft: measurement(),
      });
      expect(response.status).toBe(503);
      expect(response.body.code).toBe("BODY_ASSESSMENT_INDEXES_NOT_READY");
      expect(await BodyAssessment.countDocuments()).toBe(0);
    } finally {
      await BodyAssessment.collection.createIndex(
        { clientId: 1, weekStartDateKey: 1 },
        { unique: true, name: "uniq_body_assessment_period" },
      );
    }
  });

  it("keeps trainer draft private, then publishes a partial result including reference above 100", async () => {
    const ctx = await fixture();
    const saved = await ctx.save({ expectedRevision: 0, requestId: randomUUID(), draft: measurement() });
    expect(saved.status).toBe(200);
    expect((await ctx.read()).body.data.items).toEqual([]);
    const published = await ctx.publish(saved.body.data.assessment.revision);
    expect(published.status).toBe(200);
    const result = await ctx.read();
    expect(result.body.data.items[0].published.segments.leftArm.fatReferencePercent).toBe(210);
    expect(result.body.data.items[0]).not.toHaveProperty("draft");
  });

  it("keeps the old snapshot during correction and replaces the canonical result only on republish", async () => {
    const ctx = await fixture();
    await ctx.save({ expectedRevision: 0, requestId: randomUUID(), draft: measurement() });
    await ctx.publish(1);
    const draft = measurement();
    draft.segments.leftArm.leanKg = 3;
    const edited = await ctx.save({ expectedRevision: 2, requestId: randomUUID(), draft, reason: "Corrected transcription" });
    expect(edited.status).toBe(200);
    expect((await ctx.read()).body.data.items[0].published.segments.leftArm.leanKg).toBe(2.1);
    expect((await ctx.publish(3)).status).toBe(200);
    const read = await ctx.read();
    expect(read.body.data.items).toHaveLength(1);
    expect(read.body.data.items[0].published.segments.leftArm.leanKg).toBe(3);
    expect(await BodyAssessmentRevision.countDocuments({ action: "publish" })).toBe(2);
  });

  it("replays persisted commands without repeating publication or notification, rejects changed intent", async () => {
    const ctx = await fixture();
    const body = { expectedRevision: 0, requestId: randomUUID(), draft: measurement() };
    await ctx.save(body);
    expect((await ctx.save(body)).body.data.idempotentReplay).toBe(true);
    const requestId = randomUUID();
    await ctx.publish(1, { requestId });
    expect((await ctx.publish(1, { requestId })).body.data.idempotentReplay).toBe(true);
    expect(await InAppNotification.countDocuments({ targetType: "body_assessment" })).toBe(1);
    expect((await ctx.save({ ...body, draft: { ...measurement(), note: "Changed" } })).status).toBe(409);
  });

  it("revokes trainer read, write and replay after assignment changes", async () => {
    const ctx = await fixture();
    const body = { expectedRevision: 0, requestId: randomUUID(), draft: measurement() };
    await ctx.save(body);
    await Order.updateOne({ _id: ctx.order._id }, { $set: { sessions: 0 } });
    expect((await ctx.save(body)).status).toBe(403);
    expect((await withAuth(request(app).get(ctx.path), ctx.trainer.accessToken)).status).toBe(403);
    expect((await ctx.publish(1)).status).toBe(403);
  });

  it("denies retained orders after customer deletion, including replay and recreation", async () => {
    const ctx = await fixture();
    const body = { expectedRevision: 0, requestId: randomUUID(), draft: measurement() };
    await ctx.save(body);
    await User.deleteOne({ _id: ctx.client.user._id });
    expect((await ctx.save(body)).status).toBe(403);
    expect((await ctx.save({ ...body, expectedRevision: 1, requestId: randomUUID() })).status).toBe(403);
    expect((await ctx.publish(1)).status).toBe(403);
    expect((await withAuth(request(app).get(ctx.path), ctx.trainer.accessToken)).status).toBe(403);
    expect((await withAuth(request(app).get(`/api/body-assessments/trainer/clients/${ctx.client.user._id}`), ctx.trainer.accessToken)).status).toBe(403);
    expect(await BodyAssessmentCommand.countDocuments()).toBe(1);
  });

  it("scopes request identifiers by actor and canonicalizes the same object-id target", async () => {
    const ctx = await fixture();
    const body = { expectedRevision: 0, requestId: randomUUID(), draft: measurement() };
    await ctx.save(body);
    const upperPath = ctx.path.replace(String(ctx.client.user._id), String(ctx.client.user._id).toUpperCase());
    const replayed = await withAuth(request(app).put(upperPath).send(body), ctx.trainer.accessToken);
    expect(replayed.body.data.idempotentReplay).toBe(true);
    const replacement = await createTestUser({ role: "trainer", email: "replacement@example.com" });
    await Order.updateOne({ _id: ctx.order._id }, { $set: { trainerId: replacement.user._id } });
    const saved = await ctx.save({ ...body, expectedRevision: 1 }, replacement.accessToken);
    expect(saved.status).toBe(200);
    expect(saved.body.data.idempotentReplay).toBe(false);
  });

  it("rejects unauthenticated, student writes, other trainer and missing CSRF", async () => {
    const ctx = await fixture();
    const stranger = await createTestUser({ role: "trainer", email: "stranger@example.com" });
    const body = { expectedRevision: 0, requestId: randomUUID(), draft: measurement() };
    expect((await request(app).get("/api/body-assessments")).status).toBe(401);
    expect((await ctx.save(body, ctx.client.accessToken)).status).toBe(403);
    expect((await ctx.save(body, stranger.accessToken)).status).toBe(403);
    expect((await request(app).put(ctx.path).set("Cookie", `accessToken=${ctx.trainer.accessToken}`).send(body)).status).toBe(403);
  });

  it("serializes concurrent publish with a single canonical snapshot", async () => {
    const ctx = await fixture();
    await ctx.save({ expectedRevision: 0, requestId: randomUUID(), draft: measurement() });
    const responses = await Promise.all([ctx.publish(1), ctx.publish(1)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await BodyAssessmentRevision.countDocuments({ action: "publish" })).toBe(1);
  });

  it("concurrent same-id creation and publication return one committed command", async () => {
    const ctx = await fixture();
    const body = { expectedRevision: 0, requestId: randomUUID(), draft: measurement() };
    expect((await Promise.all([ctx.save(body), ctx.save(body)])).map((response) => response.status)).toEqual([200, 200]);
    const requestId = randomUUID();
    expect((await Promise.all([ctx.publish(1, { requestId }), ctx.publish(1, { requestId })])).map((response) => response.status)).toEqual([200, 200]);
    expect(await BodyAssessmentCommand.countDocuments()).toBe(2);
  });

  it("rolls back publication and receipts if atomic notification persistence fails", async () => {
    const ctx = await fixture();
    await ctx.save({ expectedRevision: 0, requestId: randomUUID(), draft: measurement() });
    vi.spyOn(InAppNotification, "create").mockRejectedValueOnce(new Error("Synthetic persistence failure"));
    const requestId = randomUUID();
    expect((await ctx.publish(1, { requestId })).status).toBe(500);
    expect((await ctx.read()).body.data.items).toEqual([]);
    expect(await BodyAssessmentCommand.countDocuments()).toBe(1);
    expect((await ctx.publish(1, { requestId })).status).toBe(200);
    expect(await InAppNotification.countDocuments()).toBe(1);
  });

  it("orders paginated results by measurement date rather than edit time", async () => {
    const ctx = await fixture();
    await ctx.save({ expectedRevision: 0, requestId: randomUUID(), draft: measurement() });
    await ctx.publish(1);
    const previousDay = addDaysToDateKey(getMonthWeekPeriod(today).rangeStartDateKey, -1);
    const previousPeriod = getMonthWeekPeriod(previousDay).startDateKey;
    const path = `/api/body-assessments/trainer/clients/${ctx.client.user._id}/${previousPeriod}`;
    const saved = await withAuth(request(app).put(path).send({ expectedRevision: 0, requestId: randomUUID(), draft: { ...measurement(), measuredDateKey: previousDay } }), ctx.trainer.accessToken);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const published = await withAuth(request(app).post(`${path}/publish`).send({ expectedRevision: 1, requestId: randomUUID(), confirmPartial: true }), ctx.trainer.accessToken);
    expect(published.status, JSON.stringify(published.body)).toBe(200);
    const result = await withAuth(request(app).get("/api/body-assessments?limit=1&page=1"), ctx.client.accessToken);
    expect(result.body.data.items[0].published.measuredDateKey).toBe(today);
    expect(result.body.data.pagination.total).toBe(2);
    const second = await withAuth(request(app).get("/api/body-assessments?limit=1&page=2"), ctx.client.accessToken);
    expect(second.body.data.items[0].published.measuredDateKey).toBe(previousDay);
  });

  it.each([
    { measuredDateKey: "2999-01-01" },
    { measuredDateKey: "2026-02-30" },
    { unexpected: 1 },
    { segments: { leftArm: { leanKg: -1 } } },
    { segments: { leftArm: { leanKg: "2" } } },
    { segments: { leftArm: { unknown: 3 } } },
  ])("rejects invalid measurement %j without creating documents", async (invalid) => {
    const ctx = await fixture();
    const response = await ctx.save({ expectedRevision: 0, requestId: randomUUID(), draft: { ...measurement(), ...invalid } });
    expect(response.status).toBe(400);
    expect(await BodyAssessment.countDocuments()).toBe(0);
  });

  it("requires partial confirmation, kg source fields, and correction reason", async () => {
    const ctx = await fixture();
    await ctx.save({ expectedRevision: 0, requestId: randomUUID(), draft: { segments: {} } });
    expect((await ctx.publish(1)).status).toBe(400);
    await ctx.save({ expectedRevision: 1, requestId: randomUUID(), draft: measurement() });
    expect((await ctx.publish(2, { confirmPartial: false })).status).toBe(400);
    await ctx.publish(2);
    expect((await ctx.save({ expectedRevision: 3, requestId: randomUUID(), draft: measurement() })).status).toBe(400);
  });

  it("privacy export covers snapshots and projected receipts; confirmed deletion is scoped", async () => {
    const ctx = await fixture();
    const other = await fixture();
    for (const target of [ctx, other]) {
      await target.save({ expectedRevision: 0, requestId: randomUUID(), draft: measurement() });
      await target.publish(1);
    }
    const exported = await withAuth(request(app).get("/api/body-assessments/privacy/export"), ctx.client.accessToken);
    expect(exported.body.data.assessments).toHaveLength(1);
    expect(exported.body.data.revisions).toHaveLength(2);
    expect(exported.body.data.receipts).toHaveLength(2);
    expect(JSON.stringify(exported.body)).not.toMatch(/requestId|fingerprint|actorId/);
    expect((await withAuth(request(app).delete("/api/body-assessments/privacy").send({}), ctx.client.accessToken)).status).toBe(400);
    const deleted = await withAuth(request(app).delete("/api/body-assessments/privacy").send({ confirmation: "DELETE_MY_BODY_ASSESSMENTS" }), ctx.client.accessToken);
    expect(deleted.status).toBe(200);
    expect(await BodyAssessment.countDocuments({ clientId: ctx.client.user._id })).toBe(0);
    expect(await BodyAssessmentRevision.countDocuments({ clientId: ctx.client.user._id })).toBe(0);
    expect(await BodyAssessmentCommand.countDocuments({ clientId: ctx.client.user._id })).toBe(0);
    expect((await other.read()).body.data.items).toHaveLength(1);
  });
});
