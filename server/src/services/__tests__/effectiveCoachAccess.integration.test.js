import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { clearCollections, setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import User from "../../models/User.js";
import Order from "../../models/Order.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import { assertBodyAssessmentTrainer } from "../bodyAssessmentAccess.service.js";
import { assertCommentTargetAccess } from "../coachingCommentAccess.service.js";
import { assertTrainerJournalRead, resolveJournalWriteAccess } from "../dailyJournalAccess.service.js";
import { assertTrainerWeeklyCheckinRead, resolveWeeklyCheckinWriteAccess } from "../weeklyCheckinAccess.service.js";
import { assertCoachManagesClient, resolveClientHabitAccess } from "../coachingHabitAccess.service.js";
import { resolveCoachClientTargetAccess } from "../wellnessTargetAccess.service.js";

const createUser = (role = "user") => User.create({
  name: "Synthetic access test", email: `${randomUUID()}@example.com`, role,
});
const fixture = async () => {
  const lead = await createUser("admin");
  const client = await createUser();
  vi.stubEnv("DEFAULT_ADMIN_TRAINER_ID", String(lead._id));
  vi.stubEnv("ADMIN_EMAIL", "");
  const order = await Order.create({
    userId: client._id, trainerId: null, package: "PT",
    status: "approved", sessions: 5, totalSessions: 5,
  });
  return { lead, client, order, actor: { id: lead._id, role: "admin" } };
};

beforeAll(setupTestDB);
afterEach(async () => { vi.unstubAllEnvs(); await clearCollections(); });
afterAll(teardownTestDB);

describe("Effective coach private access", () => {
  it("allows designated lead to assess a legacy unassigned customer", async () => {
    const { actor, client, order } = await fixture();
    await expect(assertBodyAssessmentTrainer({ actor, clientId: client._id }))
      .resolves.toMatchObject({ _id: order._id });
  });

  it.each([assertBodyAssessmentTrainer, assertCommentTargetAccess])(
    "rejects unrelated admins in personal coaching scope: %s", async (access) => {
      const { client } = await fixture();
      const unrelated = await createUser("admin");
      await expect(access({ actor: { id: unrelated._id, role: "admin" }, clientId: client._id, write: true }))
        .rejects.toMatchObject({ statusCode: 403 });
    },
  );

  it("routes customer comments to the effective lead rather than a null snapshot", async () => {
    const { client, lead, order } = await fixture();
    await expect(assertCommentTargetAccess({
      actor: { id: client._id, role: "user" }, clientId: client._id, write: true,
    })).resolves.toMatchObject({ scope: "client", trainerId: lead._id, orderId: order._id });
  });

  it("allows lead comments in coach scope without changing the admin actor role", async () => {
    const { actor, client, lead } = await fixture();
    const access = await assertCommentTargetAccess({ actor, clientId: client._id, write: true });
    expect({ access, actorRole: actor.role }).toMatchObject({
      access: { scope: "trainer", trainerId: lead._id }, actorRole: "admin",
    });
  });

  it.each([
    assertBodyAssessmentTrainer, assertCommentTargetAccess, assertTrainerJournalRead,
    assertTrainerWeeklyCheckinRead, assertCoachManagesClient, resolveCoachClientTargetAccess,
  ])("never grants null orders to ordinary trainers: %s", async (access) => {
    const { client } = await fixture();
    const trainer = await createUser("trainer");
    await expect(access({ actor: { id: trainer._id, role: "trainer" }, clientId: client._id, write: true }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it.each([assertBodyAssessmentTrainer, assertCommentTargetAccess])(
    "keeps explicit other assignments authoritative: %s", async (access) => {
      const { client, actor, order } = await fixture();
      const trainer = await createUser("trainer");
      await Order.updateOne({ _id: order._id }, { $set: { trainerId: trainer._id } });
      await expect(access({ actor, clientId: client._id, write: true }))
        .rejects.toMatchObject({ statusCode: 403 });
    },
  );

  it.each([assertBodyAssessmentTrainer, assertCommentTargetAccess])(
    "rejects retained relationships after customer deletion: %s", async (access) => {
      const { client, actor } = await fixture();
      await User.deleteOne({ _id: client._id });
      await expect(access({ actor, clientId: client._id, write: true }))
        .rejects.toMatchObject({ statusCode: 403 });
    },
  );

  it.each(["missing", "deleted", "invalid-role"])("fails closed for %s default lead", async (state) => {
    const { client, actor, lead } = await fixture();
    if (state === "missing") vi.stubEnv("DEFAULT_ADMIN_TRAINER_ID", "");
    if (state === "deleted") await User.deleteOne({ _id: lead._id });
    if (state === "invalid-role") await User.updateOne({ _id: lead._id }, { $set: { role: "user" } });
    await expect(assertCommentTargetAccess({ actor, clientId: client._id, write: true }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it.each([resolveJournalWriteAccess, resolveWeeklyCheckinWriteAccess, resolveClientHabitAccess])(
    "attributes customer writes to the designated lead: %s", async (access) => {
      const { client, lead, order } = await fixture();
      await expect(access({ clientId: client._id })).resolves.toMatchObject({
        mode: "coaching", trainerId: lead._id, orderId: order._id,
      });
    },
  );

  it.each([
    assertBodyAssessmentTrainer, assertCommentTargetAccess, assertTrainerJournalRead,
    assertTrainerWeeklyCheckinRead, assertCoachManagesClient, resolveCoachClientTargetAccess,
  ])("rejects conflicting client-level assignments: %s", async (access) => {
    const { client, order } = await fixture();
    const trainer = await createUser("trainer");
    await Order.create({
      userId: client._id, trainerId: trainer._id, package: "PT",
      status: "approved", sessions: 5, totalSessions: 5,
    });
    await expect(access({ actor: { id: trainer._id, role: "trainer" }, clientId: client._id, write: true }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(order.trainerId).toBeNull();
  });

  it("preserves admin operational reads and attributes managed goals and habits to the lead", async () => {
    const { client, lead } = await fixture();
    const admin = await createUser("admin");
    const actor = { id: admin._id, role: "admin", isAdmin: true };
    const [journal, weekly, habit, target] = await Promise.all([
      assertTrainerJournalRead({ actor, clientId: client._id }),
      assertTrainerWeeklyCheckinRead({ actor, clientId: client._id }),
      assertCoachManagesClient({ actor, clientId: client._id }),
      resolveCoachClientTargetAccess({ actor, clientId: client._id }),
    ]);
    expect({ journal, weekly, habit, target }).toMatchObject({
      journal: { adminRead: true }, weekly: { adminRead: true },
      habit: { trainerId: lead._id }, target: { trainerId: lead._id },
    });
  });

  it.each([resolveJournalWriteAccess, resolveWeeklyCheckinWriteAccess, resolveClientHabitAccess])(
    "preserves self-managed access without a configured lead: %s", async (access) => {
      const client = await createUser();
      vi.stubEnv("DEFAULT_ADMIN_TRAINER_ID", "");
      vi.stubEnv("ADMIN_EMAIL", "");
      await FitnessSubscription.create({
        userId: client._id, planCode: "fitness_plus_essential", planTitle: "Synthetic",
        billingCycle: "month", amount: 99000, status: "active",
        startDate: new Date(Date.now() - 60_000), endDate: new Date(Date.now() + 86_400_000),
      });
      await expect(access({ clientId: client._id })).resolves.toMatchObject({
        mode: "self_managed", trainerId: null, orderId: null,
      });
    },
  );
});
