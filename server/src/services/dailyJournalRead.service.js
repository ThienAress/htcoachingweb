import DailyJournal from "../models/DailyJournal.js";
import DailyJournalRevision from "../models/DailyJournalRevision.js";
import { assertTrainerJournalRead } from "./dailyJournalAccess.service.js";
import {
  toDailyJournalDto,
  toDailyJournalRevisionDto,
} from "./dailyJournalDto.service.js";

export const getMyDailyJournal = async ({ clientId, dateKey }) =>
  toDailyJournalDto(
    await DailyJournal.findOne({ clientId, dateKey }).lean(),
  );

export const getTrainerDailyJournal = async ({
  actor,
  clientId,
  dateKey,
}) => {
  await assertTrainerJournalRead({ actor, clientId });
  return toDailyJournalDto(
    await DailyJournal.findOne({ clientId, dateKey }).lean(),
    { includePrivate: false },
  );
};

export const listDailyJournalRevisions = async ({
  clientId,
  dateKey,
  page = 1,
  limit = 20,
}) => {
  const journal = await DailyJournal.findOne({ clientId, dateKey })
    .select("_id")
    .lean();
  if (!journal) return { items: [], total: 0, page, limit };
  const filter = { journalId: journal._id, clientId };
  const [documents, total] = await Promise.all([
    DailyJournalRevision.find(filter)
      .select("-payloadFingerprint")
      .sort({ revision: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DailyJournalRevision.countDocuments(filter),
  ]);
  return {
    items: documents.map(toDailyJournalRevisionDto),
    total,
    page,
    limit,
  };
};
