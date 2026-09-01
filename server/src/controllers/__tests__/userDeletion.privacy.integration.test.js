import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { protect } from "../../middlewares/auth.middleware.js";
import { csrfProtection } from "../../middlewares/csrf.js";
import AiModerationState from "../../models/AiModerationState.js";
import AiToolConfirmation from "../../models/AiToolConfirmation.js";
import AccountDeletionMediaJob from "../../models/AccountDeletionMediaJob.js";
import AccountDeletionRecord from "../../models/AccountDeletionRecord.js";
import AuditLog from "../../models/AuditLog.js";
import Booking from "../../models/Booking.js";
import ChatConversation from "../../models/ChatConversation.js";
import Checkin from "../../models/Checkin.js";
import CoachingDay from "../../models/CoachingDay.js";
import Contract from "../../models/Contract.js";
import DepositRequest from "../../models/DepositRequest.js";
import ExerciseReview from "../../models/ExerciseReview.js";
import FitnessSubscription from "../../models/FitnessSubscription.js";
import F1Assessment from "../../models/F1Assessment.js";
import F1Customer from "../../models/F1Customer.js";
import F1DataDeletionJob from "../../models/F1DataDeletionJob.js";
import F1Intake from "../../models/F1Intake.js";
import Order from "../../models/Order.js";
import PracticeEmailDelivery from "../../models/PracticeEmailDelivery.js";
import RecipeReview from "../../models/RecipeReview.js";
import ServiceUsageBucket from "../../models/ServiceUsageBucket.js";
import TrainerTransfer from "../../models/TrainerTransfer.js";
import TrainerTransferLock from "../../models/TrainerTransferLock.js";
import TrainerTrialClaim from "../../models/TrainerTrialClaim.js";
import TrainingSchedule from "../../models/TrainingSchedule.js";
import TrainingScheduleCommand from "../../models/TrainingScheduleCommand.js";
import TrainingSlotClaim from "../../models/TrainingSlotClaim.js";
import User from "../../models/User.js";
import Wallet from "../../models/Wallet.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import WorkoutPlan from "../../models/WorkoutPlan.js";
import { deleteUser } from "../user.controller.js";
import {
  enqueueAccountDeletionMedia,
  processAccountDeletionMediaJobs,
} from "../../services/accountDeletionMedia.service.js";
import { processF1DataDeletionBatch } from "../../services/f1PrivacyLifecycle.service.js";
import {
  resetCoachingPrivateMediaAdapterForTests,
  setCoachingPrivateMediaAdapterForTests,
} from "../../services/coachingPrivateMedia.service.js";

let app;
let destroyedStorageKeys;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.delete("/api/users/:id", protect, csrfProtection, deleteUser);
});

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  destroyedStorageKeys = [];
  setCoachingPrivateMediaAdapterForTests({
    async destroy(storageKey) {
      destroyedStorageKeys.push(storageKey);
      return { result: "ok" };
    },
  });
});

afterEach(async () => {
  resetCoachingPrivateMediaAdapterForTests();
  await clearCollections();
});
afterAll(teardownTestDB);

const createPersonalInventory = async ({ user, trainer, order }) => {
  const schedule = await TrainingSchedule.create({
    trainerId: trainer._id,
    clientId: user._id,
    clientName: user.name,
    occurrenceDateKey: "2026-09-01",
    startAt: new Date("2026-09-01T01:00:00.000Z"),
    endAt: new Date("2026-09-01T02:00:00.000Z"),
    dayOfWeek: 2,
    startTime: "08:00",
    endTime: "09:00",
    exerciseType: "Strength",
    expiresAt: new Date("2027-09-01T00:00:00.000Z"),
  });

  await Promise.all([
    ChatConversation.create({
      userId: user._id,
      title: "Private conversation",
      messages: [{ role: "user", content: "sensitive" }],
    }),
    CoachingDay.create({
      userId: user._id,
      trainerId: trainer._id,
      dateString: "2026-09-01",
      date: new Date("2026-09-01T00:00:00.000Z"),
      title: "Private coaching",
      exercises: [
        {
          name: "Squat",
          clientFeedbackVideo: {
            provider: "cloudinary",
            storageKey:
              "htcoaching/coaching-feedback-private/account-delete-video",
            resourceType: "video",
            deliveryType: "authenticated",
            format: "mp4",
          },
        },
      ],
    }),
    WorkoutPlan.create({
      trainerId: trainer._id,
      clientId: user._id,
      clientName: user.name,
      clientEmail: user.email,
      title: "Private workout",
      planDate: new Date("2026-09-01T00:00:00.000Z"),
      sections: [{ name: "WARM UP", exercises: [] }],
    }),
    Checkin.create({
      orderId: order._id,
      clientRequestId: "account-delete-checkin",
      name: user.name,
      package: "ONLINE",
      time: new Date(),
      muscle: "Legs",
      remainingSessions: 7,
    }),
    TrainingSlotClaim.create({
      scheduleId: schedule._id,
      trainerId: trainer._id,
      clientId: user._id,
      occurrenceDateKey: "2026-09-01",
      slotStartAt: new Date("2026-09-01T01:00:00.000Z"),
    }),
    TrainingScheduleCommand.create({
      actorId: user._id,
      requestId: "account-delete-schedule",
      commandType: "create",
      payloadFingerprint: "a".repeat(64),
      scheduleId: schedule._id,
      responseRevision: 0,
    }),
    ExerciseReview.create({
      exerciseId: new mongoose.Types.ObjectId(),
      userId: user._id,
      rating: 5,
      comment: "Private exercise review",
    }),
    RecipeReview.create({
      recipeId: new mongoose.Types.ObjectId(),
      userId: user._id,
      rating: 4,
      comment: "Private recipe review",
    }),
    ServiceUsageBucket.create({
      _id: "account-delete-usage",
      serviceKey: "ai_chat",
      actorKind: "user",
      userId: user._id,
      tier: "user",
    }),
    AiModerationState.create({ userId: user._id, warnings: 1 }),
    AiToolConfirmation.create({
      _id: "account-delete-confirmation",
      userId: user._id,
      toolName: "test_tool",
      parameters: { private: true },
      expiresAt: new Date(Date.now() + 60_000),
    }),
    Booking.create({
      name: user.name,
      phone: "0912345678",
      email: user.email,
      gym: "Home",
      schedule: "Morning",
      package: "ONLINE",
      sessions: 8,
      userId: user._id,
      clientRequestId: "account-delete-booking",
      requestFingerprint: "b".repeat(64),
    }),
    TrainerTrialClaim.create({
      normalizedEmail: user.email,
      userId: user._id,
    }),
    PracticeEmailDelivery.create({
      userId: user._id,
      requestId: "00000000-0000-4000-8000-000000000001",
      scenario: "order",
      deliveries: [{ key: "order", status: "sent" }],
    }),
  ]);
};

const createRetainedInventory = async ({ user, trainer, nextTrainer, admin, order }) => {
  const wallet = await Wallet.create({ userId: user._id, balance: 100_000 });
  await Promise.all([
    Contract.create({
      orderId: order._id,
      clientId: user._id,
      trainerId: trainer._id,
      clientInfo: { name: user.name, email: user.email },
      status: "signed",
      signatureImage: "retained-signature",
      signedAt: new Date(),
    }),
    DepositRequest.create({
      userId: user._id,
      amount: 100_000,
      depositCode: "HTC-DELETE-KEEP",
      status: "success",
      expiresAt: new Date(Date.now() + 60_000),
      paidAt: new Date(),
    }),
    WalletTransaction.create({
      userId: user._id,
      walletId: wallet._id,
      type: "deposit",
      amount: 100_000,
      balanceBefore: 0,
      balanceAfter: 100_000,
      status: "success",
      idempotencyKey: "account-delete-retained-ledger",
    }),
    FitnessSubscription.create({
      userId: user._id,
      planCode: "fitness_plus_essential",
      planTitle: "Nền tảng",
      billingCycle: "month",
      source: "self_purchase",
      amount: 99_000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "active",
    }),
    AuditLog.create({
      actorId: user._id,
      actorRole: "user",
      action: "assign_order_trainer",
      targetType: "order",
      targetId: order._id,
      metadata: { toTrainerId: String(trainer._id) },
    }),
    TrainerTransfer.create({
      requestId: "account-delete-retained-transfer",
      clientId: user._id,
      fromTrainerId: trainer._id,
      toTrainerId: nextTrainer._id,
      requestedBy: admin._id,
      reason: "Giữ nhật ký chuyển giao để chờ policy pseudonymization",
      previewToken: "a".repeat(64),
      affected: { orders: 1 },
      retained: { checkins: 0 },
      completedAt: new Date(),
    }),
    TrainerTransferLock.create({ _id: user._id, revision: 1 }),
  ]);
};

describe("canonical account deletion privacy inventory", () => {
  it("deletes personal, health and content records in one account command", async () => {
    const owner = await createTestUser({
      email: "account-delete-owner@example.com",
    });
    const trainer = await createTestUser({
      role: "trainer",
      email: "account-delete-trainer@example.com",
    });
    const admin = await createTestUser({
      role: "admin",
      email: "account-delete-admin@example.com",
    });
    const order = await Order.create({
      userId: owner.user._id,
      trainerId: trainer.user._id,
      name: owner.user.name,
      email: owner.user.email,
      package: "ONLINE",
      sessions: 8,
      totalSessions: 8,
      status: "approved",
    });
    await createPersonalInventory({
      user: owner.user,
      trainer: trainer.user,
      order,
    });

    const response = await withAuth(
      request(app).delete(`/api/users/${owner.user._id}`),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    await expect(
      Promise.all([
        User.countDocuments({ _id: owner.user._id }),
        ChatConversation.countDocuments({ userId: owner.user._id }),
        CoachingDay.countDocuments({ userId: owner.user._id }),
        WorkoutPlan.countDocuments({ clientId: owner.user._id }),
        Checkin.countDocuments({ orderId: order._id }),
        TrainingSchedule.countDocuments({ clientId: owner.user._id }),
        TrainingSlotClaim.countDocuments({ clientId: owner.user._id }),
        TrainingScheduleCommand.countDocuments({ actorId: owner.user._id }),
        ExerciseReview.countDocuments({ userId: owner.user._id }),
        RecipeReview.countDocuments({ userId: owner.user._id }),
        ServiceUsageBucket.countDocuments({ userId: owner.user._id }),
        AiModerationState.countDocuments({ userId: owner.user._id }),
        AiToolConfirmation.countDocuments({ userId: owner.user._id }),
        Booking.countDocuments({ userId: owner.user._id }),
        TrainerTrialClaim.countDocuments({ userId: owner.user._id }),
        PracticeEmailDelivery.countDocuments({ userId: owner.user._id }),
        AccountDeletionRecord.countDocuments({
          targetUserId: owner.user._id,
        }),
        AccountDeletionMediaJob.countDocuments({
          targetUserId: owner.user._id,
          status: "pending",
        }),
      ]),
    ).resolves.toEqual([...Array(16).fill(0), 1, 1]);
    expect(destroyedStorageKeys).toEqual([]);
    await expect(
      processAccountDeletionMediaJobs({ targetUserId: owner.user._id }),
    ).resolves.toMatchObject({ completed: 1, failed: 0 });
    expect(destroyedStorageKeys).toEqual([
      "htcoaching/coaching-feedback-private/account-delete-video",
    ]);
  });

  it("retains financial and signed legal records without mutating them", async () => {
    const owner = await createTestUser({
      email: "account-retain-owner@example.com",
    });
    const trainer = await createTestUser({
      role: "trainer",
      email: "account-retain-trainer@example.com",
    });
    const admin = await createTestUser({
      role: "admin",
      email: "account-retain-admin@example.com",
    });
    const nextTrainer = await createTestUser({
      role: "trainer",
      email: "account-retain-next-trainer@example.com",
    });
    const order = await Order.create({
      userId: owner.user._id,
      trainerId: trainer.user._id,
      name: owner.user.name,
      email: owner.user.email,
      package: "ONLINE",
      sessions: 8,
      totalSessions: 8,
      status: "approved",
    });
    await createRetainedInventory({
      user: owner.user,
      trainer: trainer.user,
      nextTrainer: nextTrainer.user,
      admin: admin.user,
      order,
    });

    const response = await withAuth(
      request(app).delete(`/api/users/${owner.user._id}`),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      retainedCounts: {
        orders: 1,
        contracts: 1,
        depositRequests: 1,
        wallets: 1,
        walletTransactions: 1,
        fitnessSubscriptions: 1,
        auditLogs: 1,
        trainerTransfers: 1,
      },
      deferredBoundaries: [
        "financial_legal_pseudonymization_policy",
        "operational_audit_pseudonymization_policy",
      ],
    });
    await expect(
      Promise.all([
        Order.countDocuments({ _id: order._id }),
        Contract.countDocuments({ orderId: order._id, status: "signed" }),
        DepositRequest.countDocuments({ userId: owner.user._id }),
        Wallet.countDocuments({ userId: owner.user._id }),
        WalletTransaction.countDocuments({ userId: owner.user._id }),
        FitnessSubscription.countDocuments({ userId: owner.user._id }),
        AuditLog.countDocuments({ actorId: owner.user._id }),
        TrainerTransfer.countDocuments({ clientId: owner.user._id }),
      ]),
    ).resolves.toEqual(Array(8).fill(1));
    await expect(
      TrainerTransferLock.countDocuments({ _id: owner.user._id }),
    ).resolves.toBe(0);
    const auditRecord = await AccountDeletionRecord.findOne({
      targetUserId: owner.user._id,
    }).lean();
    expect(auditRecord.retainedCounts).toMatchObject({
      orders: 1,
      contracts: 1,
      depositRequests: 1,
      wallets: 1,
      walletTransactions: 1,
      fitnessSubscriptions: 1,
      auditLogs: 1,
      trainerTransfers: 1,
    });
  });

  it("keeps provider cleanup retry-safe outside the MongoDB transaction", async () => {
    const owner = await createTestUser({
      email: "account-retry-owner@example.com",
    });
    const trainer = await createTestUser({
      role: "trainer",
      email: "account-retry-trainer@example.com",
    });
    const admin = await createTestUser({
      role: "admin",
      email: "account-retry-admin@example.com",
    });
    await CoachingDay.create({
      userId: owner.user._id,
      trainerId: trainer.user._id,
      dateString: "2026-09-02",
      date: new Date("2026-09-02T00:00:00.000Z"),
      title: "Retry cleanup",
      clientFeedbackVideo: {
        provider: "cloudinary",
        storageKey: "htcoaching/coaching-feedback-private/retry-video",
        resourceType: "video",
        deliveryType: "authenticated",
        format: "mp4",
      },
    });
    setCoachingPrivateMediaAdapterForTests({
      async destroy() {
        throw Object.assign(new Error("provider timeout"), {
          code: "PROVIDER_TIMEOUT",
        });
      },
    });

    const response = await withAuth(
      request(app).delete(`/api/users/${owner.user._id}`),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    expect(await User.countDocuments({ _id: owner.user._id })).toBe(0);
    expect(
      await AccountDeletionMediaJob.countDocuments({
        targetUserId: owner.user._id,
        status: "pending",
      }),
    ).toBe(1);

    const firstAttempt = await processAccountDeletionMediaJobs({
      targetUserId: owner.user._id,
    });
    expect(firstAttempt.failed).toBe(1);
    expect(
      await AccountDeletionMediaJob.countDocuments({
        targetUserId: owner.user._id,
        status: "failed",
        lastErrorCode: "PROVIDER_TIMEOUT",
      }),
    ).toBe(1);

    setCoachingPrivateMediaAdapterForTests({
      async destroy(storageKey) {
        destroyedStorageKeys.push(storageKey);
        return { result: "ok" };
      },
    });
    const retry = await processAccountDeletionMediaJobs({
      targetUserId: owner.user._id,
      now: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    expect(retry.completed).toBe(1);
    expect(destroyedStorageKeys).toEqual([
      "htcoaching/coaching-feedback-private/retry-video",
    ]);
  });

  it("durably retries deletion of an owned legacy public feedback video", async () => {
    const owner = await createTestUser({
      email: "account-legacy-owner@example.com",
    });
    const trainer = await createTestUser({
      role: "trainer",
      email: "account-legacy-trainer@example.com",
    });
    const admin = await createTestUser({
      role: "admin",
      email: "account-legacy-admin@example.com",
    });
    await CoachingDay.create({
      userId: owner.user._id,
      trainerId: trainer.user._id,
      dateString: "2026-09-04",
      date: new Date("2026-09-04T00:00:00.000Z"),
      title: "Legacy public feedback",
      clientFeedbackVideo:
        "https://res.cloudinary.com/demo/video/upload/v1/htcoaching/coaching-videos/account-legacy.mp4",
    });
    setCoachingPrivateMediaAdapterForTests({
      async destroyLegacyPublic() {
        throw Object.assign(new Error("provider timeout"), {
          code: "PROVIDER_TIMEOUT",
        });
      },
    });

    const response = await withAuth(
      request(app).delete(`/api/users/${owner.user._id}`),
      admin.accessToken,
    );
    expect(response.status).toBe(200);
    await expect(
      AccountDeletionMediaJob.countDocuments({
        targetUserId: owner.user._id,
        "asset.storageKey": "htcoaching/coaching-videos/account-legacy",
        "asset.deliveryType": "upload",
        status: "pending",
      }),
    ).resolves.toBe(1);

    const firstAttempt = await processAccountDeletionMediaJobs({
      targetUserId: owner.user._id,
    });
    expect(firstAttempt.failed).toBe(1);
    setCoachingPrivateMediaAdapterForTests({
      async destroyLegacyPublic(storageKey) {
        destroyedStorageKeys.push(storageKey);
        return { deleted: true };
      },
    });
    const retry = await processAccountDeletionMediaJobs({
      targetUserId: owner.user._id,
      now: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    expect(retry.completed).toBe(1);
    expect(destroyedStorageKeys).toEqual([
      "htcoaching/coaching-videos/account-legacy",
    ]);
  });

  it("keeps account data when a legacy video does not prove storage ownership", async () => {
    const owner = await createTestUser({
      email: "account-unowned-owner@example.com",
    });
    const trainer = await createTestUser({
      role: "trainer",
      email: "account-unowned-trainer@example.com",
    });
    const admin = await createTestUser({
      role: "admin",
      email: "account-unowned-admin@example.com",
    });
    await CoachingDay.create({
      userId: owner.user._id,
      trainerId: trainer.user._id,
      dateString: "2026-09-05",
      date: new Date("2026-09-05T00:00:00.000Z"),
      title: "Unowned legacy feedback",
      clientFeedbackVideo:
        "https://res.cloudinary.com/another-cloud/video/upload/v1/htcoaching/coaching-videos/unowned.mp4",
    });

    const response = await withAuth(
      request(app).delete(`/api/users/${owner.user._id}`),
      admin.accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("COACHING_MEDIA_OWNERSHIP_REQUIRED");
    await expect(User.countDocuments({ _id: owner.user._id })).resolves.toBe(1);
    await expect(
      CoachingDay.countDocuments({ userId: owner.user._id }),
    ).resolves.toBe(1);
  });

  it("queues verified Booking-linked F1 health data for canonical deletion", async () => {
    const owner = await createTestUser({
      email: "account-f1-owner@example.com",
    });
    const admin = await createTestUser({
      role: "admin",
      email: "account-f1-admin@example.com",
    });
    const booking = await Booking.create({
      name: owner.user.name,
      phone: "0912345678",
      email: owner.user.email,
      gym: "Home",
      schedule: "Morning",
      package: "ONLINE",
      sessions: 8,
      userId: owner.user._id,
      clientRequestId: "account-f1-booking",
      requestFingerprint: "c".repeat(64),
    });
    const customer = await F1Customer.create({
      code: "F1-ACCOUNT-DELETE",
      fullName: owner.user.name,
      age: 30,
      gender: "other",
      email: owner.user.email,
      createdBy: admin.user._id,
      originBookingId: booking._id,
    });
    const intake = await F1Intake.create({
      customerId: customer._id,
      customerInfo: { email: owner.user.email },
      healthScreening: { injuries: "Sensitive injury" },
      createdBy: admin.user._id,
    });
    await F1Assessment.create({
      customerId: customer._id,
      intakeId: intake._id,
      assessorNotes: "Sensitive assessment",
      createdBy: admin.user._id,
    });

    const response = await withAuth(
      request(app).delete(`/api/users/${owner.user._id}`),
      admin.accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.f1DeletionJobsQueued).toBe(1);
    await expect(
      F1DataDeletionJob.countDocuments({
        customerId: customer._id,
        status: "pending_media_cleanup",
      }),
    ).resolves.toBe(1);
    await processF1DataDeletionBatch({ batchSize: 1 });
    await expect(
      Promise.all([
        F1Intake.countDocuments({ customerId: customer._id }),
        F1Assessment.countDocuments({ customerId: customer._id }),
      ]),
    ).resolves.toEqual([0, 0]);
    const redacted = await F1Customer.findById(customer._id).lean();
    expect(redacted).toMatchObject({
      fullName: "Deleted F1 Customer",
      email: "",
      deletedAt: expect.any(Date),
    });
  });

  it("fails closed when an F1 email match has no verified account linkage", async () => {
    const owner = await createTestUser({
      email: "account-f1-ambiguous@example.com",
    });
    const admin = await createTestUser({
      role: "admin",
      email: "account-f1-ambiguous-admin@example.com",
    });
    await F1Customer.create({
      code: "F1-AMBIGUOUS",
      fullName: owner.user.name,
      age: 35,
      gender: "other",
      email: owner.user.email,
      createdBy: admin.user._id,
    });

    const response = await withAuth(
      request(app).delete(`/api/users/${owner.user._id}`),
      admin.accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("F1_ACCOUNT_LINKAGE_REQUIRED");
    await expect(User.countDocuments({ _id: owner.user._id })).resolves.toBe(1);
  });

  it("reclaims crashed media jobs and requires provider confirmation", async () => {
    const userId = new mongoose.Types.ObjectId();
    const staleClaim = new Date(Date.now() - 30 * 60 * 1000);
    const job = await AccountDeletionMediaJob.create({
      targetUserId: userId,
      asset: {
        provider: "cloudinary",
        storageKey: "htcoaching/coaching-feedback-private/crash-recovery",
        resourceType: "video",
        deliveryType: "authenticated",
      },
      status: "processing",
      attempts: 1,
      claimedAt: staleClaim,
      nextAttemptAt: staleClaim,
    });

    const recovered = await processAccountDeletionMediaJobs({
      targetUserId: userId,
      now: new Date(),
    });
    expect(recovered.completed).toBe(1);
    await expect(
      AccountDeletionMediaJob.countDocuments({
        _id: job._id,
        status: "completed",
        claimedAt: null,
      }),
    ).resolves.toBe(1);

    setCoachingPrivateMediaAdapterForTests({
      async destroy() {
        return { result: "unexpected" };
      },
    });
    const unconfirmed = await AccountDeletionMediaJob.create({
      targetUserId: userId,
      asset: {
        provider: "cloudinary",
        storageKey:
          "htcoaching/coaching-feedback-private/unconfirmed-delete",
        resourceType: "video",
        deliveryType: "authenticated",
      },
    });
    const failed = await processAccountDeletionMediaJobs({ targetUserId: userId });
    expect(failed.failed).toBe(1);
    const storedFailure = await AccountDeletionMediaJob.findById(unconfirmed._id).lean();
    expect(storedFailure).toMatchObject({
      status: "failed",
      lastErrorCode: "PROVIDER_DELETE_UNCONFIRMED",
    });
  });

  it("keeps distinct cleanup jobs when providers use the same storage key", async () => {
    const targetUserId = new mongoose.Types.ObjectId();
    const storageKey = "htcoaching/coaching-videos/provider-collision";

    const queued = await enqueueAccountDeletionMedia({
      targetUserId,
      assets: [
        {
          provider: "cloudinary",
          storageKey,
          resourceType: "video",
          deliveryType: "upload",
        },
        {
          provider: "local",
          storageKey,
          resourceType: "video",
          deliveryType: "local",
        },
      ],
    });

    expect(queued).toBe(2);
    await expect(
      AccountDeletionMediaJob.countDocuments({ targetUserId, "asset.storageKey": storageKey }),
    ).resolves.toBe(2);
  });

  it("returns immediately after durable media enqueue without calling provider", async () => {
    const owner = await createTestUser({
      email: "account-dispatch-owner@example.com",
    });
    const trainer = await createTestUser({
      role: "trainer",
      email: "account-dispatch-trainer@example.com",
    });
    const admin = await createTestUser({
      role: "admin",
      email: "account-dispatch-admin@example.com",
    });
    await CoachingDay.create({
      userId: owner.user._id,
      trainerId: trainer.user._id,
      dateString: "2026-09-03",
      date: new Date("2026-09-03T00:00:00.000Z"),
      title: "Dispatch failure",
      clientFeedbackVideo: {
        provider: "cloudinary",
        storageKey:
          "htcoaching/coaching-feedback-private/dispatch-failure",
        resourceType: "video",
        deliveryType: "authenticated",
      },
    });
    const response = await withAuth(
      request(app).delete(`/api/users/${owner.user._id}`),
      admin.accessToken,
    );
    expect(response.status).toBe(200);
    expect(response.body.data.mediaCleanup.pending).toBe(1);
    await expect(User.countDocuments({ _id: owner.user._id })).resolves.toBe(0);
    expect(destroyedStorageKeys).toEqual([]);
  });
});
