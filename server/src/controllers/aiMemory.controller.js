import {
  deleteAiMemoryKind,
  deleteAllAiMemory,
  exportAiMemory,
  getAiMemoryState,
  setAiMemoryConsent,
  upsertAiMemory,
} from "../services/aiMemory.service.js";
import { safeLog } from "../utils/safeLogger.js";

const sendError = (res, error, operation) => {
  const status = error?.statusCode || 500;
  if (status >= 500) safeLog.error(`ai_memory.${operation}_failed`, error);
  return res.status(status).json({
    success: false,
    code: status >= 500 ? "AI_MEMORY_FAILED" : error?.code || "AI_MEMORY_FAILED",
    message: status >= 500 ? "Không thể xử lý Trí nhớ AI lúc này" : error.message,
  });
};

export const getMyAiMemory = async (req, res) => {
  try {
    return res.json({ success: true, data: await getAiMemoryState(req.user.id) });
  } catch (error) {
    return sendError(res, error, "read");
  }
};

export const updateMyAiMemoryConsent = async (req, res) => {
  try {
    const data = await setAiMemoryConsent(req.user.id, req.body.enabled);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "consent");
  }
};

export const updateMyAiMemory = async (req, res) => {
  try {
    const data = await upsertAiMemory(
      req.user.id,
      req.params.kind,
      req.body.value,
    );
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "update");
  }
};

export const removeMyAiMemory = async (req, res) => {
  try {
    const data = await deleteAiMemoryKind(req.user.id, req.params.kind);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "delete_kind");
  }
};

export const exportMyAiMemory = async (req, res) => {
  try {
    return res.json({ success: true, data: await exportAiMemory(req.user.id) });
  } catch (error) {
    return sendError(res, error, "export");
  }
};

export const removeAllMyAiMemory = async (req, res) => {
  try {
    const data = await deleteAllAiMemory(req.user.id);
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "delete_all");
  }
};
