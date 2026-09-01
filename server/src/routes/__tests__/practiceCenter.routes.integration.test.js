import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { clearCollections, createTestApp, createTestUser, setupTestDB, teardownTestDB, withAuth } from "../../__tests__/setup.js";
import Checkin from "../../models/Checkin.js";
import Order from "../../models/Order.js";
import PracticeEmailDelivery from "../../models/PracticeEmailDelivery.js";
import ServiceUsageBucket from "../../models/ServiceUsageBucket.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import { sendPracticeCenterMail } from "../../utils/sendMail.js";
import practiceCenterRoutes from "../practiceCenter.routes.js";

vi.mock("../../utils/sendMail.js", () => ({
  sendPracticeCenterMail: vi.fn().mockResolvedValue({ providerMessageId: "practice-test" }),
}));

let app;
let sequence = 0;
const requestId = () =>
  `a0000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/practice-center", practiceCenterRoutes);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.mocked(sendPracticeCenterMail).mockReset();
  vi.mocked(sendPracticeCenterMail).mockResolvedValue({
    providerMessageId: "practice-test",
  });
  await clearCollections();
});

afterAll(teardownTestDB);

const activateTrainerSubscription = (userId) =>
  TrainerSubscription.create({
    userId,
    planTitle: "Gói HLV kiểm thử",
    billingCycle: "month",
    amount: 0,
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 86_400_000),
    status: "active",
    isActive: true,
  });

describe("Practice Center routes", () => {
  it("returns the authenticated recipient and canonical trainer quota", async () => {
    const trainer = await createTestUser({
      email: "practice-state@example.com",
      role: "trainer",
    });

    const response = await withAuth(
      request(app).get("/api/practice-center"),
      trainer.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.data).toMatchObject({
      recipient: "practice-state@example.com",
      quota: {
        serviceKey: "practice_email",
        tier: "trainer",
        limit: 2,
        remaining: 2,
      },
    });
  });

  it("returns the separate canonical admin quota", async () => {
    const admin = await createTestUser({
      email: "practice-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get("/api/practice-center"),
      admin.accessToken,
    );

    expect(response.body.data.quota).toMatchObject({
      tier: "admin",
      limit: 10,
      remaining: 10,
    });
  });

  it("allows an active trainer subscriber but denies an ordinary user", async () => {
    const subscriber = await createTestUser({
      email: "practice-subscriber@example.com",
    });
    const ordinary = await createTestUser({
      email: "practice-ordinary@example.com",
    });
    await activateTrainerSubscription(subscriber.user._id);

    const [allowed, denied] = await Promise.all([
      withAuth(request(app).get("/api/practice-center"), subscriber.accessToken),
      withAuth(request(app).get("/api/practice-center"), ordinary.accessToken),
    ]);

    expect({ allowed: allowed.status, denied: denied.status }).toEqual({
      allowed: 200,
      denied: 403,
    });
  });

  it("denies a cancelled subscription even if a stale active flag remains", async () => {
    const user = await createTestUser({
      email: "practice-cancelled-stale@example.com",
    });
    await TrainerSubscription.create({
      userId: user.user._id,
      planTitle: "Gói đã hủy",
      billingCycle: "month",
      amount: 0,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 86_400_000),
      status: "cancelled",
      isActive: true,
    });

    const response = await withAuth(
      request(app).get("/api/practice-center"),
      user.accessToken,
    );

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("PRACTICE_CENTER_ACCESS_DENIED");
  });

  it("sends only to the login email and rejects recipient injection", async () => {
    const trainer = await createTestUser({
      email: "practice-owner@example.com",
      role: "trainer",
      name: "HLV Thực hành",
    });

    const rejected = await withAuth(
      request(app).post("/api/practice-center/send").send({
        scenario: "order",
        requestId: requestId(),
        recipient: "attacker@example.com",
      }),
      trainer.accessToken,
    );
    const sent = await withAuth(
      request(app).post("/api/practice-center/send").send({
        scenario: "order",
        requestId: requestId(),
      }),
      trainer.accessToken,
    );

    expect(rejected.status).toBe(400);
    expect(sent.status).toBe(200);
    expect(sendPracticeCenterMail).toHaveBeenCalledTimes(1);
    expect(sendPracticeCenterMail).toHaveBeenCalledWith(
      "practice-owner@example.com",
      expect.objectContaining({ scenario: "order", name: "HLV Thực hành" }),
    );
  });

  it("requires CSRF and replays a completed request without another delivery", async () => {
    const trainer = await createTestUser({
      email: "practice-csrf-replay@example.com",
      role: "trainer",
    });
    const replayId = requestId();
    const withoutCsrf = await request(app)
      .post("/api/practice-center/send")
      .set("Cookie", [
        `accessToken=${trainer.accessToken}`,
        "csrfToken=test-csrf-token",
      ])
      .send({ scenario: "order", requestId: requestId() });
    const first = await withAuth(
      request(app).post("/api/practice-center/send").send({
        scenario: "order",
        requestId: replayId,
      }),
      trainer.accessToken,
    );
    const replayed = await withAuth(
      request(app).post("/api/practice-center/send").send({
        scenario: "order",
        requestId: replayId,
      }),
      trainer.accessToken,
    );

    expect({
      withoutCsrf: withoutCsrf.status,
      first: first.status,
      replayed: replayed.status,
      replayCode: replayed.body.code,
      deliveries: vi.mocked(sendPracticeCenterMail).mock.calls.length,
    }).toEqual({
      withoutCsrf: 403,
      first: 200,
      replayed: 200,
      replayCode: undefined,
      deliveries: 1,
    });
  });

  it("consumes two units for a journey without creating Order or Checkin records", async () => {
    const trainer = await createTestUser({
      email: "practice-journey-route@example.com",
      role: "trainer",
    });

    const response = await withAuth(
      request(app).post("/api/practice-center/send").send({
        scenario: "journey",
        requestId: requestId(),
      }),
      trainer.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.quota.remaining).toBe(0);
    expect(sendPracticeCenterMail).toHaveBeenCalledTimes(2);
    expect(await Promise.all([Order.countDocuments(), Checkin.countDocuments()])).toEqual([
      0,
      0,
    ]);
  });

  it("returns 429 quota metadata after the trainer uses two simulations", async () => {
    const trainer = await createTestUser({
      email: "practice-limit@example.com",
      role: "trainer",
    });
    const send = () =>
      withAuth(
        request(app).post("/api/practice-center/send").send({
          scenario: "checkin",
          requestId: requestId(),
        }),
        trainer.accessToken,
      );

    await send();
    await send();
    const limited = await send();

    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({
      success: false,
      code: "PRACTICE_EMAIL_QUOTA_EXCEEDED",
      meta: {
        quota: {
          serviceKey: "practice_email",
          limit: 2,
          remaining: 0,
        },
      },
    });
  });

  it("refunds the reservation when the email provider fails", async () => {
    const trainer = await createTestUser({
      email: "practice-refund@example.com",
      role: "trainer",
    });
    vi.mocked(sendPracticeCenterMail).mockRejectedValueOnce(
      Object.assign(new Error("provider unavailable"), {
        code: "PRACTICE_EMAIL_PROVIDER_FAILED",
      }),
    );
    const send = () =>
      withAuth(
        request(app).post("/api/practice-center/send").send({
          scenario: "order",
          requestId: requestId(),
        }),
        trainer.accessToken,
      );

    const failed = await send();
    const first = await send();
    const second = await send();

    expect({
      failed: failed.status,
      failedRemaining: failed.body.meta.quota.remaining,
      remaining: [first.body.data.quota.remaining, second.body.data.quota.remaining],
    }).toEqual({
      failed: 502,
      failedRemaining: 2,
      remaining: [1, 0],
    });
  });

  it("reports partial journey delivery and retries only the missing email", async () => {
    const trainer = await createTestUser({
      email: "practice-partial@example.com",
      role: "trainer",
    });
    const journeyRequestId = requestId();
    vi.mocked(sendPracticeCenterMail)
      .mockResolvedValueOnce({ providerMessageId: "order-sent" })
      .mockRejectedValueOnce(
        Object.assign(new Error("provider unavailable"), {
          code: "PRACTICE_EMAIL_PROVIDER_FAILED",
        }),
      )
      .mockResolvedValueOnce({ providerMessageId: "checkin-sent" });
    const send = () =>
      withAuth(
        request(app).post("/api/practice-center/send").send({
          scenario: "journey",
          requestId: journeyRequestId,
        }),
        trainer.accessToken,
      );

    const partial = await send();
    expect(partial.status).toBe(502);
    expect(partial.body).toMatchObject({
      code: "PRACTICE_EMAIL_PARTIAL_DELIVERY",
      data: { sent: ["order"], pending: ["checkin"] },
      meta: { quota: { remaining: 1 } },
    });

    const completed = await send();
    expect(completed.status).toBe(200);
    expect(completed.body.data).toMatchObject({
      sent: ["order", "checkin"],
      quota: { remaining: 0 },
    });
    expect(vi.mocked(sendPracticeCenterMail).mock.calls).toEqual([
      [trainer.user.email, expect.objectContaining({ scenario: "order" })],
      [trainer.user.email, expect.objectContaining({ scenario: "checkin" })],
      [trainer.user.email, expect.objectContaining({ scenario: "checkin" })],
    ]);
  });

  it("recovers a stale delivery with the same provider idempotency key", async () => {
    const trainer = await createTestUser({
      email: "practice-stale-recovery@example.com",
      role: "trainer",
    });
    const staleRequestId = requestId();
    const send = () =>
      withAuth(
        request(app).post("/api/practice-center/send").send({
          scenario: "order",
          requestId: staleRequestId,
        }),
        trainer.accessToken,
      );

    const first = await send();
    await PracticeEmailDelivery.updateOne(
      { userId: trainer.user._id, requestId: staleRequestId },
      {
        $set: {
          "deliveries.0.status": "processing",
          "deliveries.0.claimedAt": new Date(Date.now() - 11 * 60 * 1000),
          "deliveries.0.deliveredAt": null,
          "deliveries.0.providerMessageId": "",
          completedAt: null,
        },
      },
    );
    vi.mocked(sendPracticeCenterMail).mockClear();

    const recovered = await send();

    expect(first.status).toBe(200);
    expect(recovered.status).toBe(200);
    expect(recovered.body.data.quota.remaining).toBe(1);
    expect(sendPracticeCenterMail).toHaveBeenCalledWith(
      trainer.user.email,
      expect.objectContaining({
        scenario: "order",
        requestId: staleRequestId,
      }),
    );
  });

  it("fails closed without claiming a refund when quota rollback is unconfirmed", async () => {
    const trainer = await createTestUser({
      email: "practice-refund-unconfirmed@example.com",
      role: "trainer",
    });
    const failedRequestId = requestId();
    vi.mocked(sendPracticeCenterMail).mockImplementationOnce(async () => {
      vi.spyOn(ServiceUsageBucket, "findOneAndUpdate").mockRejectedValueOnce(
        new Error("refund storage unavailable"),
      );
      throw Object.assign(new Error("provider unavailable"), {
        code: "PRACTICE_EMAIL_PROVIDER_FAILED",
      });
    });

    const response = await withAuth(
      request(app).post("/api/practice-center/send").send({
        scenario: "order",
        requestId: failedRequestId,
      }),
      trainer.accessToken,
    );
    const delivery = await PracticeEmailDelivery.findOne({
      userId: trainer.user._id,
      requestId: failedRequestId,
    }).lean();

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      code: "PRACTICE_REFUND_UNCONFIRMED",
      meta: { quota: { remaining: 1 } },
      data: { sent: [], pending: [], unknown: ["order"] },
    });
    expect(delivery.deliveries[0].status).toBe("unknown");
  });
});
