import AiUsageRecord from "../models/AiUsageRecord.js";
import { estimateAiUsageCostUsd } from "../config/aiPricing.js";
import {
  createAiUsageMeter,
  runWithAiUsageMeter,
  snapshotAiUsage,
} from "../observability/aiUsageMeter.js";
import { safeLog } from "../utils/safeLogger.js";

export const resolveAiUsageOperation = (serviceKey, req) => {
  if (serviceKey === "meal_scan") return "meal_scan";
  const parsed = req.aiChatRequest?.value;
  if (parsed?.image) return "chat_image";
  if (parsed?.webSearch === true) return "chat_smart_search";
  return "chat";
};

const hasProviderCalls = (usage) =>
  usage.deepseek.calls + usage.gemini.calls +
    usage.brave.contextCalls + usage.brave.imageCalls > 0;

/**
 * Đo chi phí provider của một lượt AI và lưu một AiUsageRecord khi response kết thúc.
 * Đặt sau quota middleware để request bị từ chối không tạo bản ghi. Lỗi ghi chỉ log,
 * không bao giờ ảnh hưởng response.
 */
export const meterAiUsage = (serviceKey) => (req, res, next) => {
  const meter = createAiUsageMeter();
  res.once("close", () => {
    const usage = snapshotAiUsage(meter);
    if (!hasProviderCalls(usage)) return;
    const actor = req.aiActor || req.mealScanActor;
    const operation = resolveAiUsageOperation(serviceKey, req);
    AiUsageRecord.create({
      serviceKey,
      operation,
      tier: String(req.serviceAccessTier || "unknown").slice(0, 40),
      actorKind: actor?.kind === "user" ? "user" : "guest",
      httpStatus: res.statusCode,
      aborted: !res.writableFinished,
      deepseek: usage.deepseek,
      gemini: usage.gemini,
      brave: usage.brave,
      estimatedCostUsd: estimateAiUsageCostUsd(usage),
    }).catch((error) => {
      safeLog.warn("ai.usage_record_failed", {
        serviceKey,
        operation,
        errorName: error?.name,
      });
    });
  });
  return runWithAiUsageMeter(meter, () => next());
};
