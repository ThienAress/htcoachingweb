import AiUsageRecord, {
  AI_USAGE_OPERATIONS,
  AI_USAGE_RETENTION_DAYS,
} from "../models/AiUsageRecord.js";
import { resolveAiPrices } from "../config/aiPricing.js";

const MAX_RECORDS = 50_000;
const DEFAULT_DAYS = 7;

export const parseAiUsageReportDays = (value) => {
  if (value === undefined || value === "") return DEFAULT_DAYS;
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= AI_USAGE_RETENTION_DAYS
    ? days
    : null;
};

const percentile = (sorted, ratio) => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(ratio * sorted.length) - 1);
  return sorted[Math.max(0, index)];
};

const round = (value) => Math.round(value * 1e6) / 1e6;

const summarize = (records) => {
  const costs = records.map((record) => record.estimatedCostUsd || 0).sort((a, b) => a - b);
  const total = costs.reduce((sum, cost) => sum + cost, 0);
  const sumOf = (path) => records.reduce(
    (sum, record) => sum + (path.split(".").reduce((value, key) => value?.[key], record) || 0),
    0,
  );
  const count = records.length;
  return {
    count,
    totalCostUsd: round(total),
    avgCostUsd: count ? round(total / count) : 0,
    p50CostUsd: round(percentile(costs, 0.5)),
    p95CostUsd: round(percentile(costs, 0.95)),
    maxCostUsd: round(costs.at(-1) || 0),
    avgDeepseekCalls: count ? round(sumOf("deepseek.calls") / count) : 0,
    avgPromptTokens: count ? Math.round(sumOf("deepseek.promptTokens") / count) : 0,
    avgOutputTokens: count ? Math.round(sumOf("deepseek.outputTokens") / count) : 0,
    cacheHitRatio: sumOf("deepseek.promptTokens")
      ? round(sumOf("deepseek.cacheHitTokens") / sumOf("deepseek.promptTokens"))
      : 0,
    braveContextCalls: sumOf("brave.contextCalls"),
    braveImageCalls: sumOf("brave.imageCalls"),
    geminiCalls: sumOf("gemini.calls"),
  };
};

/**
 * Tổng hợp chi phí ước tính theo loại thao tác và nhóm người dùng trong N ngày gần nhất.
 */
export const getAiUsageSummary = async ({ days = DEFAULT_DAYS, now = new Date() } = {}) => {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const records = await AiUsageRecord.find({ createdAt: { $gte: since } })
    .select("operation tier deepseek gemini brave estimatedCostUsd -_id")
    .sort({ createdAt: -1 })
    .limit(MAX_RECORDS)
    .lean();

  const byOperation = AI_USAGE_OPERATIONS.map((operation) => ({
    operation,
    ...summarize(records.filter((record) => record.operation === operation)),
  }));
  const tiers = [...new Set(records.map((record) => record.tier))].sort();
  const byTier = tiers.map((tier) => ({
    tier,
    ...summarize(records.filter((record) => record.tier === tier)),
  }));

  return {
    days,
    since: since.toISOString(),
    truncated: records.length >= MAX_RECORDS,
    prices: resolveAiPrices(),
    overall: summarize(records),
    byOperation,
    byTier,
  };
};
