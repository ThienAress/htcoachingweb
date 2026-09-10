import NotificationPreference from "../models/NotificationPreference.js";
import {
  isCoachAssignmentError,
  resolveEffectiveClientCoach,
} from "./effectiveCoach.service.js";
import { notificationError } from "./inAppNotification.service.js";

const EMAIL_PREFERENCE_KEYS = ["morningHealthEmail", "checkinEmail"];

const defaults = (recipientId) => ({
  recipientId,
  inAppEnabled: true,
  comments: true,
  journal: true,
  weekly: true,
  morningHealthEmail: false,
  checkinEmail: false,
  customerEmailConfigured: false,
  revision: 0,
});

const dto = (value, { emailEligible = false } = {}) => ({
  inAppEnabled: value.inAppEnabled,
  comments: value.comments,
  journal: value.journal,
  weekly: value.weekly,
  morningHealthEmail: value.morningHealthEmail === true,
  checkinEmail: value.checkinEmail === true,
  customerEmailConfigured: value.customerEmailConfigured === true,
  emailEligible,
  revision: value.revision,
});

export const resolveCustomerEmailEligibility = async (
  recipientId,
  { role = "user", session = null, env = process.env } = {},
) => {
  if (role !== "user") return false;
  try {
    await resolveEffectiveClientCoach({ clientId: recipientId, session, env });
    return true;
  } catch (error) {
    if (
      isCoachAssignmentError(error) ||
      error?.codeName === "COACH_CLIENT_NOT_FOUND"
    ) {
      return false;
    }
    throw error;
  }
};

export const getNotificationPreference = async (
  recipientId,
  { role = "user" } = {},
) => {
  const [preference, emailEligible] = await Promise.all([
    NotificationPreference.findOne({ recipientId }).lean(),
    resolveCustomerEmailEligibility(recipientId, { role }),
  ]);
  return dto(preference || defaults(recipientId), { emailEligible });
};

export const isCheckinEmailEnabled = async (recipientId) =>
  Boolean(
    await NotificationPreference.exists({
      recipientId,
      checkinEmail: true,
    }),
  );

export const enableContractEmailPreferences = async ({
  recipientId,
  session,
}) => {
  const preference = await NotificationPreference.findOne({ recipientId })
    .session(session);
  if (preference) {
    preference.morningHealthEmail = true;
    preference.checkinEmail = true;
    preference.customerEmailConfigured = true;
    preference.revision += 1;
    await preference.save({ session });
    return preference;
  }
  const [created] = await NotificationPreference.create(
    [{
      ...defaults(recipientId),
      revision: 1,
      morningHealthEmail: true,
      checkinEmail: true,
      customerEmailConfigured: true,
    }],
    { session },
  );
  return created;
};

export const updateNotificationPreference = async ({
  recipientId,
  expectedRevision,
  input,
  role = "user",
}) => {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw notificationError(400, "expectedRevision không hợp lệ", "INVALID_REVISION");
  }
  const updatesEmailPreference = EMAIL_PREFERENCE_KEYS.some((key) =>
    Object.hasOwn(input, key),
  );
  const emailEligible = await resolveCustomerEmailEligibility(recipientId, {
    role,
  });
  let persistedInput = input;
  if (updatesEmailPreference && !emailEligible) {
    const current = await NotificationPreference.findOne({ recipientId })
      .select(EMAIL_PREFERENCE_KEYS.join(" "))
      .lean();
    const changesEmailPreference = EMAIL_PREFERENCE_KEYS.some(
      (key) =>
        Object.hasOwn(input, key) &&
        Boolean(input[key]) !== Boolean(current?.[key]),
    );
    if (changesEmailPreference) {
      throw notificationError(
        403,
        "Bạn cần có gói coaching còn hiệu lực và đã được phân công HLV để chỉnh email thông báo",
        "EMAIL_NOTIFICATION_NOT_ELIGIBLE",
      );
    }
    persistedInput = Object.fromEntries(
      Object.entries(input).filter(
        ([key]) => !EMAIL_PREFERENCE_KEYS.includes(key),
      ),
    );
  } else if (updatesEmailPreference) {
    persistedInput = { ...input, customerEmailConfigured: true };
  }
  if (expectedRevision === 0) {
    try {
      const created = await NotificationPreference.create({
        recipientId,
        ...persistedInput,
        revision: 1,
      });
      return dto(created, { emailEligible });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      throw notificationError(
        409,
        "Preferences đã thay đổi, vui lòng tải lại",
        "STALE_NOTIFICATION_PREFERENCE",
      );
    }
  }
  const updated = await NotificationPreference.findOneAndUpdate(
    { recipientId, revision: expectedRevision },
    { $set: persistedInput, $inc: { revision: 1 } },
    { returnDocument: "after", runValidators: true },
  );
  if (!updated) {
    throw notificationError(
      409,
      "Preferences đã thay đổi, vui lòng tải lại",
      "STALE_NOTIFICATION_PREFERENCE",
    );
  }
  return dto(updated, { emailEligible });
};
