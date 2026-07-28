import TrainerSubscription from "../models/TrainerSubscription.js";
import Order from "../models/Order.js";
import Checkin from "../models/Checkin.js";
import CoachingDay from "../models/CoachingDay.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import F1Customer from "../models/F1Customer.js";
import F1Media from "../models/F1Media.js";

const findInactiveTrainerIds = async ({ deadlineField, now, limit }) => {
  const deadlinePath = `$${deadlineField}`;
  const candidates = await TrainerSubscription.aggregate([
    { $match: { status: { $in: ["expired", "cancelled"] } } },
    {
      $group: {
        _id: "$userId",
        latestDeadline: { $max: deadlinePath },
        missingDeadlineCount: {
          $sum: {
            $cond: [{ $eq: [{ $type: deadlinePath }, "date"] }, 0, 1],
          },
        },
      },
    },
    {
      $match: {
        missingDeadlineCount: 0,
        latestDeadline: { $lte: now },
      },
    },
    { $sort: { latestDeadline: 1 } },
    { $limit: limit },
  ]);
  const candidateIds = candidates.map((item) => item._id);
  if (candidateIds.length === 0) return [];

  const activeIds = await TrainerSubscription.distinct("userId", {
    userId: { $in: candidateIds },
    isActive: true,
    endDate: { $gt: now },
  });
  const activeSet = new Set(activeIds.map(String));
  return candidateIds
    .map(String)
    .filter((id) => !activeSet.has(id));
};

const countStructuredRecords = async (trainerIds) => {
  if (trainerIds.length === 0) return {};
  const orderIds = await Order.distinct("_id", {
    trainerId: { $in: trainerIds },
  });
  const [checkins, coachingDays, schedules, f1Customers] =
    await Promise.all([
      Checkin.countDocuments({ orderId: { $in: orderIds } }),
      CoachingDay.countDocuments({ trainerId: { $in: trainerIds } }),
      TrainingSchedule.countDocuments({ trainerId: { $in: trainerIds } }),
      F1Customer.countDocuments({ assignedTrainerId: { $in: trainerIds } }),
    ]);
  const orders = orderIds.length;
  return { orders, checkins, coachingDays, schedules, f1Customers };
};

const countMediaRecords = async (trainerIds) => {
  if (trainerIds.length === 0) return {};
  const f1CustomerIds = await F1Customer.distinct("_id", {
    assignedTrainerId: { $in: trainerIds },
  });
  const [f1Media, coachingMediaDocuments] = await Promise.all([
    F1Media.countDocuments({ customerId: { $in: f1CustomerIds } }),
    CoachingDay.countDocuments({
      trainerId: { $in: trainerIds },
      $or: [
        { videoUrl: { $nin: ["", null] } },
        { clientFeedbackVideo: { $nin: ["", null] } },
        { "exercises.videoUrl": { $nin: ["", null] } },
        { "exercises.videoUrl2": { $nin: ["", null] } },
        { "exercises.clientFeedbackVideo": { $nin: ["", null] } },
      ],
    }),
  ]);
  return { f1Media, coachingMediaDocuments };
};

export const buildTrainerRetentionDryRun = async ({
  now = new Date(),
  limit = 100,
} = {}) => {
  const [mediaTrainerIds, structuredTrainerIds] = await Promise.all([
    findInactiveTrainerIds({
      deadlineField: "mediaRetentionExpiresAt",
      now,
      limit,
    }),
    findInactiveTrainerIds({
      deadlineField: "structuredRetentionExpiresAt",
      now,
      limit,
    }),
  ]);

  const [mediaRecords, structuredRecords] = await Promise.all([
    countMediaRecords(mediaTrainerIds),
    countStructuredRecords(structuredTrainerIds),
  ]);
  return {
    dryRun: true,
    generatedAt: now,
    policy: { mediaDays: 90, structuredMonths: 12 },
    media: { trainerIds: mediaTrainerIds, records: mediaRecords },
    structured: {
      trainerIds: structuredTrainerIds,
      records: structuredRecords,
    },
  };
};
