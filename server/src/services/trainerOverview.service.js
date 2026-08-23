import AuditLog from "../models/AuditLog.js";
import CoachingHabit from "../models/CoachingHabit.js";
import User from "../models/User.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import { getMonthWeekPeriod } from "../utils/dateKey.js";
import { assertTrainerWeeklyCheckinRead } from "./weeklyCheckinAccess.service.js";
import { toWeeklyCheckinDto } from "./weeklyCheckinDto.service.js";
import { getTrainerClientProgress } from "./progress.service.js";
import { getTodayDashboard } from "./todayDashboard.service.js";
import { getTrainerClientAttention } from "./trainerClientAttention.service.js";

const allowedHabitLineages = async ({ trainerId, clientId }) => {
  const habits = await CoachingHabit.find({
    clientId,
    $or: [
      { createdByRole: "trainer", createdById: trainerId },
      { createdByRole: "user", visibility: "shared" },
    ],
  })
    .distinct("lineageKey");
  return new Set(habits);
};

const sanitizeToday = async ({ today, trainerId, clientId }) => {
  const journal = today.sections.journal?.day;
  if (!journal) return today;
  const visibleLineages = await allowedHabitLineages({ trainerId, clientId });
  return {
    ...today,
    capabilities: {
      ...today.capabilities,
      canEditJournal: false,
      canSubmitDay: false,
    },
    sections: {
      ...today.sections,
      journal: {
        ...today.sections.journal,
        day: {
          ...journal,
          notes: { shared: journal.notes?.shared || "" },
          habitCompletions: (journal.habitCompletions || []).filter(
            (item) => visibleLineages.has(item.lineageKey),
          ),
        },
      },
    },
  };
};

export const getTrainerClientOverview = async ({
  actor,
  clientId,
  dateKey,
  days,
}) => {
  await assertTrainerWeeklyCheckinRead({ actor, clientId });
  const client = await User.findById(clientId)
    .select("_id name email avatar")
    .lean();
  const [rawToday, progress, attentionResult] = await Promise.all([
    getTodayDashboard({ userId: clientId, dateKey, actorScope: "trainer" }),
    getTrainerClientProgress({ actor, clientId, days, endDateKey: dateKey }),
    getTrainerClientAttention({ clientId, dateKey }),
  ]);
  const today = await sanitizeToday({
    today: rawToday,
    trainerId: actor.id,
    clientId,
  });
  const currentPeriod = getMonthWeekPeriod(dateKey);
  const weeklyCheckin = toWeeklyCheckinDto(
    await WeeklyCheckin.findOne({
      clientId,
      weekStartDateKey: currentPeriod.startDateKey,
      status: { $in: ["submitted", "reviewed"] },
    }).lean(),
  );
  await AuditLog.create({
    actorId: actor.id,
    actorRole: actor.role,
    action: "read_trainer_client_overview",
    targetType: "user",
    targetId: clientId,
    metadata: { dateKey, days: Number(days) },
  });
  return {
    client: {
      _id: String(client._id),
      name: client.name || "",
      email: client.email || "",
      avatar: client.avatar || "",
    },
    dateKey,
    today,
    progress,
    weeklyCheckin,
    attention: attentionResult.items,
  };
};
