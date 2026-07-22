import ReminderDelivery from "../models/ReminderDelivery.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import TrainingScheduleCommand from "../models/TrainingScheduleCommand.js";
import TrainingSlotClaim from "../models/TrainingSlotClaim.js";
import { buildSlotStarts } from "./trainingOccurrence.service.js";

export const verifyTrainingScheduleIntegrity = async ({
  issueLimit = 200,
} = {}) => {
  const issues = [];
  const addIssue = (issue) => {
    if (issues.length < issueLimit) issues.push(issue);
  };

  const missingConcreteFields = await TrainingSchedule.find({
    status: "scheduled",
    isActive: true,
    $or: [
      { occurrenceDateKey: { $exists: false } },
      { startAt: { $exists: false } },
      { endAt: { $exists: false } },
    ],
  })
    .select("_id")
    .limit(issueLimit)
    .lean();
  for (const schedule of missingConcreteFields) {
    addIssue({
      code: "MISSING_OCCURRENCE_FIELDS",
      scheduleId: String(schedule._id),
    });
  }

  const duplicateClientDates = await TrainingSchedule.aggregate([
    { $match: { status: "scheduled", isActive: true } },
    {
      $group: {
        _id: {
          clientId: "$clientId",
          occurrenceDateKey: "$occurrenceDateKey",
        },
        count: { $sum: 1 },
        scheduleIds: { $push: "$_id" },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: issueLimit },
  ]);
  for (const duplicate of duplicateClientDates) {
    addIssue({
      code: "DUPLICATE_CLIENT_DATE",
      clientId: String(duplicate._id.clientId),
      occurrenceDateKey: duplicate._id.occurrenceDateKey,
      scheduleIds: duplicate.scheduleIds.map(String),
    });
  }

  const duplicateTrainerSlots = await TrainingSlotClaim.aggregate([
    {
      $group: {
        _id: {
          trainerId: "$trainerId",
          slotStartAt: "$slotStartAt",
        },
        count: { $sum: 1 },
        scheduleIds: { $push: "$scheduleId" },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: issueLimit },
  ]);
  for (const duplicate of duplicateTrainerSlots) {
    addIssue({
      code: "DUPLICATE_TRAINER_SLOT",
      trainerId: String(duplicate._id.trainerId),
      slotStartAt: duplicate._id.slotStartAt,
      scheduleIds: duplicate.scheduleIds.map(String),
    });
  }

  const activeSchedules = await TrainingSchedule.find({
    status: "scheduled",
    isActive: true,
    startAt: { $exists: true },
    endAt: { $exists: true },
  })
    .select("_id startAt endAt")
    .limit(100000)
    .lean();
  const claimCounts = await TrainingSlotClaim.aggregate([
    {
      $group: {
        _id: "$scheduleId",
        count: { $sum: 1 },
      },
    },
  ]);
  const countBySchedule = new Map(
    claimCounts.map((item) => [String(item._id), item.count]),
  );
  for (const schedule of activeSchedules) {
    const expected = buildSlotStarts(schedule.startAt, schedule.endAt).length;
    const actual = countBySchedule.get(String(schedule._id)) || 0;
    if (expected !== actual) {
      addIssue({
        code: "SLOT_CLAIM_COUNT_MISMATCH",
        scheduleId: String(schedule._id),
        expected,
        actual,
      });
    }
  }

  const orphanClaims = await TrainingSlotClaim.aggregate([
    {
      $lookup: {
        from: TrainingSchedule.collection.name,
        localField: "scheduleId",
        foreignField: "_id",
        as: "schedule",
      },
    },
    { $match: { schedule: { $size: 0 } } },
    { $limit: issueLimit },
    { $project: { _id: 1, scheduleId: 1 } },
  ]);
  for (const claim of orphanClaims) {
    addIssue({
      code: "ORPHAN_SLOT_CLAIM",
      claimId: String(claim._id),
      scheduleId: String(claim.scheduleId),
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    activeSchedules: activeSchedules.length,
    slotClaims: await TrainingSlotClaim.countDocuments(),
    commands: await TrainingScheduleCommand.countDocuments(),
    reminderDeliveries: await ReminderDelivery.countDocuments(),
    totalIssues: issues.length,
    truncated: issues.length >= issueLimit,
    issues,
  };
};
