import DailyJournal from "../models/DailyJournal.js";
import { addDaysToDateKey } from "../utils/dateKey.js";

const id = (value) => (value ? String(value) : null);

export const getTrainerClientAttention = async ({
  clientId,
  dateKey,
}) => {
  const recentStart = addDaysToDateKey(dateKey, -6);
  const wellnessJournals = await DailyJournal.find({
    clientId,
    status: "submitted",
    dateKey: { $gte: recentStart, $lte: dateKey },
    $or: [
      { "wellness.stress": { $gte: 8 } },
      { "wellness.soreness": { $gte: 8 } },
      { "wellness.pain": { $gte: 7 } },
    ],
  })
    .select("_id dateKey wellness.stress wellness.soreness wellness.pain")
    .sort({ dateKey: -1 })
    .limit(7)
    .lean();
  const wellnessItems = new Map();
  for (const journal of wellnessJournals) {
    for (const [code, active] of [
      ["stress_high", Number(journal.wellness?.stress) >= 8],
      ["soreness_high", Number(journal.wellness?.soreness) >= 8],
      ["pain_high", Number(journal.wellness?.pain) >= 7],
    ]) {
      if (!active) continue;
      const current = wellnessItems.get(code);
      wellnessItems.set(
        code,
        current
          ? { ...current, count: current.count + 1 }
          : {
              code,
              targetType: "daily_journal",
              targetId: id(journal._id),
              dateKey: journal.dateKey,
              count: 1,
            },
      );
    }
  }
  const items = [...wellnessItems.values()];
  return { items, count: items.length };
};
