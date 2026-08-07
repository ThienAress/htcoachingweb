import { Router } from "express";
import {
  protect,
  requireRoles,
  requireTrainerAccess,
} from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  validateCreateContract,
  validateSignContract,
  validateUpdateContract,
} from "../middlewares/validation.js";
import {
  createContract,
  getContracts,
  getApprovedOrders,
  getContractById,
  updateContract,
  sendContract,
  signContract,
  downloadContract,
  cancelContract,
  markAsViewed,
  deleteContract,
  getMyContracts,
  clientDownloadContract,
} from "../controllers/contract.controller.js";

const router = Router();

// User: Danh sách HĐ của tôi (phải đặt TRƯỚC /:id)
router.get("/my", protect, getMyContracts);

// Admin/trainer: controller scope danh sách theo actor.
router.get("/approved-orders", protect, requireTrainerAccess, getApprovedOrders);

router.get("/", protect, requireTrainerAccess, getContracts);

router.post("/", protect, requireTrainerAccess, csrfProtection, validateCreateContract, createContract);

// Auth: Chi tiết hợp đồng
router.get("/:id", protect, getContractById);

// Admin/trainer: owner filter được kiểm tra lại trong controller/service.
router.put("/:id", protect, requireTrainerAccess, csrfProtection, validateUpdateContract, updateContract);

// Admin: Gửi hợp đồng cho khách hàng (draft → sent + email)
router.post("/:id/send", protect, requireTrainerAccess, csrfProtection, sendContract);

// Auth: Đánh dấu đã xem
router.post("/:id/view", protect, csrfProtection, markAsViewed);

// Auth: Ký hợp đồng
router.post("/:id/sign", protect, csrfProtection, validateSignContract, signContract);

// Auth: Download PDF đã ký (admin)
router.get("/:id/download", protect, downloadContract);

// Auth: Download PDF (KH — 1 lần duy nhất)
router.get("/:id/client-download", protect, clientDownloadContract);

// Admin: Hủy hợp đồng
router.put("/:id/cancel", protect, requireTrainerAccess, csrfProtection, cancelContract);

// Admin: Xóa hợp đồng
router.delete("/:id", protect, requireRoles("admin"), csrfProtection, deleteContract);

export default router;
