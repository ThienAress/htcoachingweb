import {
  buildTrainerTransferPreview,
  executeTrainerTransfer,
  listActiveTrainerAssignments,
  listRecentTrainerOrders,
} from "../services/trainerTransfer.service.js";
import { safeLog } from "../utils/safeLogger.js";

const handleTrainerTransferError = (error, res, event) => {
  if (Number.isInteger(error?.status) && error?.code) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
  safeLog.error(event, error);
  return res.status(500).json({
    success: false,
    code: "TRAINER_COORDINATION_FAILED",
    message: "Không thể xử lý điều phối HLV lúc này",
  });
};

export const getRecentTrainerOrders = async (req, res) => {
  try {
    const result = await listRecentTrainerOrders(req.query);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleTrainerTransferError(error, res, "trainer_coordination.orders_failed");
  }
};

export const getActiveTrainerAssignments = async (req, res) => {
  try {
    const result = await listActiveTrainerAssignments(req.query);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleTrainerTransferError(error, res, "trainer_coordination.assignments_failed");
  }
};

export const previewTrainerTransfer = async (req, res) => {
  try {
    const preview = await buildTrainerTransferPreview(req.body);
    return res.json({ success: true, data: preview });
  } catch (error) {
    return handleTrainerTransferError(error, res, "trainer_coordination.preview_failed");
  }
};

export const transferTrainer = async (req, res) => {
  try {
    const result = await executeTrainerTransfer({
      ...req.body,
      actorId: req.user.id,
    });
    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      data: {
        transfer: result.transfer,
        replayed: result.replayed,
      },
      message: result.replayed
        ? "Yêu cầu chuyển HLV đã được xử lý trước đó"
        : "Đã chuyển HLV thành công",
    });
  } catch (error) {
    return handleTrainerTransferError(error, res, "trainer_coordination.transfer_failed");
  }
};
