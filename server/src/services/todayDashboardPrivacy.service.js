import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import CoachingComment from "../models/CoachingComment.js";
import CoachingCommentRevision from "../models/CoachingCommentRevision.js";
import CoachingHabit from "../models/CoachingHabit.js";
import DailyJournal from "../models/DailyJournal.js";
import DailyJournalRevision from "../models/DailyJournalRevision.js";
import InAppNotification from "../models/InAppNotification.js";
import NotificationPreference from "../models/NotificationPreference.js";
import SavedMealPlan from "../models/SavedMealPlan.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import WeeklyCheckinRevision from "../models/WeeklyCheckinRevision.js";

const deleteDashboardCollections = async ({
  clientId,
  actorId,
  actorRole,
  session,
}) => {
  const operations = [
    ["dailyJournalRevisions", DailyJournalRevision, { clientId }],
    ["dailyJournals", DailyJournal, { clientId }],
    ["savedMealPlans", SavedMealPlan, { ownerId: clientId }],
    ["coachingHabits", CoachingHabit, { clientId }],
    ["weeklyCheckinRevisions", WeeklyCheckinRevision, { clientId }],
    ["weeklyCheckins", WeeklyCheckin, { clientId }],
    ["coachingCommentRevisions", CoachingCommentRevision, { clientId }],
    ["coachingComments", CoachingComment, { clientId }],
    [
      "notifications",
      InAppNotification,
      {
        $or: [
          { recipientId: clientId },
          { actorId: clientId },
          { clientId },
        ],
      },
    ],
    [
      "notificationPreferences",
      NotificationPreference,
      { recipientId: clientId },
    ],
  ];
  const counts = {};
  for (const [key, Model, filter] of operations) {
    const result = await Model.deleteMany(filter).session(session);
    counts[key] = result.deletedCount;
  }
  const total = Object.values(counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (actorId) {
    await AuditLog.create(
      [
        {
          actorId,
          actorRole: actorRole === "admin" ? "admin" : "user",
          action: "delete_today_dashboard_data",
          targetType: "user",
          targetId: clientId,
          metadata: { collections: Object.keys(counts), total },
        },
      ],
      { session },
    );
  }
  return { counts, total };
};

export const deleteTodayDashboardData = async ({
  clientId,
  actorId = null,
  actorRole = "admin",
  session = null,
}) => {
  if (session) {
    return deleteDashboardCollections({
      clientId,
      actorId,
      actorRole,
      session,
    });
  }
  const ownSession = await mongoose.startSession();
  let result;
  try {
    await ownSession.withTransaction(async () => {
      result = await deleteDashboardCollections({
        clientId,
        actorId,
        actorRole,
        session: ownSession,
      });
    });
  } finally {
    await ownSession.endSession();
  }
  return result;
};
