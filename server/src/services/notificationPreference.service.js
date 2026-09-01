import NotificationPreference from "../models/NotificationPreference.js";
import { notificationError } from "./inAppNotification.service.js";

const defaults = (recipientId) => ({
  recipientId,
  inAppEnabled: true,
  comments: true,
  journal: true,
  weekly: true,
  morningHealthEmail: false,
  revision: 0,
});

const dto = (value) => ({
  inAppEnabled: value.inAppEnabled,
  comments: value.comments,
  journal: value.journal,
  weekly: value.weekly,
  morningHealthEmail: value.morningHealthEmail === true,
  revision: value.revision,
});

export const getNotificationPreference = async (recipientId) => {
  const preference = await NotificationPreference.findOne({
    recipientId,
  }).lean();
  return dto(preference || defaults(recipientId));
};

export const updateNotificationPreference = async ({
  recipientId,
  expectedRevision,
  input,
}) => {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw notificationError(400, "expectedRevision không hợp lệ", "INVALID_REVISION");
  }
  if (expectedRevision === 0) {
    try {
      const created = await NotificationPreference.create({
        recipientId,
        ...input,
        revision: 1,
      });
      return dto(created);
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
    { $set: input, $inc: { revision: 1 } },
    { returnDocument: "after", runValidators: true },
  );
  if (!updated) {
    throw notificationError(
      409,
      "Preferences đã thay đổi, vui lòng tải lại",
      "STALE_NOTIFICATION_PREFERENCE",
    );
  }
  return dto(updated);
};
