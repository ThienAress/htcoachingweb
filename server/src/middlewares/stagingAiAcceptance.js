import { claimStagingAiAcceptance } from "../services/ai/stagingAiAcceptance.service.js";

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
    return next();
  } catch {
    return res.status(403).json({
      success: false,
      code: "STAGING_AI_ACCEPTANCE_REJECTED",
      message: "Yêu cầu kiểm tra staging không hợp lệ.",
    });
  }
};
