import WalletTransaction from "../models/WalletTransaction.js";

export const hasActiveLegacyDepositCredit = async ({
  depositRequestId,
  session,
}) => {
  if (!depositRequestId) return false;
  const credits = await WalletTransaction.find({
    referenceType: "deposit_request",
    referenceId: depositRequestId,
    type: "deposit",
    status: "success",
    reversalOf: null,
  })
    .select("_id")
    .session(session)
    .lean();
  if (credits.length === 0) return false;
  const reversalCount = await WalletTransaction.countDocuments({
    reversalOf: { $in: credits.map((entry) => entry._id) },
    type: "reversal",
    status: "success",
  }).session(session);
  return credits.length > reversalCount;
};
