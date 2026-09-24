import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mongoose from "mongoose";
import request from "supertest";

vi.mock("../../utils/sendMail.js", () => ({
  sendContractMail: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import contractRoutes from "../../routes/contract.routes.js";
import Contract from "../../models/Contract.js";
import Order from "../../models/Order.js";
import NotificationPreference from "../../models/NotificationPreference.js";
import {
  createContract,
  CUSTOMER_EMAIL_CONSENT_TEXT,
} from "../../services/contract.service.js";

const SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+XgW+WQAAAABJRU5ErkJggg==";

let app;

const postAs = (path, token, body = {}) =>
  withAuth(request(app).post(path).send(body), token);

async function createFixture(status = "sent") {
  const client = await createTestUser({
    email: `contract-client-${Date.now()}@example.com`,
  });
  const trainer = await createTestUser({
    email: `contract-trainer-${Date.now()}@example.com`,
    role: "trainer",
  });
  const contract = await Contract.create({
    orderId: new mongoose.Types.ObjectId(),
    clientId: client.user._id,
    trainerId: trainer.user._id,
    trainerInfo: {
      name: trainer.user.name,
      birthYear: "1999",
      address: "TP. Hồ Chí Minh",
      phone: "0912345678",
      email: trainer.user.email,
    },
    clientInfo: {
      name: client.user.name,
      phone: "0901234567",
      email: client.user.email,
    },
    packageDetails: {
      packageName: "PT 10",
      sessions: 10,
      pricePerSession: 500000,
      totalAmount: 5000000,
      startDate: new Date("2026-08-03T00:00:00.000Z"),
      endDate: new Date("2026-09-03T00:00:00.000Z"),
    },
    customSections: [
      {
        title: "Điều khoản",
        items: ["Hai bên đồng ý thực hiện đúng hợp đồng."],
      },
    ],
    trainerSignature: SIGNATURE,
    status,
    auditTrail: [{ action: "sent" }],
  });
  return { client, trainer, contract };
}

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/contracts", contractRoutes);
  await Contract.init();
});

afterEach(async () => {
  vi.clearAllMocks();
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("contract handwritten signing", () => {
  it("requires the owner to view, consent and submit a bounded image", async () => {
    const { client, contract } = await createFixture("sent");

    const beforeView = await postAs(
      `/api/contracts/${contract._id}/sign`,
      client.accessToken,
      { signatureImage: SIGNATURE, acceptedTerms: true },
    );
    expect(beforeView.status).toBe(409);
    expect(beforeView.body.errorCode).toBe("CONTRACT_NOT_VIEWED");

    const viewed = await postAs(
      `/api/contracts/${contract._id}/view`,
      client.accessToken,
    );
    expect(viewed.status).toBe(200);
    expect(viewed.body.data.status).toBe("viewed");

    const missingConsent = await postAs(
      `/api/contracts/${contract._id}/sign`,
      client.accessToken,
      { signatureImage: SIGNATURE, acceptedTerms: false },
    );
    expect(missingConsent.status).toBe(400);

    const oversized = `data:image/png;base64,${"A".repeat(699052)}`;
    const oversizedResponse = await postAs(
      `/api/contracts/${contract._id}/sign`,
      client.accessToken,
      { signatureImage: oversized, acceptedTerms: true },
    );
    expect([400, 413]).toContain(oversizedResponse.status);

    const signed = await postAs(
      `/api/contracts/${contract._id}/sign`,
      client.accessToken,
      { signatureImage: SIGNATURE, acceptedTerms: true },
    );
    expect(signed.status).toBe(200);
    expect(signed.body.data.status).toBe("signed");

    const stored = await Contract.findById(contract._id);
    expect(stored.signatureImage).toBe(SIGNATURE);
    expect(stored.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.signedPdfFileId).toBeTruthy();
    expect(stored.auditTrail.map((entry) => entry.action)).toContain("viewed");
    expect(stored.auditTrail.map((entry) => entry.action)).toContain("signed");
    expect(
      await NotificationPreference.findOne({ recipientId: client.user._id }),
    ).toBeNull();
  });

  it("atomically enables customer email preferences when the signed contract contains consent", async () => {
    const { client, contract } = await createFixture("viewed");
    await Contract.updateOne(
      { _id: contract._id },
      {
        $set: {
          customSections: [{
            title: "Điều khoản email",
            content: "",
            items: [CUSTOMER_EMAIL_CONSENT_TEXT],
          }],
        },
      },
    );

    const signed = await postAs(
      `/api/contracts/${contract._id}/sign`,
      client.accessToken,
      { signatureImage: SIGNATURE, acceptedTerms: true },
    );
    const preference = await NotificationPreference.findOne({
      recipientId: client.user._id,
    }).lean();

    expect(signed.status).toBe(200);
    expect(preference).toMatchObject({
      morningHealthEmail: true,
      checkinEmail: true,
      customerEmailConfigured: true,
      revision: 1,
    });
  });

  it("records the effective lead coach rather than the admin operator for a legacy order", async () => {
    const lead = await createTestUser({
      role: "admin",
      email: "contract-lead@example.com",
    });
    const operator = await createTestUser({
      role: "admin",
      email: "contract-operator@example.com",
    });
    const client = await createTestUser({
      email: "contract-legacy-client@example.com",
    });
    const priorLead = process.env.DEFAULT_ADMIN_TRAINER_ID;
    process.env.DEFAULT_ADMIN_TRAINER_ID = String(lead.user._id);
    try {
      const order = await Order.create({
        userId: client.user._id,
        name: client.user.name,
        email: client.user.email,
        package: "PT 10",
        sessions: 10,
        totalSessions: 10,
        status: "approved",
      });

      const contract = await createContract(
        order._id,
        operator.user._id,
        "127.0.0.1",
        "vitest",
      );

      expect(String(contract.trainerId)).toBe(String(lead.user._id));
    } finally {
      if (priorLead === undefined) delete process.env.DEFAULT_ADMIN_TRAINER_ID;
      else process.env.DEFAULT_ADMIN_TRAINER_ID = priorLead;
    }
  });

  it("requires Party A's signature before an admin can issue the contract", async () => {
    const { contract } = await createFixture("draft");
    await Contract.updateOne(
      { _id: contract._id },
      { $unset: { trainerSignature: 1 } },
    );
    const admin = await createTestUser({
      email: "contract-admin@example.com",
      role: "admin",
    });

    const unsignedSend = await postAs(
      `/api/contracts/${contract._id}/send`,
      admin.accessToken,
    );
    expect(unsignedSend.status).toBe(400);

    const updated = await withAuth(
      request(app)
        .put(`/api/contracts/${contract._id}`)
        .send({ trainerSignature: SIGNATURE }),
      admin.accessToken,
    );
    expect(updated.status).toBe(200);

    const issued = await postAs(
      `/api/contracts/${contract._id}/send`,
      admin.accessToken,
    );
    expect(issued.status).toBe(200);
    expect(issued.body.data.status).toBe("sent");
  });

  it("does not reveal or sign another client's contract", async () => {
    const { contract } = await createFixture("viewed");
    const stranger = await createTestUser({
      email: "contract-stranger@example.com",
    });

    const response = await postAs(
      `/api/contracts/${contract._id}/sign`,
      stranger.accessToken,
      { signatureImage: SIGNATURE, acceptedTerms: true },
    );

    expect(response.status).toBe(404);
    expect(response.body.errorCode).toBe("CONTRACT_NOT_FOUND");
    expect((await Contract.findById(contract._id)).status).toBe("viewed");
  });

  it("allows only one atomic signing request to complete", async () => {
    const { client, contract } = await createFixture("viewed");

    const responses = await Promise.all([
      postAs(`/api/contracts/${contract._id}/sign`, client.accessToken, {
        signatureImage: SIGNATURE,
        acceptedTerms: true,
      }),
      postAs(`/api/contracts/${contract._id}/sign`, client.accessToken, {
        signatureImage: SIGNATURE,
        acceptedTerms: true,
      }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200,
      409,
    ]);
    expect((await Contract.findById(contract._id)).status).toBe("signed");
  });
});
