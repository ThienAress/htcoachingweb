import { requireSePayWebhookConfig, SePayConfigError } from "../config/sepay.js";
import { incrementMetric } from "../observability/metrics.js";
import { ingestBankTransaction } from "../services/bankTransactionIngestion.service.js";
import { processIncomingBankTransaction } from "../services/bankTransactionSettlement.service.js";
import {
  normalizeSePayWebhook,
  SePayProviderError,
  verifySePayWebhookSignature,
} from "../services/sepayBankTransaction.provider.js";
import { safeLog } from "../utils/safeLogger.js";

const parseRawJson = (rawBody) => {
  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new SePayProviderError(
      "MALFORMED_PAYLOAD",
      "Payload webhook không phải JSON hợp lệ",
      400,
    );
  }
};

export const receiveSePayWebhook = async (req, res) => {
  try {
    const config = requireSePayWebhookConfig();
    verifySePayWebhookSignature({
      rawBody: req.body,
      signatureHeader: req.get("x-sepay-signature"),
      timestampHeader: req.get("x-sepay-timestamp"),
      secret: config.webhookSecret,
    });
    const transaction = normalizeSePayWebhook(parseRawJson(req.body));
    const result = await ingestBankTransaction({ transaction, config });
    const settlement = await processIncomingBankTransaction({
      incomingId: result.incoming._id,
      config,
    });
    incrementMetric("financial.sepay_webhook_received");
    if (result.duplicate) incrementMetric("financial.sepay_webhook_duplicates");
    if (settlement.status === "settled" && !settlement.skipped) {
      incrementMetric("financial.sepay_auto_settled");
    }
    if (settlement.status === "needs_review" && !settlement.skipped) {
      incrementMetric("financial.sepay_needs_review");
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof SePayConfigError || error instanceof SePayProviderError) {
      if (error.status === 401) {
        incrementMetric("financial.sepay_webhook_auth_failed");
      }
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    safeLog.error("financial.sepay_webhook_failed", error);
    return res.status(500).json({
      success: false,
      code: "SEPAY_WEBHOOK_FAILED",
      message: "Không thể ghi nhận giao dịch ngân hàng",
    });
  }
};
