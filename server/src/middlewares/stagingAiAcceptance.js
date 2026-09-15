import {
  claimStagingAiAcceptance,
  settleStagingAiAcceptance,
  STAGING_AI_ACCEPTANCE_HEADER,
  STAGING_AI_ACCEPTANCE_REQUEST_ID_HEADER,
} from "../services/ai/stagingAiAcceptance.service.js";

const attachPreHandlerSettlement = (req, res) => {
  let settlementStarted = false;
  const settleIfHandlerDidNotStart = (outcome) => {
    if (settlementStarted || req.stagingAiAcceptanceHandlerStarted || res.statusCode >= 500) return;
    settlementStarted = true;
    void settleStagingAiAcceptance(req.stagingAiAcceptance, outcome).catch(() => {
      // The trusted runner observes the admitted receipt and fails closed.
    });
  };
  res.once("finish", () => settleIfHandlerDidNotStart("rejected"));
  res.once("close", () => {
    req.stagingAiAcceptanceResponseClosed = true;
    if (!settlementStarted && !req.stagingAiAcceptanceHandlerStarted) {
      // A close event can race an in-flight quota mutation. Defer settlement
      // until the downstream chain either reconciles that mutation or fails
      // closed with the receipt still admitted.
      req.stagingAiAcceptanceClosedBeforeHandler = true;
    }
  });
};

export const prepareStagingAiAcceptance = async (req, res, next) => {
  if (!Object.hasOwn(req.body || {}, "stagingAcceptance")) return next();
  try {
    if (!req.aiChatRequest?.value || req.aiActor?.kind !== "user" ||
        String(req.aiActor.userId) !== String(req.user?.id)) throw new Error("Acceptance actor rejected");
    req.stagingAiAcceptance = await claimStagingAiAcceptance(req.body.stagingAcceptance, {
      request: req.body,
      actorId: String(req.user.id),
      origin: req.get("Origin"),
    });
    if (req.stagingAiAcceptance.action !== "ai_chat") throw new Error("Acceptance action rejected");
    attachPreHandlerSettlement(req, res);
    return next();
  } catch {
    return res.status(403).json({
      success: false,
      code: "STAGING_AI_ACCEPTANCE_REJECTED",
      message: "Yêu cầu kiểm tra staging không hợp lệ.",
    });
  }
};

export const prepareStagingAiAcceptanceSearch = async (req, res, next) => {
  const token = req.get(STAGING_AI_ACCEPTANCE_HEADER);
  if (!token) return next();
  try {
    const request = { query: req.query, requestId: req.get(STAGING_AI_ACCEPTANCE_REQUEST_ID_HEADER) };
    req.stagingAiAcceptance = await claimStagingAiAcceptance(token, {
      request, actorId: String(req.user?.id), origin: req.get("Origin"),
    });
    if (req.stagingAiAcceptance.action !== "kb_search") throw new Error("Acceptance action rejected");
    attachPreHandlerSettlement(req, res);
    return next();
  } catch {
    return res.status(403).json({ success: false, code: "STAGING_AI_ACCEPTANCE_REJECTED", message: "Yêu cầu kiểm tra staging không hợp lệ." });
  }
};

// Settlement is intentionally best-effort: an unavailable control write leaves an
// admitted receipt for the trusted runner to fail closed, without changing bytes.
export const settleStagingAiAcceptanceHandler = (handler) => async (req, res, next) => {
  let failure;
  req.stagingAiAcceptanceHandlerStarted = Boolean(req.stagingAiAcceptance);
  try {
    if (req.stagingAiAcceptanceClosedBeforeHandler) {
      try {
        if (typeof req.refundServiceUsage === "function") {
          await req.refundServiceUsage();
        }
        req.stagingAiAcceptanceOutcome = "aborted";
      } catch {
        req.stagingAiAcceptanceSettlementBlocked = true;
      }
    } else {
      await handler(req, res, next);
    }
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (req.stagingAiAcceptance && !req.stagingAiAcceptanceSettlementBlocked && res.statusCode < 500) {
      const outcome = req.stagingAiAcceptanceOutcome ||
        (failure ? "failed" : res.statusCode >= 400 ? "rejected" : "completed");
      try { await settleStagingAiAcceptance(req.stagingAiAcceptance, outcome); } catch { /* runner rejects non-settled receipt */ }
    }
  }
};
