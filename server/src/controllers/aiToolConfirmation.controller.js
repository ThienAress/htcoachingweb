import {
  cancelAiToolAction,
  confirmAiToolAction,
} from "../services/ai/toolConfirmation.service.js";
import { safeLog } from "../utils/safeLogger.js";

const sendError = (res, error, operation) => {
  const status = error?.statusCode || 500;
  if (status >= 500) safeLog.error(`ai_confirmation.${operation}_failed`, error);
  return res.status(status).json({
    success: false,
    code:
      status >= 500
        ? "AI_TOOL_CONFIRMATION_FAILED"
        : error.code || "AI_TOOL_CONFIRMATION_FAILED",
    message:
      status >= 500
        ? "Không thể xử lý xác nhận lúc này"
        : error.message,
    ...(error?.consumed && { meta: { consumed: true } }),
  });
};

export const confirmAiTool = async (req, res) => {
  try {
    const data = await confirmAiToolAction({
      userId: req.user.id,
      token: req.body.token,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "confirm");
  }
};

export const cancelAiTool = async (req, res) => {
  try {
    const data = await cancelAiToolAction({
      userId: req.user.id,
      token: req.body.token,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "cancel");
  }
};
