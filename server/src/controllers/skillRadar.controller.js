import {
  createSkillRadarSource,
  getAdminSkillRadarWithDynamicSources,
  previewSkillRadarSource,
} from "../services/skillRadar.service.js";
import { safeLog } from "../utils/safeLogger.js";

const sendRadarError = (res, error, fallbackCode, fallbackMessage) => {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  if (status >= 500) safeLog.error("skill_radar.request_failed", error);
  return res.status(status).json({
    success: false,
    code: error.code || fallbackCode,
    message: status >= 500 ? fallbackMessage : error.message,
    ...(error.retryAt ? { retryAt: error.retryAt } : {}),
  });
};

export const getSkillRadar = async (_req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: await getAdminSkillRadarWithDynamicSources(),
    });
  } catch (error) {
    safeLog.error("skill_radar.read_failed", error);
    return res.status(500).json({
      success: false,
      code: "SKILL_RADAR_READ_FAILED",
      message: "Không thể tải Radar công nghệ",
    });
  }
};

export const previewSource = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: await previewSkillRadarSource(req.body.sourceUrl),
    });
  } catch (error) {
    return sendRadarError(
      res,
      error,
      "SKILL_RADAR_PREVIEW_FAILED",
      "Không thể phân tích nguồn GitHub",
    );
  }
};

export const addSource = async (req, res) => {
  try {
    const item = await createSkillRadarSource(req.body, req.user.id);
    return res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    return sendRadarError(
      res,
      error,
      "SKILL_RADAR_CREATE_FAILED",
      "Không thể lưu nguồn Radar công nghệ",
    );
  }
};
