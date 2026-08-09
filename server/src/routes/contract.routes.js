import { Router } from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
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

// Admin: Danh sách orders đã approved chưa có HĐ
router.get("/approved-orders", protect, requireRoles("admin"), getApprovedOrders);

// Admin: Danh sách hợp đồng
router.get("/", protect, requireRoles("admin"), getContracts);

// Admin: Tạo hợp đồng từ Order
router.post("/", protect, requireRoles("admin"), csrfProtection, validateCreateContract, createContract);

// Auth: Chi tiết hợp đồng
router.get("/:id", protect, getContractById);

// Admin: Cập nhật thông tin HĐ (trước khi gửi)
router.put("/:id", protect, requireRoles("admin"), csrfProtection, validateUpdateContract, updateContract);

// Admin: Gửi hợp đồng cho khách hàng (draft → sent + email)
router.post("/:id/send", protect, requireRoles("admin"), csrfProtection, sendContract);

// Auth: Đánh dấu đã xem
router.post("/:id/view", protect, csrfProtection, markAsViewed);

// Auth: Ký hợp đồng
router.post("/:id/sign", protect, csrfProtection, validateSignContract, signContract);

// Auth: Download PDF đã ký (admin)
router.get("/:id/download", protect, downloadContract);

// Auth: Download PDF (KH — 1 lần duy nhất)
router.get("/:id/client-download", protect, clientDownloadContract);

// Admin: Hủy hợp đồng
router.put("/:id/cancel", protect, requireRoles("admin"), csrfProtection, cancelContract);

// Admin: Xóa hợp đồng
router.delete("/:id", protect, requireRoles("admin"), csrfProtection, deleteContract);

export default router;
