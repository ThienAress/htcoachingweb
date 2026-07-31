import CoachingDay from "../models/CoachingDay.js";
import DailyJournal from "../models/DailyJournal.js";
import DailyJournalRevision from "../models/DailyJournalRevision.js";
import TrainingSchedule from "../models/TrainingSchedule.js";

const event = ({ id, type, action, at, label, metadata = {} }) => ({
  id: String(id),
  type,
  action,
  at: new Date(at).toISOString(),
  label,
  metadata,
});

export const getDailyJournalTimeline = async ({
  clientId,
  dateKey,
}) => {
  const journal = await DailyJournal.findOne({ clientId, dateKey })
    .select("_id")
    .lean();
  const [revisions, schedules, coaching] = await Promise.all([
    journal
      ? DailyJournalRevision.find({
          journalId: journal._id,
          clientId,
        })
          .select(
            "_id revision actorRole action changedAt reason changes.path",
          )
          .lean()
      : [],
    TrainingSchedule.find({
      clientId,
      occurrenceDateKey: dateKey,
    })
      .select(
        "_id exerciseType status createdAt completedAt cancelledAt",
      )
      .lean(),
    CoachingDay.findOne({ userId: clientId, dateString: dateKey })
      .select("_id title createdAt updatedAt")
      .lean(),
  ]);

  const events = revisions.map((revision) => {
    const changedNutrition = revision.changes?.some((change) =>
      change.path.startsWith("nutrition."),
    );
    const changedHabits = revision.changes?.some(
      (change) => change.path === "habitCompletions",
    );
    return event({
      id: "journal-" + revision._id,
      type: "journal",
      action: revision.action,
      at: revision.changedAt,
      label:
        revision.action === "submit"
          ? "Đã gửi nhật ký ngày"
          : revision.action === "correction"
            ? "Đã chỉnh sửa nhật ký"
            : changedNutrition
              ? "Đã cập nhật dinh dưỡng trong ngày"
              : changedHabits
                ? "Đã cập nhật habit trong ngày"
              : "Đã cập nhật wellness",
      metadata: {
        revision: revision.revision,
        actorRole: revision.actorRole,
        hasReason: Boolean(revision.reason),
      },
    });
  });
  for (const schedule of schedules) {
    if (schedule.createdAt) {
      events.push(
        event({
          id: "schedule-created-" + schedule._id,
          type: "schedule",
          action: "created",
          at: schedule.createdAt,
          label: "Đã lên lịch " + schedule.exerciseType,
          metadata: { actorRole: "trainer" },
        }),
      );
    }
    const transitionAt = schedule.completedAt || schedule.cancelledAt;
    if (transitionAt) {
      events.push(
        event({
          id: "schedule-status-" + schedule._id,
          type: "schedule",
          action: schedule.status,
          at: transitionAt,
          label:
            schedule.status === "completed"
              ? "Đã hoàn thành lịch tập"
              : "Lịch tập đã hủy",
          metadata: { actorRole: "trainer" },
        }),
      );
    }
  }
  if (coaching?.createdAt) {
    events.push(
      event({
        id: "coaching-" + coaching._id,
        type: "coaching",
        action: "assigned",
        at: coaching.createdAt,
        label: "HLV đã giao " + coaching.title,
        metadata: { actorRole: "trainer" },
      }),
    );
  }
  return events.sort(
    (left, right) =>
      Date.parse(right.at) - Date.parse(left.at) ||
      left.id.localeCompare(right.id),
  );
};
