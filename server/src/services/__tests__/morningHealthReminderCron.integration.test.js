import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../../utils/sendMail.js", () => ({
  sendMorningHealthReminderMail: vi.fn(),
}));

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import DailyJournal from "../../models/DailyJournal.js";
import MorningHealthReminderDelivery from "../../models/MorningHealthReminderDelivery.js";
import NotificationPreference from "../../models/NotificationPreference.js";
import Order from "../../models/Order.js";
import { sendMorningHealthReminderMail } from "../../utils/sendMail.js";
import { checkAndSendMorningHealthReminders } from "../morningHealthReminderCron.js";

const enabledEnv = {
  BACKGROUND_JOBS_ENABLED: "false",
  MORNING_HEALTH_REMINDER_ENABLED: "true",
  TODAY_DASHBOARD_ENABLED: "true",
  TODAY_JOURNAL_WRITES_ENABLED: "true",
  NODE_ENV: "test",
};

const originalEnv = Object.fromEntries(
  Object.keys(enabledEnv).map((key) => [key, process.env[key]]),
);

const restoreEnv = () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const createEligibleCustomer = async (suffix = "one") => {
  const trainer = await createTestUser({
    email: `morning-trainer-${suffix}@example.com`,
    role: "trainer",
  });
  const client = await createTestUser({
    email: `morning-client-${suffix}@example.com`,
    name: `Khách ${suffix}`,
    role: "user",
  });
  await Promise.all([
    NotificationPreference.create({
      recipientId: client.user._id,
      morningHealthEmail: true,
    }),
    Order.create({
      userId: client.user._id,
      trainerId: trainer.user._id,
      name: client.user.name,
      email: client.user.email,
      package: "PT",
      sessions: 3,
      totalSessions: 3,
      status: "approved",
    }),
  ]);
  return { client, trainer };
};

const createLegacyLeadCustomer = async (suffix = "legacy") => {
  const lead = await createTestUser({
    email: `morning-lead-${suffix}@example.com`,
    role: "admin",
  });
  const client = await createTestUser({
    email: `morning-legacy-client-${suffix}@example.com`,
    name: `Khách legacy ${suffix}`,
    role: "user",
  });
  await Promise.all([
    NotificationPreference.create({
      recipientId: client.user._id,
      morningHealthEmail: true,
    }),
    Order.create({
      userId: client.user._id,
      name: client.user.name,
      email: client.user.email,
      package: "PT",
      sessions: 3,
      totalSessions: 3,
      status: "approved",
    }),
  ]);
  return { client, lead };
};

beforeAll(setupTestDB);
beforeEach(() => {
  Object.assign(process.env, enabledEnv);
  vi.mocked(sendMorningHealthReminderMail).mockReset();
  vi.mocked(sendMorningHealthReminderMail).mockResolvedValue({
    providerMessageId: "morning-provider-id",
  });
});
afterEach(async () => {
  restoreEnv();
  await clearCollections();
});
afterAll(teardownTestDB);

describe("morning health reminder cron", () => {
  it("sends once with the global background jobs switch disabled", async () => {
    const { client } = await createEligibleCustomer();
    const now = new Date("2026-08-29T00:15:00.000Z");

    const first = await checkAndSendMorningHealthReminders(now);
    const replay = await checkAndSendMorningHealthReminders(now);

    expect(first).toEqual(
      expect.objectContaining({ dateKey: "2026-08-29", sent: 1, failed: 0 }),
    );
    expect(replay).toEqual(
      expect.objectContaining({ dateKey: "2026-08-29", sent: 0, failed: 0 }),
    );
    expect(sendMorningHealthReminderMail).toHaveBeenCalledTimes(1);
    expect(sendMorningHealthReminderMail).toHaveBeenCalledWith(
      client.user.email,
      expect.objectContaining({
        name: client.user.name,
        dateKey: "2026-08-29",
        deliveryKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(
      await MorningHealthReminderDelivery.findOne({
        recipientId: client.user._id,
        dateKey: "2026-08-29",
      }).lean(),
    ).toEqual(expect.objectContaining({ status: "sent", attempts: 1 }));
  });

  it("skips a customer who already submitted today's health journal", async () => {
    const { client, trainer } = await createEligibleCustomer("submitted");
    await DailyJournal.create({
      clientId: client.user._id,
      trainerIdAtCreation: trainer.user._id,
      dateKey: "2026-08-29",
      status: "submitted",
      submittedAt: new Date("2026-08-29T00:05:00.000Z"),
      revision: 1,
    });

    const result = await checkAndSendMorningHealthReminders(
      new Date("2026-08-29T00:15:00.000Z"),
    );

    expect(result).toEqual(
      expect.objectContaining({ sent: 0, failed: 0, suppressed: 1 }),
    );
    expect(sendMorningHealthReminderMail).not.toHaveBeenCalled();
    expect(await MorningHealthReminderDelivery.countDocuments()).toBe(0);
  });

  it("sends to an opted-in legacy customer only when the configured lead is valid", async () => {
    const { client, lead } = await createLegacyLeadCustomer();

    const result = await checkAndSendMorningHealthReminders(
      new Date("2026-08-29T00:15:00.000Z"),
      { ...enabledEnv, DEFAULT_ADMIN_TRAINER_ID: String(lead.user._id) },
    );

    expect(result).toEqual(expect.objectContaining({ sent: 1, failed: 0 }));
    expect(sendMorningHealthReminderMail).toHaveBeenCalledWith(
      client.user.email,
      expect.any(Object),
    );
  });

  it("excludes a client with an invalid explicit coach instead of falling back to the lead", async () => {
    const { client, lead } = await createLegacyLeadCustomer("invalid-coach");
    const nonCoach = await createTestUser({
      email: "morning-non-coach@example.com",
      role: "user",
    });
    await Order.updateOne(
      { userId: client.user._id },
      { $set: { trainerId: nonCoach.user._id } },
    );

    const result = await checkAndSendMorningHealthReminders(
      new Date("2026-08-29T00:15:00.000Z"),
      { ...enabledEnv, DEFAULT_ADMIN_TRAINER_ID: String(lead.user._id) },
    );

    expect(result).toEqual(
      expect.objectContaining({
        sent: 0,
        failed: 0,
        skipReasons: { invalid_assignment: 1 },
      }),
    );
    expect(sendMorningHealthReminderMail).not.toHaveBeenCalled();
  });

  it("excludes conflicting active effective coaches without aborting the tick", async () => {
    const { client, lead } = await createLegacyLeadCustomer("conflict");
    const otherTrainer = await createTestUser({
      email: "morning-conflict-trainer@example.com",
      role: "trainer",
    });
    await Order.create({
      userId: client.user._id,
      trainerId: otherTrainer.user._id,
      name: client.user.name,
      email: client.user.email,
      package: "PT extra",
      sessions: 2,
      totalSessions: 2,
      status: "approved",
    });

    const result = await checkAndSendMorningHealthReminders(
      new Date("2026-08-29T00:15:00.000Z"),
      { ...enabledEnv, DEFAULT_ADMIN_TRAINER_ID: String(lead.user._id) },
    );

    expect(result).toEqual(
      expect.objectContaining({
        sent: 0,
        failed: 0,
        skipReasons: { assignment_conflict: 1 },
      }),
    );
    expect(sendMorningHealthReminderMail).not.toHaveBeenCalled();
  });

  it("records a provider failure and retries the same delivery after backoff", async () => {
    const { client } = await createEligibleCustomer("retry");
    vi.mocked(sendMorningHealthReminderMail)
      .mockRejectedValueOnce(
        Object.assign(new Error("provider unavailable"), {
          code: "MORNING_HEALTH_EMAIL_PROVIDER_FAILED",
        }),
      )
      .mockResolvedValueOnce({ providerMessageId: "retry-provider-id" });

    const failed = await checkAndSendMorningHealthReminders(
      new Date("2026-08-29T00:15:00.000Z"),
    );
    const retried = await checkAndSendMorningHealthReminders(
      new Date("2026-08-29T00:21:00.000Z"),
    );

    expect(failed).toEqual(expect.objectContaining({ sent: 0, failed: 1 }));
    expect(retried).toEqual(expect.objectContaining({ sent: 1, failed: 0 }));
    expect(sendMorningHealthReminderMail).toHaveBeenCalledTimes(2);
    expect(
      await MorningHealthReminderDelivery.findOne({
        recipientId: client.user._id,
      }).lean(),
    ).toEqual(
      expect.objectContaining({
        status: "sent",
        attempts: 2,
        lastErrorCode: "",
      }),
    );
  });

  it("stays fail-closed when a runtime flag is off or time is outside the window", async () => {
    await createEligibleCustomer("disabled");
    process.env.MORNING_HEALTH_REMINDER_ENABLED = "false";

    const disabled = await checkAndSendMorningHealthReminders(
      new Date("2026-08-29T00:15:00.000Z"),
    );
    process.env.MORNING_HEALTH_REMINDER_ENABLED = "true";
    const outsideWindow = await checkAndSendMorningHealthReminders(
      new Date("2026-08-29T03:15:00.000Z"),
    );

    expect(disabled).toEqual(
      expect.objectContaining({ sent: 0, failed: 0, skipped: "disabled" }),
    );
    expect(outsideWindow).toEqual(
      expect.objectContaining({
        sent: 0,
        failed: 0,
        skipped: "outside_window",
      }),
    );
    expect(sendMorningHealthReminderMail).not.toHaveBeenCalled();
  });
});
