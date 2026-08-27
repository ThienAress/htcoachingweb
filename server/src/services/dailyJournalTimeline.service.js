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

const WELLNESS_LABELS = {
  "wellness.sleepHours": "giấc ngủ",
  "wellness.waterMl": "nước uống",
  "wellness.steps": "số bước",
  "wellness.energy": "năng lượng",
  "wellness.hunger": "cảm giác đói",
  "wellness.stress": "căng thẳng",
  "wellness.soreness": "đau mỏi",
  "wellness.pain": "mức đau",
  "wellness.painArea": "vị trí đau",
};

const summarizeChangedWellness = (changes = []) => {
  const labels = [
    ...new Set(changes.map((change) => WELLNESS_LABELS[change.path]).filter(Boolean)),
  ];
  if (labels.length <= 2) return labels.join(" và ");
  return labels.slice(0, 2).join(", ") + ` và ${labels.length - 2} chỉ số khác`;
};

export const journalRevisionLabel = (revision) => {
  const wellnessSummary = summarizeChangedWellness(revision.changes);
  if (revision.action === "nutrition_submit") {
    return "Đã gửi báo cáo dinh dưỡng cho HLV";
  }
  if (revision.action === "submit") {
    return wellnessSummary
      ? "Đã gửi nhật ký: " + wellnessSummary
      : "Đã gửi nhật ký ngày";
  }
  if (revision.action === "correction") {
    return wellnessSummary
      ? "Đã cập nhật " + wellnessSummary
      : "Đã cập nhật nhật ký";
  }
  if (wellnessSummary) return "Đã cập nhật " + wellnessSummary;
  if (revision.changes?.some((change) => change.path.startsWith("nutrition."))) {
    return "Đã cập nhật dinh dưỡng trong ngày";
  }
  if (revision.changes?.some((change) => change.path === "habitCompletions")) {
    return "Đã cập nhật thói quen trong ngày";
  }
  return "Đã cập nhật nhật ký";
};

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
    return event({
      id: "journal-" + revision._id,
      type: "journal",
      action: revision.action,
      at: revision.changedAt,
      label: journalRevisionLabel(revision),
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
