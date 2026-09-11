import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { clearCollections, createTestUser, setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import BodyAssessment from "../../models/BodyAssessment.js";
import BodyAssessmentCommand from "../../models/BodyAssessmentCommand.js";
import BodyAssessmentRevision from "../../models/BodyAssessmentRevision.js";
import InAppNotification from "../../models/InAppNotification.js";
import AuditLog from "../../models/AuditLog.js";
import Order from "../../models/Order.js";
import { saveBodyAssessment, publishBodyAssessment } from "../bodyAssessment.service.js";
import { deleteTodayDashboardData } from "../todayDashboardPrivacy.service.js";
import { syncDailyJournalRetentionForClient } from "../dailyJournalRetentionPolicy.service.js";
import { getMonthWeekPeriod, getVietnamDateKey } from "../../utils/dateKey.js";

const today = getVietnamDateKey();
const weekStartDateKey = getMonthWeekPeriod(today).startDateKey;
const fixture = async () => {
  const trainer = await createTestUser({ role: "trainer", email: `lifecycle-trainer-${randomUUID()}@example.com` });
  const client = await createTestUser({ email: `lifecycle-client-${randomUUID()}@example.com` });
  const order = await Order.create({ userId: client.user._id, trainerId: trainer.user._id, name: "Synthetic", email: client.user.email, package: "PT", sessions: 5, totalSessions: 5, status: "approved" });
  const scope = { actor: { id: trainer.user._id, role: "trainer" }, clientId: client.user._id, weekStartDateKey };
  const draft = { measuredDateKey: today, deviceLabel: "Synthetic", segments: { trunk: { leanKg: 20 } } };
  await saveBodyAssessment({ ...scope, body: { expectedRevision: 0, requestId: randomUUID(), draft } });
  await publishBodyAssessment({ ...scope, body: { expectedRevision: 1, requestId: randomUUID(), confirmPartial: true } });
  await saveBodyAssessment({ ...scope, body: { expectedRevision: 2, requestId: randomUUID(), draft: { ...draft, note: "Private revision" }, reason: "Synthetic correction" } });
  return { clientId: client.user._id, order };
};

beforeAll(async () => {
  await setupTestDB();
  await Promise.all([BodyAssessment.init(), BodyAssessmentCommand.init(), BodyAssessmentRevision.init(), InAppNotification.init()]);
});
beforeEach(() => {
  vi.stubEnv("BODY_ASSESSMENT_WRITES_ENABLED", "true");
  vi.stubEnv("TODAY_DASHBOARD_ENABLED", "true");
  vi.stubEnv("TODAY_JOURNAL_RETENTION_DAYS", "365");
});
afterEach(async () => { vi.unstubAllEnvs(); vi.restoreAllMocks(); await clearCollections(); });
afterAll(teardownTestDB);

describe("Body assessment shared privacy lifecycle", () => {
  it("dashboard cascade erases draft, published, revisions and receipts without touching another client", async () => {
    const current = await fixture();
    const other = await fixture();
    const result = await deleteTodayDashboardData({ clientId: current.clientId, actorId: current.clientId, actorRole: "user" });
    expect(result.counts).toMatchObject({ bodyAssessments: 1, bodyAssessmentRevisions: 3, bodyAssessmentCommands: 3, bodyAssessmentNotifications: 1 });
    for (const Model of [BodyAssessment, BodyAssessmentRevision, BodyAssessmentCommand, InAppNotification]) {
      expect(await Model.countDocuments({ clientId: current.clientId })).toBe(0);
      expect(await Model.countDocuments({ clientId: other.clientId })).toBeGreaterThan(0);
    }
    const audit = await AuditLog.findOne({ targetId: current.clientId, action: "delete_today_dashboard_data" }).lean();
    expect(audit.metadata.collections).toContain("bodyAssessmentCommands");
    expect(JSON.stringify(audit)).not.toContain("Private revision");
  });

  it("dashboard cascade rolls back all families when audit persistence fails", async () => {
    const current = await fixture();
    vi.spyOn(AuditLog, "create").mockRejectedValueOnce(new Error("Synthetic audit unavailable"));
    await expect(deleteTodayDashboardData({ clientId: current.clientId, actorId: current.clientId, actorRole: "user" })).rejects.toThrow("Synthetic audit unavailable");
    expect(await BodyAssessment.countDocuments({ clientId: current.clientId })).toBe(1);
    expect(await BodyAssessmentRevision.countDocuments({ clientId: current.clientId })).toBe(3);
    expect(await BodyAssessmentCommand.countDocuments({ clientId: current.clientId })).toBe(3);
    expect(await InAppNotification.countDocuments({ clientId: current.clientId })).toBe(1);
  });

  it("shared retention schedules the same deadline and clears it on coaching resume", async () => {
    const current = await fixture();
    const other = await fixture();
    await Order.updateOne({ _id: current.order._id }, { $set: { sessions: 0 } });
    const scheduled = await syncDailyJournalRetentionForClient({ clientId: current.clientId, coachingEndedAt: new Date("2026-01-01T00:00:00.000Z") });
    expect(scheduled.state).toBe("retention_scheduled");
    expect((await BodyAssessment.findOne({ clientId: current.clientId })).retentionExpiresAt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect((await InAppNotification.findOne({ clientId: current.clientId })).retentionExpiresAt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect((await BodyAssessment.findOne({ clientId: other.clientId })).retentionExpiresAt).toBeNull();
    await syncDailyJournalRetentionForClient({ clientId: current.clientId, coachingEndedAt: new Date("2026-02-01T00:00:00.000Z") });
    expect((await BodyAssessment.findOne({ clientId: current.clientId })).retentionExpiresAt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    await Order.updateOne({ _id: current.order._id }, { $set: { sessions: 5 } });
    expect((await syncDailyJournalRetentionForClient({ clientId: current.clientId })).state).toBe("active");
    expect((await BodyAssessment.findOne({ clientId: current.clientId })).retentionExpiresAt).toBeNull();
    expect((await InAppNotification.findOne({ clientId: current.clientId })).retentionExpiresAt).toBeNull();
    expect(await BodyAssessmentRevision.countDocuments({ clientId: current.clientId })).toBe(3);
  });
});
