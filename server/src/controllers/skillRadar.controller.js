import { getAdminSkillRadar } from "../services/skillRadar.service.js";
import { safeLog } from "../utils/safeLogger.js";

export const getSkillRadar = (_req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: getAdminSkillRadar(),
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
