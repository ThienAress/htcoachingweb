import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
vi.mock("../../utils/sendMail.js", () => ({ sendContractMail: vi.fn().mockResolvedValue(undefined) }));
import { setupTestDB, teardownTestDB, clearCollections, createTestApp, createTestUser, withAuth } from "../../__tests__/setup.js";
import Contract from "../../models/Contract.js";
import contractRoutes from "../../routes/contract.routes.js";

let app;
beforeAll(async () => { await setupTestDB(); app = createTestApp(); app.use("/api/contracts", contractRoutes); });
afterAll(teardownTestDB);
afterEach(clearCollections);

async function fixture() {
  const { user, accessToken } = await createTestUser({ role: "admin" });
  const contract = await Contract.create({
    orderId: new mongoose.Types.ObjectId(), clientId: new mongoose.Types.ObjectId(), trainerId: user._id,
    clientInfo: { name: "Original" }, trainerSignature: "existing-owner-signature", status: "draft",
  });
  const edit = body => withAuth(request(app).put(`/api/contracts/${contract._id}`).send(body), accessToken);
  const send = body => withAuth(request(app).post(`/api/contracts/${contract._id}/send`).send(body), accessToken);
  return { contract, edit, send };
}

describe("contract lifecycle HTTP concurrency", () => {
  it("returns one winner and a stable conflict for simultaneous editors", async () => {
    const { edit } = await fixture();
    const results = await Promise.all([edit({ expectedRevision: 0, clientInfo: { name: "First" } }), edit({ expectedRevision: 0, clientInfo: { name: "Second" } })]);
    expect(results.map(row => [row.status, row.body.errorCode || row.body.data.revision]).sort())
      .toEqual([[200, 1], [409, "CONTRACT_REVISION_CONFLICT"]]);
  });

  it("rejects delayed edit after issue without changing the issued snapshot", async () => {
    const { contract, edit, send } = await fixture();
    const sent = await send({ expectedRevision: 0 });
    const delayed = await edit({ expectedRevision: 0, clientInfo: { name: "Late" } });
    const stored = await Contract.findById(contract._id);
    expect({ sentRevision: sent.body.data?.revision, status: delayed.status, code: delayed.body.errorCode, name: stored.clientInfo.name })
      .toEqual({ sentRevision: 1, status: 409, code: "CONTRACT_REVISION_CONFLICT", name: "Original" });
  });

  it("rejects stale send after edit", async () => {
    const { edit, send } = await fixture();
    await edit({ expectedRevision: 0, clientInfo: { name: "New" } });
    const result = await send({ expectedRevision: 0 });
    expect({ status: result.status, code: result.body.errorCode }).toEqual({ status: 409, code: "CONTRACT_REVISION_CONFLICT" });
  });

  it.each([undefined, -1, "0", 0.5, Number.MAX_SAFE_INTEGER])("rejects invalid expectedRevision %s before mutation", async expectedRevision => {
    const { edit } = await fixture();
    const result = await edit({ expectedRevision, clientInfo: { name: "Rejected" } });
    expect({ status: result.status, code: result.body.errorCode }).toEqual({ status: 400, code: "CONTRACT_REVISION_INVALID" });
  });

  it("accepts missing legacy revision only once as zero", async () => {
    const { contract, edit } = await fixture();
    await Contract.collection.updateOne({ _id: contract._id }, { $unset: { revision: 1 } });
    const first = await edit({ expectedRevision: 0 });
    const replay = await edit({ expectedRevision: 0 });
    expect([first.body.data?.revision, replay.status]).toEqual([1, 409]);
  });
});
