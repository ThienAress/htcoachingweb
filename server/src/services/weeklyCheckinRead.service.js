import WeeklyCheckin from "../models/WeeklyCheckin.js";
import WeeklyCheckinRevision from "../models/WeeklyCheckinRevision.js";
import { assertTrainerWeeklyCheckinRead } from "./weeklyCheckinAccess.service.js";
import {
  toWeeklyCheckinDto,
  toWeeklyCheckinRevisionDto,
} from "./weeklyCheckinDto.service.js";

export const getMyWeeklyCheckin = async ({ clientId, weekStartDateKey }) =>
  toWeeklyCheckinDto(
    await WeeklyCheckin.findOne({ clientId, weekStartDateKey }).lean(),
  );

export const getTrainerWeeklyCheckin = async ({
  actor,
  clientId,
  weekStartDateKey,
}) => {
  await assertTrainerWeeklyCheckinRead({ actor, clientId });
  return toWeeklyCheckinDto(
    await WeeklyCheckin.findOne({
      clientId,
      weekStartDateKey,
      status: { $in: ["submitted", "reviewed"] },
    }).lean(),
  );
};

export const listWeeklyCheckinRevisions = async ({
  clientId,
  weekStartDateKey,
  page = 1,
  limit = 20,
}) => {
  const checkin = await WeeklyCheckin.findOne({
    clientId,
    weekStartDateKey,
  })
    .select("_id")
    .lean();
  if (!checkin) return { items: [], total: 0, page, limit };
  const filter = { checkinId: checkin._id, clientId };
  const [documents, total] = await Promise.all([
    WeeklyCheckinRevision.find(filter)
      .select("-payloadFingerprint -requestId")
      .sort({ revision: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    WeeklyCheckinRevision.countDocuments(filter),
  ]);
  return {
    items: documents.map(toWeeklyCheckinRevisionDto),
    total,
    page,
    limit,
  };
};
