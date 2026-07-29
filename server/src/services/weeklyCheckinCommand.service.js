import WeeklyCheckin from "../models/WeeklyCheckin.js";
import WeeklyCheckinRevision from "../models/WeeklyCheckinRevision.js";
import { incrementMetric } from "../observability/metrics.js";
import { weeklyCheckinError } from "./weeklyCheckinAccess.service.js";

export const findWeeklyCheckinReplay = async ({
  actorId,
  requestId,
  action,
  payloadFingerprint,
  session = null,
}) => {
  let query = WeeklyCheckinRevision.findOne({ actorId, requestId }).select(
    "+payloadFingerprint",
  );
  if (session) query = query.session(session);
  const revision = await query;
  if (!revision) return null;
  const sameAction =
    revision.action === action ||
    (action === "update" && revision.action === "create");
  if (!sameAction || revision.payloadFingerprint !== payloadFingerprint) {
    throw weeklyCheckinError(
      409,
      "requestId đã được dùng với thao tác hoặc dữ liệu khác",
      "WEEKLY_CHECKIN_REQUEST_ID_REUSED",
    );
  }
  let checkinQuery = WeeklyCheckin.findById(revision.checkinId);
  if (session) checkinQuery = checkinQuery.session(session);
  const checkin = await checkinQuery;
  incrementMetric("weekly_checkin.idempotency_hits");
  return { checkin, idempotentReplay: true };
};

export const createWeeklyCheckinRevision = ({
  checkin,
  actor,
  action,
  reason,
  requestId,
  payloadFingerprint,
  changes,
  session,
}) =>
  WeeklyCheckinRevision.create(
    [
      {
        checkinId: checkin._id,
        clientId: checkin.clientId,
        revision: checkin.revision,
        actorId: actor.id,
        actorRole: actor.role,
        action,
        reason,
        requestId,
        payloadFingerprint,
        changes,
      },
    ],
    { session },
  );
