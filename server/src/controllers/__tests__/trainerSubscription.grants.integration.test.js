import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

vi.mock("../../utils/sendMail.js", () => ({
  sendTrainerGrantInvitationMail: vi.fn().mockResolvedValue(undefined),
  sendTrainerSubscriptionActivatedMail: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import trainerSubscriptionRoutes from "../../routes/trainerSubscription.routes.js";
import TrainerSubscription from "../../models/TrainerSubscription.js";
import TrainerTrialClaim from "../../models/TrainerTrialClaim.js";
import PendingTrainerGrant from "../../models/PendingTrainerGrant.js";
import User from "../../models/User.js";
import { claimPendingTrainerGrantForUser } from "../../services/trainerSubscriptionGrant.service.js";
import {
  sendTrainerGrantInvitationMail,
  sendTrainerSubscriptionActivatedMail,
} from "../../utils/sendMail.js";

let app;

const postAs = (path, token, body = {}) =>
  withAuth(request(app).post(path).send(body), token);

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/trainer-subscriptions", trainerSubscriptionRoutes);
  await Promise.all([
    TrainerSubscription.init(),
    TrainerTrialClaim.init(),
    PendingTrainerGrant.init(),
  ]);
});

afterEach(async () => {
  vi.clearAllMocks();
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("trainer subscription grants", () => {
  it("lets an admin grant immediately to an existing user", async () => {
    const admin = await createTestUser({
      email: "grant-admin@example.com",
      role: "admin",
    });
    const trainer = await createTestUser({ email: "trainer-ready@example.com" });

    const response = await postAs(
      "/api/trainer-subscriptions/admin/grants",
      admin.accessToken,
      {
        email: trainer.user.email,
        planCode: "standard",
        billingCycle: "month",
      },
    );

    const subscription = await TrainerSubscription.findOne({
      userId: trainer.user._id,
      isActive: true,
    });
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("activated");
    expect(subscription.planCode).toBe("standard");
    expect(subscription.source).toBe("admin_grant");
    expect(sendTrainerSubscriptionActivatedMail).toHaveBeenCalledTimes(1);
  });

  it("stores an unknown email as pending and claims it after verified login", async () => {
    const admin = await createTestUser({
      email: "pending-admin@example.com",
      role: "admin",
    });

    const granted = await postAs(
      "/api/trainer-subscriptions/admin/grants",
      admin.accessToken,
      {
        email: " Future.Trainer@Example.com ",
        planCode: "professional",
        billingCycle: "year",
      },
    );
    expect(granted.status).toBe(201);
    expect(granted.body.data.status).toBe("pending");
    expect(sendTrainerGrantInvitationMail).toHaveBeenCalledTimes(1);

    const user = await User.create({
      name: "Future Trainer",
      email: "future.trainer@example.com",
      role: "user",
    });
    const claimed = await claimPendingTrainerGrantForUser(user);
    const pending = await PendingTrainerGrant.findOne({
      normalizedEmail: user.email,
    });

    expect(claimed?.planCode).toBe("professional");
    expect(pending.status).toBe("claimed");
    expect(pending.claimedBy.toString()).toBe(user._id.toString());
    expect(sendTrainerSubscriptionActivatedMail).toHaveBeenCalledTimes(1);
  });

  it("does not let a direct grant bypass an older pending grant", async () => {
    const admin = await createTestUser({
      email: "pending-conflict-admin@example.com",
      role: "admin",
    });
    await postAs(
      "/api/trainer-subscriptions/admin/grants",
      admin.accessToken,
      {
        email: "pending-conflict@example.com",
        planCode: "standard",
        billingCycle: "month",
      },
    );
    const trainer = await User.create({
      name: "Pending Conflict",
      email: "pending-conflict@example.com",
      role: "user",
    });

    const response = await postAs(
      "/api/trainer-subscriptions/admin/grants",
      admin.accessToken,
      {
        email: trainer.email,
        planCode: "premium",
        billingCycle: "year",
      },
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PENDING_TRAINER_GRANT_EXISTS");
    expect(
      await TrainerSubscription.countDocuments({ userId: trainer._id }),
    ).toBe(0);
  });

  it("does not create a pending Free grant for an email that already used Free", async () => {
    const admin = await createTestUser({
      email: "free-grant-admin@example.com",
      role: "admin",
    });
    const normalizedEmail = "former-trial@example.com";
    await TrainerTrialClaim.create({
      normalizedEmail,
      userId: admin.user._id,
      source: "free_trial",
    });

    const response = await postAs(
      "/api/trainer-subscriptions/admin/grants",
      admin.accessToken,
      {
        email: normalizedEmail,
        planCode: "free",
        billingCycle: "trial",
      },
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("FREE_TRIAL_ALREADY_USED");
    expect(
      await PendingTrainerGrant.countDocuments({ normalizedEmail }),
    ).toBe(0);
  });

  it("rejects admin grant operations from a normal user", async () => {
    const actor = await createTestUser({ email: "not-admin@example.com" });

    const response = await postAs(
      "/api/trainer-subscriptions/admin/grants",
      actor.accessToken,
      {
        email: "someone@example.com",
        planCode: "standard",
        billingCycle: "month",
      },
    );

    expect(response.status).toBe(403);
  });
});
