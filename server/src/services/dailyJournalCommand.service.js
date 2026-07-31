import DailyJournal from "../models/DailyJournal.js";
import DailyJournalRevision from "../models/DailyJournalRevision.js";
import { incrementMetric } from "../observability/metrics.js";
import { journalError } from "./dailyJournalAccess.service.js";

export const findJournalReplay = async ({
  actorId,
  requestId,
  action,
  payloadFingerprint,
  session = null,
}) => {
  let query = DailyJournalRevision.findOne({ actorId, requestId }).select(
    "+payloadFingerprint",
  );
  if (session) query = query.session(session);
  const revision = await query;
  if (!revision) return null;
  const sameAction =
    revision.action === action ||
    (action === "update" && revision.action === "create");
  if (!sameAction || revision.payloadFingerprint !== payloadFingerprint) {
    throw journalError(
      409,
      "requestId đã được dùng với thao tác hoặc dữ liệu khác",
      "REQUEST_ID_REUSED",
    );
  }
  let journalQuery = DailyJournal.findById(revision.journalId);
  if (session) journalQuery = journalQuery.session(session);
  const journal = await journalQuery;
  incrementMetric("daily_journal.idempotency_hits");
  return { journal, idempotentReplay: true };
};

export const createJournalRevision = ({
  journal,
  actor,
  action,
  reason,
  requestId,
  payloadFingerprint,
  changes,
  session,
}) =>
  DailyJournalRevision.create(
    [
      {
        journalId: journal._id,
        clientId: journal.clientId,
        revision: journal.revision,
        actorId: actor.id,
        actorRole: actor.role === "admin" ? "admin" : "user",
        action,
        reason,
        requestId,
        payloadFingerprint,
        changes,
      },
    ],
    { session },
  );
