import Order from "../models/Order.js";

const candidateOwnerId = (candidate) =>
  candidate.clientId ?? candidate.ownerId;

export const excludeActiveCoachingClients = async (
  candidates,
  { session = null } = {},
) => {
  if (candidates.length === 0) return [];
  const clientIds = [
    ...new Set(candidates.map((item) => String(candidateOwnerId(item)))),
  ];
  let query = Order.distinct("userId", {
    userId: { $in: clientIds },
    status: "approved",
    sessions: { $gt: 0 },
  });
  if (session) query = query.session(session);
  const activeClientIds = new Set(
    (await query).map((clientId) => String(clientId)),
  );
  return candidates.filter(
    (candidate) =>
      !activeClientIds.has(String(candidateOwnerId(candidate))),
  );
};
