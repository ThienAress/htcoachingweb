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
  sendBookingNotificationToAdmin: vi.fn().mockResolvedValue(undefined),
  sendScheduleReminderMail: vi.fn().mockResolvedValue(undefined),
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import bookingRoutes from "../../routes/booking.routes.js";
import trainingBookingRoutes from "../../routes/trainingBooking.routes.js";
import trainingScheduleRoutes from "../../routes/trainingSchedule.routes.js";
import AuditLog from "../../models/AuditLog.js";
import Booking from "../../models/Booking.js";
import Order from "../../models/Order.js";
import ReminderDelivery from "../../models/ReminderDelivery.js";
import TrainingSchedule from "../../models/TrainingSchedule.js";
import TrainingScheduleCommand from "../../models/TrainingScheduleCommand.js";
import TrainingSlotClaim from "../../models/TrainingSlotClaim.js";
import { sendScheduleReminderMail } from "../../utils/sendMail.js";
import { checkAndSendReminders } from "../../services/scheduleReminderCron.js";
import {
  getAppDayOfWeek,
  getVietnamDateKey,
} from "../../services/trainingOccurrence.service.js";
import { runPhase7Migration } from "../../migrations/20260719-phase7-schedule-booking-integrity.js";

let app;

const futureDateKey = (days) => {
  const [year, month, day] = getVietnamDateKey().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return (
    date.getUTCFullYear() +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getUTCDate()).padStart(2, "0")
  );
};

const createApprovedOrder = (clientId, trainerId) =>
  Order.create({
    userId: clientId,
    trainerId,
    name: "Phase 7 Client",
    email: "phase7-client@example.com",
    package: "PT 10",
    sessions: 10,
    totalSessions: 10,
    status: "approved",
  });

const postAs = (path, token, body) =>
  withAuth(request(app).post(path).send(body), token);
const putAs = (path, token, body) =>
  withAuth(request(app).put(path).send(body), token);
const patchAs = (path, token, body) =>
  withAuth(request(app).patch(path).send(body), token);
const deleteAs = (path, token, body) =>
  withAuth(request(app).delete(path).send(body), token);
const publicPost = (path, body) =>
  request(app)
    .post(path)
    .set("Cookie", ["csrfToken=test-csrf-token"])
    .set("X-CSRF-Token", "test-csrf-token")
    .send(body);

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/training-booking", trainingBookingRoutes);
  app.use("/api/training-schedules", trainingScheduleRoutes);
  await Promise.all([
    AuditLog.init(),
    Booking.init(),
    Order.init(),
    ReminderDelivery.init(),
    TrainingSchedule.init(),
    TrainingScheduleCommand.init(),
    TrainingSlotClaim.init(),
  ]);
});

afterEach(async () => {
  await clearCollections();
  delete process.env.DEFAULT_ADMIN_TRAINER_ID;
});

afterAll(async () => {
  await teardownTestDB();
});

describe("Phase 7 training occurrence integrity", () => {
  it("allows exactly one of two concurrent claims for the same trainer slots", async () => {
    const trainer = await createTestUser({
      email: "phase7-trainer@example.com",
      role: "trainer",
    });
    const firstClient = await createTestUser({
      email: "phase7-client-one@example.com",
    });
    const secondClient = await createTestUser({
      email: "phase7-client-two@example.com",
    });
    await Promise.all([
      createApprovedOrder(firstClient.user._id, trainer.user._id),
      createApprovedOrder(secondClient.user._id, trainer.user._id),
    ]);
    const occurrenceDateKey = futureDateKey(1);
    const base = {
      occurrenceDateKey,
      dayOfWeek: getAppDayOfWeek(occurrenceDateKey),
      startTime: "09:00",
      endTime: "10:00",
      exerciseType: "Gym",
      notes: "",
      color: "#3b82f6",
    };

    const responses = await Promise.all([
      postAs("/api/training-schedules", trainer.accessToken, {
        ...base,
        clientId: firstClient.user._id,
        requestId: "71111111-1111-4111-8111-111111111111",
      }),
      postAs("/api/training-schedules", trainer.accessToken, {
        ...base,
        clientId: secondClient.user._id,
        requestId: "72222222-2222-4222-8222-222222222222",
      }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await TrainingSchedule.countDocuments({ isActive: true })).toBe(1);
    expect(await TrainingSlotClaim.countDocuments()).toBe(4);
  });

  it("makes create/reschedule idempotent and rejects stale revisions", async () => {
    const trainer = await createTestUser({
      email: "phase7-client-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "phase7-booking-client@example.com",
    });
    await createApprovedOrder(client.user._id, trainer.user._id);
    const createBody = {
      occurrenceDateKey: futureDateKey(1),
      startTime: "10:00",
      endTime: "11:00",
      notes: "Client booking",
      requestId: "73333333-3333-4333-8333-333333333333",
    };

    const created = await postAs(
      "/api/training-booking/book",
      client.accessToken,
      createBody,
    );
    const replayed = await postAs(
      "/api/training-booking/book",
      client.accessToken,
      createBody,
    );
    expect(created.status).toBe(201);
    expect(replayed.status).toBe(200);
    expect(replayed.body.idempotentReplay).toBe(true);
    expect(await TrainingSchedule.countDocuments()).toBe(1);

    const updateBody = {
      occurrenceDateKey: futureDateKey(2),
      startTime: "11:00",
      endTime: "12:00",
      notes: "Moved",
      revision: 0,
      requestId: "74444444-4444-4444-8444-444444444444",
    };
    const updated = await putAs(
      "/api/training-booking/book/" + created.body.data._id,
      client.accessToken,
      updateBody,
    );
    const updateReplay = await putAs(
      "/api/training-booking/book/" + created.body.data._id,
      client.accessToken,
      updateBody,
    );
    const stale = await putAs(
      "/api/training-booking/book/" + created.body.data._id,
      client.accessToken,
      {
        ...updateBody,
        requestId: "75555555-5555-4555-8555-555555555555",
      },
    );

    expect(updated.status).toBe(200);
    expect(updated.body.data.revision).toBe(1);
    expect(updateReplay.status).toBe(200);
    expect(updateReplay.body.idempotentReplay).toBe(true);
    expect(stale.status).toBe(409);
  });

  it("blocks busy-time IDOR and retains a cancelled schedule with audit", async () => {
    const trainer = await createTestUser({
      email: "phase7-owned-trainer@example.com",
      role: "trainer",
    });
    const otherTrainer = await createTestUser({
      email: "phase7-other-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "phase7-owned-client@example.com",
    });
    await createApprovedOrder(client.user._id, trainer.user._id);
    const dateKey = futureDateKey(1);
    const created = await postAs(
      "/api/training-booking/book",
      client.accessToken,
      {
        occurrenceDateKey: dateKey,
        startTime: "13:00",
        endTime: "14:00",
        requestId: "76666666-6666-4666-8666-666666666666",
      },
    );
    const forbidden = await withAuth(
      request(app).get("/api/training-booking/busy-times").query({
        trainerId: otherTrainer.user._id.toString(),
        occurrenceDateKey: dateKey,
      }),
      client.accessToken,
    );
    expect(forbidden.status).toBe(403);

    const cancelled = await deleteAs(
      "/api/training-booking/book/" + created.body.data._id,
      client.accessToken,
      {
        revision: 0,
        requestId: "77777777-7777-4777-8777-777777777777",
        reason: "Client cannot attend",
      },
    );
    const persisted = await TrainingSchedule.findById(created.body.data._id);
    expect(cancelled.status).toBe(200);
    expect(persisted.status).toBe("cancelled");
    expect(persisted.isActive).toBe(false);
    expect(await TrainingSlotClaim.countDocuments()).toBe(0);
    expect(
      await AuditLog.countDocuments({
        action: "cancel_training_schedule",
        targetId: persisted._id,
      }),
    ).toBe(1);
  });

  it("claims one reminder delivery and does not send the occurrence twice", async () => {
    sendScheduleReminderMail.mockClear();
    const trainer = await createTestUser({
      email: "phase7-reminder-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "phase7-reminder-client@example.com",
    });
    const now = new Date("2030-01-01T00:00:00.000Z");
    const startAt = new Date(now.getTime() + 30 * 60000);
    const endAt = new Date(startAt.getTime() + 60 * 60000);
    await TrainingSchedule.create({
      trainerId: trainer.user._id,
      clientId: client.user._id,
      clientName: client.user.name,
      occurrenceDateKey: "2030-01-01",
      startAt,
      endAt,
      dayOfWeek: getAppDayOfWeek("2030-01-01"),
      startTime: "07:30",
      endTime: "08:30",
      exerciseType: "Gym",
      expiresAt: endAt,
      status: "scheduled",
      isActive: true,
    });

    const first = await checkAndSendReminders(now);
    const second = await checkAndSendReminders(now);
    const delivery = await ReminderDelivery.findOne();

    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(sendScheduleReminderMail).toHaveBeenCalledTimes(1);
    expect(delivery.status).toBe("sent");
    expect(delivery.attempts).toBe(1);
  });
});

describe("Phase 7 lead booking state machine", () => {
  const leadBody = {
    name: "Phase Seven Client",
    phone: "0912345678",
    email: "phase7lead@gmail.com",
    gym: "Waystation",
    schedule: "Monday 09:00",
    note: "",
    package: "1-1 - Standard",
    sessions: 10,
    gifts: [],
    clientRequestId: "78888888-8888-4888-8888-888888888888",
  };

  it("deduplicates public submits, enforces transitions, and archives without deletion", async () => {
    const admin = await createTestUser({
      email: "phase7-admin@example.com",
      role: "admin",
    });
    const created = await publicPost("/api/bookings", leadBody);
    const replayed = await publicPost("/api/bookings", leadBody);
    expect(created.status).toBe(201);
    expect(replayed.status).toBe(200);
    expect(await Booking.countDocuments()).toBe(1);

    const invalidTransition = await patchAs(
      "/api/bookings/" + created.body.data._id + "/status",
      admin.accessToken,
      { status: "completed", revision: 0 },
    );
    const contacted = await patchAs(
      "/api/bookings/" + created.body.data._id + "/status",
      admin.accessToken,
      { status: "contacted", revision: 0 },
    );
    const archived = await patchAs(
      "/api/bookings/" + created.body.data._id + "/archive",
      admin.accessToken,
      { revision: 1 },
    );
    expect(invalidTransition.status).toBe(409);
    expect(contacted.status).toBe(200);
    expect(archived.status).toBe(200);
    expect(await Booking.countDocuments()).toBe(1);
    expect((await Booking.findById(created.body.data._id)).isArchived).toBe(
      true,
    );
    expect(
      await AuditLog.countDocuments({
        targetType: "booking",
        targetId: created.body.data._id,
      }),
    ).toBe(2);
  });
});

describe("Phase 7 guarded migration", () => {
  it("backfills legacy records, builds claims, and is idempotent", async () => {
    const trainer = await createTestUser({
      email: "phase7-migration-trainer@example.com",
      role: "trainer",
    });
    const client = await createTestUser({
      email: "phase7-migration-client@example.com",
    });
    const dateKey = futureDateKey(1);
    await TrainingSchedule.collection.insertOne({
      trainerId: trainer.user._id,
      clientId: client.user._id,
      clientName: client.user.name,
      dayOfWeek: getAppDayOfWeek(dateKey),
      startTime: "15:00",
      endTime: "16:00",
      exerciseType: "Gym",
      notes: "",
      color: "#3b82f6",
      expiresAt: new Date(Date.now() + 7 * 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await Booking.collection.insertOne({
      name: "Legacy Booking Client",
      phone: "0987654321",
      email: "legacy@gmail.com",
      gym: "Waystation",
      schedule: "Tuesday",
      package: "PT",
      sessions: 5,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const first = await runPhase7Migration();
    const second = await runPhase7Migration();
    const schedule = await TrainingSchedule.findOne({
      clientId: client.user._id,
    });
    const booking = await Booking.findOne({ email: "legacy@gmail.com" });

    expect(first.verification.totalIssues).toBe(0);
    expect(second.verification.totalIssues).toBe(0);
    expect(schedule.occurrenceDateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await TrainingSlotClaim.countDocuments()).toBe(4);
    expect(booking.clientRequestId).toContain("legacy-");
    expect(booking.nameNormalized).toBe("legacy booking client");
  });
});
