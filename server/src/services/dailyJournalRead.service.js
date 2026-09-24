import DailyJournal from "../models/DailyJournal.js";
import DailyJournalRevision from "../models/DailyJournalRevision.js";
import {
  assertTrainerJournalRead,
  journalError,
} from "./dailyJournalAccess.service.js";
import { resolveCustomerDashboardAccess } from "./customerDashboardAccess.service.js";
import {
  toDailyJournalDto,
  toDailyJournalRevisionDto,
} from "./dailyJournalDto.service.js";

export const assertCustomerJournalRead = async (
  clientId,
  clientRole = "user",
) => {
  const access = await resolveCustomerDashboardAccess({
    id: clientId,
    role: clientRole,
  });
  if (access.accessMode === "blocked") {
    throw journalError(
      403,
      "Bạn cần có gói coaching hoặc HT Fitness+ còn hiệu lực để xem nhật ký",
      "JOURNAL_ENTITLEMENT_REQUIRED",
    );
  }
  return access;
};

export const getMyDailyJournal = async ({ clientId, clientRole, dateKey }) => {
  await assertCustomerJournalRead(clientId, clientRole);
  return toDailyJournalDto(
    await DailyJournal.findOne({ clientId, dateKey }).lean(),
  );
};

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
  clientRole,
  dateKey,
  page = 1,
  limit = 20,
}) => {
  await assertCustomerJournalRead(clientId, clientRole);
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
