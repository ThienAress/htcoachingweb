import crypto from "crypto";

import IncomingBankTransaction from "../models/IncomingBankTransaction.js";

const digest = (secret, values) =>
  crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(values))
    .digest("hex");

const maskAccountNumber = (accountNumber) =>
  "*".repeat(Math.max(0, accountNumber.length - 4)) + accountNumber.slice(-4);

const sourceAlias = (transaction) => ({
  source: transaction.source,
  providerTransactionId: transaction.providerTransactionId,
});

const duplicateFilter = (transaction, canonicalReferenceHash) => ({
  $or: [
    {
      provider: transaction.provider,
      source: transaction.source,
      providerTransactionId: transaction.providerTransactionId,
    },
    ...(canonicalReferenceHash
      ? [{ provider: transaction.provider, canonicalReferenceHash }]
      : []),
  ],
});

const classifyInitialState = (transaction, config) => {
  if (transaction.accountNumber !== config.accountNumber) {
    return { status: "ignored", reviewReason: "ACCOUNT_MISMATCH" };
  }
  if (transaction.transferType !== "in") {
    return { status: "ignored", reviewReason: "OUTGOING_TRANSACTION" };
  }
  if (transaction.transactionAt < config.cutoverAt) {
    return { status: "needs_review", reviewReason: "PRE_CUTOVER_TRANSACTION" };
  }
  if (transaction.depositCodeAmbiguous) {
    return {
      status: "needs_review",
      reviewReason: "CODE_MISMATCH_OR_AMBIGUOUS",
    };
  }
  return { status: "received", reviewReason: null };
};

const attachAlias = async (existing, transaction) => {
  const alias = sourceAlias(transaction);
  const alreadyPresent = (existing.sourceAliases || []).some(
    (item) =>
      item.source === alias.source &&
      item.providerTransactionId === alias.providerTransactionId,
  );
  if (!alreadyPresent) {
    await IncomingBankTransaction.updateOne(
      { _id: existing._id },
      { $addToSet: { sourceAliases: alias } },
    );
  }
  return existing;
};

export const ingestBankTransaction = async ({ transaction, config }) => {
  const canonicalReferenceHash = transaction.referenceCode
    ? digest(config.dataHashSecret, [
        transaction.provider,
        transaction.gateway.toUpperCase(),
        transaction.accountNumber,
        transaction.referenceCode.toUpperCase(),
      ])
    : null;
  const fingerprintDigest = digest(config.dataHashSecret, [
    transaction.gateway.toUpperCase(),
    transaction.accountNumber,
    transaction.transferType,
    transaction.amount,
    transaction.transactionAt.toISOString(),
    transaction.depositCode,
    transaction.depositCodeAmbiguous,
    transaction.content,
  ]);
  const filter = duplicateFilter(transaction, canonicalReferenceHash);
  const existing = await IncomingBankTransaction.findOne(filter).lean();
  if (existing) {
    await attachAlias(existing, transaction);
    return { incoming: existing, duplicate: true };
  }

  let initial = classifyInitialState(transaction, config);
  if (
    !canonicalReferenceHash &&
    (await IncomingBankTransaction.exists({
      provider: transaction.provider,
      source: { $ne: transaction.source },
      fingerprintDigest,
    }))
  ) {
    initial = {
      status: "needs_review",
      reviewReason: "POSSIBLE_CROSS_CHANNEL_DUPLICATE",
    };
  }
  const sourceAliases = [sourceAlias(transaction)];
  try {
    const incoming = await IncomingBankTransaction.create({
      provider: transaction.provider,
      source: transaction.source,
      providerTransactionId: transaction.providerTransactionId,
      sourceAliases,
      canonicalReferenceHash,
      payloadDigest: digest(config.dataHashSecret, [
        transaction.source,
        transaction.providerTransactionId,
        transaction.gateway,
        transaction.accountNumber,
        transaction.transferType,
        transaction.amount,
        transaction.transactionAt.toISOString(),
        transaction.depositCode,
        transaction.depositCodeAmbiguous,
        transaction.referenceCode,
        transaction.content,
      ]),
      fingerprintDigest,
      gateway: transaction.gateway,
      maskedAccountNumber: maskAccountNumber(transaction.accountNumber),
      transferType: transaction.transferType,
      amount: transaction.amount,
      transactionAt: transaction.transactionAt,
      depositCode: transaction.depositCode,
      ...initial,
    });
    return { incoming: incoming.toObject(), duplicate: false };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const concurrent = await IncomingBankTransaction.findOne(filter).lean();
    if (!concurrent) throw error;
    await attachAlias(concurrent, transaction);
    return { incoming: concurrent, duplicate: true };
  }
};
