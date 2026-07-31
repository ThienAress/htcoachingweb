import DailyJournal from "../models/DailyJournal.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import {
  addDaysToDateKey,
  getMonthWeekPeriod,
  getPreviousMonthWeekPeriod,
} from "../utils/dateKey.js";

const id = (value) => (value ? String(value) : null);

export const getTrainerClientAttention = async ({
  clientId,
  dateKey,
}) => {
  const currentWeek = getMonthWeekPeriod(dateKey).startDateKey;
  const previousWeek = getPreviousMonthWeekPeriod(dateKey).startDateKey;
  const recentStart = addDaysToDateKey(dateKey, -6);
  const [painJournals, weeklyCheckins] = await Promise.all([
    DailyJournal.find({
      clientId,
      dateKey: { $gte: recentStart, $lte: dateKey },
      "wellness.pain": { $gt: 0 },
    })
      .select("_id dateKey")
      .sort({ dateKey: -1 })
      .limit(7)
      .lean(),
    WeeklyCheckin.find({
      clientId,
      weekStartDateKey: { $in: [previousWeek, currentWeek] },
    })
      .select("_id weekStartDateKey status")
      .limit(2)
      .lean(),
  ]);
  const items = painJournals.map((journal) => ({
    code: "pain_reported",
    targetType: "daily_journal",
    targetId: id(journal._id),
    dateKey: journal.dateKey,
  }));
  const byWeek = new Map(
    weeklyCheckins.map((checkin) => [
      checkin.weekStartDateKey,
      checkin,
    ]),
  );
  const previous = byWeek.get(previousWeek);
  if (!previous || previous.status === "draft") {
    items.push({
      code: "weekly_checkin_missing",
      targetType: "weekly_checkin",
      targetId: previous ? id(previous._id) : null,
      dateKey: previousWeek,
    });
  }
  for (const checkin of weeklyCheckins) {
    if (checkin.status === "submitted") {
      items.push({
        code: "weekly_review_pending",
        targetType: "weekly_checkin",
        targetId: id(checkin._id),
        dateKey: checkin.weekStartDateKey,
      });
    }
  }
  return { items, count: items.length };
};
