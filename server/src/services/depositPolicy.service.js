import mongoose from "mongoose";

import {
  buildDepositPolicy,
  calculateDepositCreditSnapshot,
  DEFAULT_DEPOSIT_BONUS_RATES,
  DEPOSIT_POLICY,
  DEPOSIT_POLICY_ID,
  DEPOSIT_POLICY_KEY,
  DEPOSIT_TIER_DEFINITIONS,
  resolveDepositTier,
  validateDepositBonusRates,
} from "../constants/depositPolicy.js";
import AuditLog from "../models/AuditLog.js";
import DepositPolicy from "../models/DepositPolicy.js";

const MAX_POLICY_UPDATE_ATTEMPTS = 3;

const financialError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

const ratesFromDocument = (document) => ({
  starter: document.rates.starter,
  growth: document.rates.growth,
  premium: document.rates.premium,
});

const materializePolicy = (document) => {
  if (!document) return DEPOSIT_POLICY;
  const ratesValidation = validateDepositBonusRates(ratesFromDocument(document));
  if (
    !ratesValidation.valid ||
    !Number.isSafeInteger(document.policyVersion) ||
    document.policyVersion < 1
  ) {
    throw financialError(
      503,
      "DEPOSIT_POLICY_INVALID",
      "Chính sách nạp tiền hiện không hợp lệ",
    );
  }
  return buildDepositPolicy({
    rates: ratesValidation.rates,
    policyVersion: document.policyVersion,
  });
};

export const getCurrentDepositPolicy = async ({ session } = {}) => {
  const query = DepositPolicy.findById(DEPOSIT_POLICY_ID).lean();
  if (session) query.session(session);
  return materializePolicy(await query);
};

const sameRates = (left, right) =>
  DEPOSIT_TIER_DEFINITIONS.every(({ key }) => left[key] === right[key]);

export const updateDepositBonusRates = async ({ rates, actor }) => {
  const validation = validateDepositBonusRates(rates);
  if (!validation.valid) {
    throw financialError(400, validation.code, validation.message);
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_POLICY_UPDATE_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let outcome;
      await session.withTransaction(async () => {
        const currentDocument = await DepositPolicy.findById(DEPOSIT_POLICY_ID)
          .session(session)
          .lean();
        const currentPolicy = materializePolicy(currentDocument);
        const currentRates = Object.fromEntries(
          currentPolicy.tiers.map((tier) => [tier.key, tier.bonusRate]),
        );
        if (sameRates(currentRates, validation.rates)) {
          outcome = { changed: false, policy: currentPolicy };
          return;
        }

        const nextVersion = currentPolicy.policyVersion + 1;
        let updated;
        if (currentDocument) {
          updated = await DepositPolicy.findOneAndUpdate(
            {
              _id: currentDocument._id,
              policyVersion: currentDocument.policyVersion,
            },
            {
              $set: {
                rates: validation.rates,
                updatedBy: actor.id,
                policyVersion: nextVersion,
              },
            },
            { new: true, runValidators: true, session },
          ).lean();
          if (!updated) {
            throw financialError(
              409,
              "DEPOSIT_POLICY_VERSION_CONFLICT",
              "Chính sách vừa được cập nhật bởi yêu cầu khác",
            );
          }
        } else {
          const [created] = await DepositPolicy.create(
            [
              {
                _id: DEPOSIT_POLICY_ID,
                policyKey: DEPOSIT_POLICY_KEY,
                policyVersion: nextVersion,
                rates: validation.rates,
                updatedBy: actor.id,
              },
            ],
            { session },
          );
          updated = created.toObject();
        }

        await AuditLog.create(
          [
            {
              actorId: actor.id,
              actorRole: actor.role,
              ipAddress: actor.ipAddress,
              userAgent: actor.userAgent,
              action: "update_deposit_policy",
              targetType: "deposit_policy",
              targetKey: DEPOSIT_POLICY_KEY,
              metadata: {
                previousRates: currentRates,
                nextRates: validation.rates,
                previousVersion: currentPolicy.policyVersion,
                nextVersion,
              },
            },
          ],
          { session },
        );
        outcome = { changed: true, policy: materializePolicy(updated) };
      });
      return outcome;
    } catch (error) {
      lastError = error;
      const retryable =
        error?.code === 11000 ||
        error?.code === "DEPOSIT_POLICY_VERSION_CONFLICT" ||
        error?.errorLabels?.includes?.("TransientTransactionError");
      if (!retryable || attempt === MAX_POLICY_UPDATE_ATTEMPTS) throw error;
    } finally {
      await session.endSession();
    }
  }
  throw lastError;
};

export const createDepositCreditSnapshot = (policy, amount) =>
  calculateDepositCreditSnapshot(policy, amount);

export const resolveDepositCreditSnapshot = (deposit) => {
  const amount = deposit?.amount;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw financialError(
      409,
      "DEPOSIT_AMOUNT_INVALID",
      "Số tiền yêu cầu nạp không hợp lệ; cần đối soát",
    );
  }
  const fields = [
    deposit.bonusRate,
    deposit.bonusAmount,
    deposit.creditedAmount,
    deposit.bonusTierKey,
    deposit.policyVersion,
  ];
  if (fields.every((value) => value === undefined || value === null)) {
    return {
      bonusRate: 0,
      bonusAmount: 0,
      creditedAmount: amount,
      bonusTierKey: null,
      policyVersion: null,
      legacy: true,
    };
  }

  const expectedTier = resolveDepositTier(DEPOSIT_POLICY, amount);
  const expectedBonus = Math.floor((amount * deposit.bonusRate) / 100);
  const valid =
    Number.isSafeInteger(deposit.bonusRate) &&
    deposit.bonusRate >= 0 &&
    deposit.bonusRate <= 100 &&
    Number.isSafeInteger(deposit.bonusAmount) &&
    deposit.bonusAmount >= 0 &&
    Number.isSafeInteger(deposit.creditedAmount) &&
    deposit.creditedAmount > 0 &&
    DEPOSIT_TIER_DEFINITIONS.some(({ key }) => key === deposit.bonusTierKey) &&
    expectedTier?.key === deposit.bonusTierKey &&
    Number.isSafeInteger(deposit.policyVersion) &&
    deposit.policyVersion >= 1 &&
    deposit.bonusAmount === expectedBonus &&
    deposit.creditedAmount === amount + deposit.bonusAmount;
  if (!valid) {
    throw financialError(
      409,
      "DEPOSIT_CREDIT_SNAPSHOT_INVALID",
      "Snapshot thưởng nạp tiền không hợp lệ; cần đối soát",
    );
  }
  return {
    bonusRate: deposit.bonusRate,
    bonusAmount: deposit.bonusAmount,
    creditedAmount: deposit.creditedAmount,
    bonusTierKey: deposit.bonusTierKey,
    policyVersion: deposit.policyVersion,
    legacy: false,
  };
};

export const resolveIncomingCreditedAmount = (incoming) => {
  if (incoming?.creditedAmount === undefined || incoming?.creditedAmount === null) {
    return incoming?.amount;
  }
  if (!Number.isSafeInteger(incoming.creditedAmount) || incoming.creditedAmount <= 0) {
    throw financialError(
      409,
      "INCOMING_CREDIT_SNAPSHOT_INVALID",
      "Snapshot cộng ví của giao dịch ngân hàng không hợp lệ; cần đối soát",
    );
  }
  return incoming.creditedAmount;
};

export const DEFAULT_DEPOSIT_RATES = DEFAULT_DEPOSIT_BONUS_RATES;
