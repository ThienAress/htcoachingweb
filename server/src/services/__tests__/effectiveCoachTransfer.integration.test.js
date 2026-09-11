import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { clearCollections, createTestUser, setupTestDB, teardownTestDB } from "../../__tests__/setup.js";
import Order from "../../models/Order.js";
import Checkin from "../../models/Checkin.js";
import Contract from "../../models/Contract.js";
import TrainerTransfer from "../../models/TrainerTransfer.js";
import User from "../../models/User.js";
import { buildTrainerTransferPreview, executeTrainerTransfer, listActiveTrainerAssignments } from "../trainerTransfer.service.js";

const createOrder = (client, trainerId, overrides = {}) => Order.create({
  userId: client._id, trainerId, status: "approved", sessions: 5, totalSessions: 5, ...overrides,
});
const fixture = async () => {
  const { user: lead } = await createTestUser({ role: "admin", email: "lead@example.com" });
  const { user: otherAdmin } = await createTestUser({ role: "admin", email: "other-admin@example.com" });
  const { user: trainer } = await createTestUser({ role: "trainer", email: "trainer@example.com" });
  const { user: client } = await createTestUser({ email: "client@example.com" });
  vi.stubEnv("DEFAULT_ADMIN_TRAINER_ID", String(lead._id));
  vi.stubEnv("ADMIN_EMAIL", "");
  return { lead, otherAdmin, trainer, client };
};
const transferInput = (f, overrides = {}) => ({
  clientId: f.client._id, fromTrainerId: f.lead._id, toTrainerId: f.trainer._id, ...overrides,
});
const execute = (f, input, previewToken, overrides = {}) => executeTrainerTransfer({
  ...input, actorId: f.otherAdmin._id, reason: "Chuyển khách theo phân công được duyệt",
  requestId: "effective-transfer-request", previewToken, ...overrides,
});

describe("effective coach transfer", () => {
  beforeAll(setupTestDB);
  afterEach(async () => { vi.unstubAllEnvs(); await clearCollections(); });
  afterAll(teardownTestDB);

  it("groups legacy null/missing with explicit lead without including inactive or other assignments", async () => {
    const f = await fixture();
    await createOrder(f.client, null);
    const missing = await createOrder(f.client, null);
    await Order.collection.updateOne({ _id: missing._id }, { $unset: { trainerId: "" } });
    await createOrder(f.client, f.lead._id);
    await createOrder(f.client, f.trainer._id);
    await createOrder(f.client, null, { status: "completed" });
    await createOrder(f.client, null, { sessions: 0 });
    const result = await listActiveTrainerAssignments();
    expect(result.assignments.map(a => [String(a.trainer._id), a.activeOrders]).sort()).toEqual([
      [String(f.lead._id), 3], [String(f.trainer._id), 1],
    ].sort());
  });

  it("transfers only active legacy/explicit lead orders and records one replay-safe audit", async () => {
    const f = await fixture();
    const legacy = await createOrder(f.client, null);
    const contract = await Contract.create({ orderId: legacy._id, clientId: f.client._id, trainerId: f.lead._id, clientInfo: { name: f.client.name }, status: "signed" });
    const checkin = await Checkin.create({ orderId: legacy._id, clientRequestId: "legacy-transfer-checkin", name: f.client.name, package: "Gói 5 buổi", time: new Date(), muscle: "Ngực", remainingSessions: 5 });
    const missing = await createOrder(f.client, null);
    await Order.collection.updateOne({ _id: missing._id }, { $unset: { trainerId: "" } });
    const explicit = await createOrder(f.client, f.lead._id);
    const pending = await createOrder(f.client, null, { status: "pending", sessions: 0 });
    const other = await createOrder(f.client, f.otherAdmin._id);
    const completed = await createOrder(f.client, null, { status: "completed" });
    const exhausted = await createOrder(f.client, null, { sessions: 0 });
    const input = transferInput(f);
    const preview = await buildTrainerTransferPreview(input);
    await execute(f, input, preview.previewToken);
    const replay = await execute(f, input, preview.previewToken);
    expect({
      affected: preview.affected.orders,
      moved: await Order.countDocuments({ _id: { $in: [legacy._id, missing._id, explicit._id, pending._id] }, trainerId: f.trainer._id }),
      other: String((await Order.findById(other._id)).trainerId),
      retained: await Order.countDocuments({ _id: { $in: [completed._id, exhausted._id] }, trainerId: null }),
      audits: await TrainerTransfer.countDocuments({ fromTrainerId: f.lead._id, toTrainerId: f.trainer._id }),
      replayed: replay.replayed,
      contract: String((await Contract.findById(contract._id)).trainerId),
      checkin: await Checkin.countDocuments({ _id: checkin._id, orderId: legacy._id }),
    }).toEqual({ affected: 4, moved: 4, other: String(f.otherAdmin._id), retained: 2, audits: 1, replayed: true, contract: String(f.lead._id), checkin: 1 });
  });

  it.each(["null-to-explicit", "missing-to-null"])("rejects %s even when document version/time and effective lead are unchanged", async (change) => {
    const f = await fixture();
    const legacy = await createOrder(f.client, null);
    if (change === "missing-to-null") await Order.collection.updateOne({ _id: legacy._id }, { $unset: { trainerId: "" } });
    const input = transferInput(f);
    const preview = await buildTrainerTransferPreview(input);
    await Order.collection.updateOne({ _id: legacy._id }, { $set: { trainerId: change === "missing-to-null" ? null : f.lead._id } });
    await expect(execute(f, input, preview.previewToken)).rejects.toMatchObject({ code: "TRAINER_TRANSFER_STALE" });
    expect(await TrainerTransfer.countDocuments()).toBe(0);
  });

  it("allows only designated admin as unsubscribed destination without applying trainer plan capacity", async () => {
    const f = await fixture();
    await createOrder(f.client, f.trainer._id);
    for (let index = 0; index < 4; index += 1) {
      const { user } = await createTestUser({ email: `lead-client-${index}@example.com` });
      await createOrder(user, index % 2 ? f.lead._id : null);
    }
    const input = transferInput(f, { fromTrainerId: f.trainer._id, toTrainerId: f.lead._id });
    const preview = await buildTrainerTransferPreview(input);
    expect(preview.capacity).toMatchObject({ currentClients: 4, projectedClients: 5, maxClients: null, exceeded: false, unlimited: true });
    await execute(f, input, preview.previewToken);
    await expect(buildTrainerTransferPreview({ ...input, fromTrainerId: f.lead._id, toTrainerId: f.otherAdmin._id }))
      .rejects.toMatchObject({ code: "TARGET_TRAINER_INACTIVE" });
  });

  it("does not give null source assignments to another admin or an invalid/missing lead", async () => {
    const f = await fixture();
    await createOrder(f.client, null);
    await expect(buildTrainerTransferPreview(transferInput(f, { fromTrainerId: f.otherAdmin._id })))
      .rejects.toMatchObject({ code: "TRANSFER_SOURCE_ASSIGNMENT_NOT_FOUND" });
    for (const env of [{}, { DEFAULT_ADMIN_TRAINER_ID: "invalid" }, { DEFAULT_ADMIN_TRAINER_ID: String(f.trainer._id) }]) {
      vi.stubEnv("DEFAULT_ADMIN_TRAINER_ID", env.DEFAULT_ADMIN_TRAINER_ID || "");
      await expect(buildTrainerTransferPreview(transferInput(f)))
        .rejects.toMatchObject({ code: "TRANSFER_SOURCE_ASSIGNMENT_NOT_FOUND" });
      expect((await listActiveTrainerAssignments()).assignments).toEqual([]);
    }
    await User.deleteOne({ _id: f.lead._id });
    vi.stubEnv("DEFAULT_ADMIN_TRAINER_ID", String(f.lead._id));
    expect((await listActiveTrainerAssignments()).assignments).toEqual([]);
  });
});
