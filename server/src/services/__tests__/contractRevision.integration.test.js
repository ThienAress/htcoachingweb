import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDB, teardownTestDB, clearCollections } from "../../__tests__/setup.js";
import Contract from "../../models/Contract.js";
import { updateContractDetails, sendToClient, markAsViewed, cancelContract } from "../contract.service.js";

beforeAll(setupTestDB);
afterAll(teardownTestDB);
afterEach(async () => { vi.restoreAllMocks(); await clearCollections(); });

async function fixture() {
  return Contract.create({
    orderId: new mongoose.Types.ObjectId(), clientId: new mongoose.Types.ObjectId(),
    trainerId: new mongoose.Types.ObjectId(), clientInfo: { name: "Original" },
    trainerSignature: "signed-owner", status: "draft",
  });
}

describe("contract revision CAS", () => {
  it("allows exactly one of two editors using the same revision", async () => {
    const contract = await fixture();
    const results = await Promise.allSettled(["First", "Second"].map(name =>
      updateContractDetails(contract._id, { expectedRevision: 0, clientInfo: { name } }, { trainerId: contract.trainerId }),
    ));
    expect(results.map(r => r.status).sort()).toEqual(["fulfilled", "rejected"]);
  });
  it("rejects stale send after edit without changing the draft", async () => {
    const contract = await fixture();
    await updateContractDetails(contract._id, { expectedRevision: 0, clientInfo: { name: "New" } });
    await expect(sendToClient(contract._id, "127.0.0.1", "test", { expectedRevision: 0 }))
      .rejects.toMatchObject({ code: "CONTRACT_REVISION_CONFLICT", statusCode: 409 });
  });
  it("rejects delayed edit after send without changing issued terms", async () => {
    const contract = await fixture();
    await sendToClient(contract._id, "", "", { expectedRevision: 0 });
    await expect(updateContractDetails(contract._id, { expectedRevision: 0, clientInfo: { name: "Late" } }))
      .rejects.toMatchObject({ code: "CONTRACT_REVISION_CONFLICT", statusCode: 409 });
    expect((await Contract.findById(contract._id)).clientInfo.name).toBe("Original");
  });
  it("does not let a delayed view resurrect a cancelled contract", async () => {
    const contract = await fixture();
    await sendToClient(contract._id, "", "", { expectedRevision: 0 });
    const read = Contract.collection.findOne.bind(Contract.collection);
    const update = Contract.collection.findOneAndUpdate.bind(Contract.collection);
    let cancelled = false;
    const delayResponse = (operation) => async (...args) => {
      const snapshot = await operation(...args);
      if (!cancelled) {
        cancelled = true;
        await cancelContract(contract._id, "", "");
      }
      return snapshot;
    };
    vi.spyOn(Contract.collection, "findOne").mockImplementation(delayResponse(read));
    vi.spyOn(Contract.collection, "findOneAndUpdate").mockImplementation(delayResponse(update));
    await markAsViewed(contract._id, contract.clientId, "", "");
    vi.restoreAllMocks();
    expect((await Contract.findById(contract._id)).status).toBe("cancelled");
  });
});
