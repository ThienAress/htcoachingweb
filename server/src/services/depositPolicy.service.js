import mongoose from "mongoose";

import {
  buildDepositPolicy,
  calculateDepositCreditSnapshot,
  DEFAULT_DEPOSIT_BONUS_RATES,
  DEFAULT_DEPOSIT_TIER_LABELS,
  DEFAULT_DEPOSIT_TIER_MINIMUMS,
  DEPOSIT_POLICY,
  DEPOSIT_POLICY_ID,
  DEPOSIT_POLICY_KEY,
  DEPOSIT_TIER_DEFINITIONS,
  resolveDepositTier,
  validateDepositBonusRates,
  validateDepositTierLabels,
  validateDepositTierMinimums,
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

// Tài liệu cũ chưa có mốc nạp hoặc tên bậc thì dùng mặc định (lean() không tự điền default).
const thresholdsFromDocument = (document) => ({
  growth: document.minimums?.growth ?? DEFAULT_DEPOSIT_TIER_MINIMUMS.growth,
  premium: document.minimums?.premium ?? DEFAULT_DEPOSIT_TIER_MINIMUMS.premium,
});

const labelsFromDocument = (document) => ({
  starter: document.labels?.starter ?? DEFAULT_DEPOSIT_TIER_LABELS.starter,
  growth: document.labels?.growth ?? DEFAULT_DEPOSIT_TIER_LABELS.growth,
  premium: document.labels?.premium ?? DEFAULT_DEPOSIT_TIER_LABELS.premium,
});

const materializePolicy = (document) => {
  if (!document) return DEPOSIT_POLICY;
  const ratesValidation = validateDepositBonusRates(ratesFromDocument(document));
  const minimumsValidation = validateDepositTierMinimums(thresholdsFromDocument(document));
  const labelsValidation = validateDepositTierLabels(labelsFromDocument(document));
  if (
    !ratesValidation.valid ||
    !minimumsValidation.valid ||
    !labelsValidation.valid ||
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
    minimums: minimumsValidation.minimums,
    labels: labelsValidation.labels,
    policyVersion: document.policyVersion,
  });
};

export const getCurrentDepositPolicy = async ({ session } = {}) => {
  const query = DepositPolicy.findById(DEPOSIT_POLICY_ID).lean();
  if (session) query.session(session);
  return materializePolicy(await query);
};

const sameByTier = (left, right) =>
  DEPOSIT_TIER_DEFINITIONS.every(({ key }) => left[key] === right[key]);

const checked = (validation) => {
  if (!validation.valid) throw financialError(400, validation.code, validation.message);
  return validation;
};

// Cập nhật tỷ lệ thưởng và, nếu có gửi, mốc nạp và tên bậc. Thiếu thì giữ giá trị hiện tại.
export const updateDepositBonusRates = async ({ rates, thresholds, labels, actor }) => {
  const validation = checked(validateDepositBonusRates(rates));
  const requestedMinimums =
    thresholds === undefined ? null : checked(validateDepositTierMinimums(thresholds)).minimums;
  const requestedLabels =
    labels === undefined ? null : checked(validateDepositTierLabels(labels)).labels;

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
        const currentMinimums = Object.fromEntries(
          currentPolicy.tiers.map((tier) => [tier.key, tier.minAmount]),
        );
        const currentLabels = Object.fromEntries(
          currentPolicy.tiers.map((tier) => [tier.key, tier.label || ""]),
        );
        const nextMinimums = requestedMinimums || currentMinimums;
        const nextLabels = requestedLabels || currentLabels;
        if (
          sameByTier(currentRates, validation.rates) &&
          sameByTier(currentMinimums, nextMinimums) &&
          sameByTier(currentLabels, nextLabels)
        ) {
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
                minimums: { growth: nextMinimums.growth, premium: nextMinimums.premium },
                labels: nextLabels,
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
                minimums: { growth: nextMinimums.growth, premium: nextMinimums.premium },
                labels: nextLabels,
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
                previousMinimums: currentMinimums,
                nextMinimums,
                previousLabels: currentLabels,
                nextLabels,
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
    deposit.bonusTierMinAmount,
    deposit.policyVersion,
  ];
  if (fields.every((value) => value === undefined || value === null)) {
    return {
      bonusRate: 0,
      bonusAmount: 0,
      creditedAmount: amount,
      bonusTierKey: null,
      bonusTierMinAmount: null,
      policyVersion: null,
      legacy: true,
    };
  }

  // Hóa đơn mới lưu mốc của bậc lúc tạo nên vẫn đúng khi admin đổi mốc sau đó.
  // Hóa đơn cũ chưa lưu mốc: tạo trong thời mốc cố định nên đối chiếu với mốc mặc định.
  const hasSnapshotMinimum =
    deposit.bonusTierMinAmount !== undefined && deposit.bonusTierMinAmount !== null;
  const tierMatches = hasSnapshotMinimum
    ? Number.isSafeInteger(deposit.bonusTierMinAmount) &&
      amount >= deposit.bonusTierMinAmount &&
      (deposit.bonusTierKey === "starter"
        ? deposit.bonusTierMinAmount === DEPOSIT_POLICY.minAmount
        : deposit.bonusTierMinAmount > DEPOSIT_POLICY.minAmount)
    : resolveDepositTier(DEPOSIT_POLICY, amount)?.key === deposit.bonusTierKey;
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
    tierMatches &&
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
    bonusTierMinAmount: hasSnapshotMinimum ? deposit.bonusTierMinAmount : null,
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
