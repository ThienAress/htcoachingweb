import {
  getCurrentDepositPolicy,
  updateDepositBonusRates,
} from "../services/depositPolicy.service.js";
import { safeLog } from "../utils/safeLogger.js";

const actorFromRequest = (req) => ({
  id: req.user.id,
  role: req.user.role,
  ipAddress: req.ip,
  userAgent: req.get("User-Agent"),
});

const sendPolicyError = (res, error, event) => {
  const status = error.status || 500;
  if (status >= 500) safeLog.error(event, error);
  return res.status(status).json({
    success: false,
    code: error.code || "DEPOSIT_POLICY_OPERATION_FAILED",
    message: status >= 500 ? "Lỗi hệ thống khi xử lý chính sách nạp tiền" : error.message,
  });
};

export const getDepositPolicy = async (_req, res) => {
  try {
    const policy = await getCurrentDepositPolicy();
    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    return sendPolicyError(res, error, "financial.deposit_policy_read_failed");
  }
};

export const updateDepositPolicy = async (req, res) => {
  try {
    const result = await updateDepositBonusRates({
      rates: req.body?.rates,
      actor: actorFromRequest(req),
    });
    return res.status(200).json({
      success: true,
      changed: result.changed,
      message: result.changed
        ? "Đã cập nhật tỷ lệ thưởng cho hóa đơn mới"
        : "Tỷ lệ thưởng không thay đổi",
      data: result.policy,
    });
  } catch (error) {
    return sendPolicyError(res, error, "financial.deposit_policy_update_failed");
  }
};
