import * as contractService from "../services/contract.service.js";
import { sendContractMail } from "../utils/sendMail.js";

/**
 * POST /api/contracts — Tạo hợp đồng từ Order đã approved.
 */
export const createContract = async (req, res) => {
  try {
    const { orderId } = req.body;
    const contract = await contractService.createContract(
      orderId,
      req.user.id,
      req.ip,
      req.headers["user-agent"]
    );
    res.status(201).json({ success: true, data: contract });
  } catch (error) {
    const status = error.message.includes("không tồn tại") ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/contracts — Danh sách hợp đồng (admin).
 */
export const getContracts = async (req, res) => {
  try {
    const contracts = await contractService.getContracts(req.query);
    res.json({ success: true, data: contracts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/contracts/approved-orders — Danh sách orders chưa có HĐ.
 */
export const getApprovedOrders = async (req, res) => {
  try {
    const orders = await contractService.getApprovedOrdersWithoutContract();
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/contracts/:id — Chi tiết hợp đồng.
 * IDOR protection: chỉ admin hoặc client/trainer liên quan mới xem được.
 */
export const getContractById = async (req, res) => {
  try {
    const contract = await contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });
    }

    // IDOR check: chỉ admin, client hoặc trainer liên quan
    if (
      req.user.role !== "admin" &&
      contract.clientId?.toString() !== req.user.id.toString() &&
      contract.trainerId?.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Không có quyền truy cập hợp đồng này" });
    }

    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/contracts/:id — Cập nhật thông tin HĐ (draft only).
 */
export const updateContract = async (req, res) => {
  try {
    const contract = await contractService.updateContractDetails(req.params.id, req.body);
    res.json({ success: true, data: contract });
  } catch (error) {
    const status = error.message.includes("không tồn tại") ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/contracts/:id/send — Gửi HĐ cho khách hàng (draft → sent + email).
 */
export const sendContract = async (req, res) => {
  try {
    const contract = await contractService.sendToClient(
      req.params.id,
      req.ip,
      req.headers["user-agent"]
    );

    // Gửi email cho khách hàng
    const clientEmail = contract.clientInfo?.email;
    if (clientEmail) {
      const clientUrl = process.env.CLIENT_URL || "https://htcoachingweb.io.vn";
      const contractLink = `${clientUrl}/contracts/${contract._id}`;
      await sendContractMail(clientEmail, {
        clientName: contract.clientInfo.name,
        trainerName: contract.trainerInfo?.name || "HLV",
        packageName: contract.packageDetails?.packageName || "",
        sessions: contract.packageDetails?.sessions || 0,
        contractLink,
      });
    }

    res.json({ success: true, data: contract });
  } catch (error) {
    const status = error.message.includes("không tồn tại") ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/contracts/:id/sign — Ký hợp đồng.
 * IDOR protection: chỉ client liên quan mới ký được.
 */
export const signContract = async (req, res) => {
  try {
    // IDOR check: chỉ client liên quan mới ký được
    const existing = await contractService.getContractById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });
    }
    if (existing.clientId?.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: "Không có quyền ký hợp đồng này" });
    }

    const { signatureImage } = req.body;
    const contract = await contractService.signContract(
      req.params.id,
      signatureImage,
      req.ip,
      req.headers["user-agent"]
    );
    res.json({ success: true, data: contract });
  } catch (error) {
    const status = error.message.includes("không tồn tại") ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/contracts/:id/download — Download PDF đã ký.
 * IDOR protection: chỉ admin, client hoặc trainer liên quan.
 */
export const downloadContract = async (req, res) => {
  try {
    const contract = await contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });
    }

    // IDOR check
    if (
      req.user.role !== "admin" &&
      contract.clientId?.toString() !== req.user.id.toString() &&
      contract.trainerId?.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Không có quyền tải hợp đồng này" });
    }

    const stream = contractService.getSignedPdfStream(contract);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=hop-dong-${contract._id}.pdf`);
    stream.pipe(res);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/contracts/:id/cancel — Hủy hợp đồng.
 */
export const cancelContract = async (req, res) => {
  try {
    const contract = await contractService.cancelContract(
      req.params.id,
      req.ip,
      req.headers["user-agent"]
    );
    res.json({ success: true, data: contract });
  } catch (error) {
    const status = error.message.includes("không tồn tại") ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/contracts/:id/view — Đánh dấu đã xem.
 * IDOR protection: chỉ client liên quan.
 */
export const markAsViewed = async (req, res) => {
  try {
    // IDOR check: chỉ client liên quan
    const existing = await contractService.getContractById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hợp đồng" });
    }
    if (
      req.user.role !== "admin" &&
      existing.clientId?.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Không có quyền" });
    }

    const contract = await contractService.markAsViewed(
      req.params.id,
      req.ip,
      req.headers["user-agent"]
    );
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/contracts/:id — Xóa hợp đồng.
 */
export const deleteContract = async (req, res) => {
  try {
    await contractService.deleteContract(req.params.id);
    res.json({ success: true, message: "Đã xóa hợp đồng" });
  } catch (error) {
    const status = error.message.includes("không tồn tại") ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/contracts/my — Danh sách HĐ của user hiện tại.
 */
export const getMyContracts = async (req, res) => {
  try {
    const contracts = await contractService.getMyContracts(req.user.id);
    res.json({ success: true, data: contracts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/contracts/:id/client-download — KH download PDF (1 lần duy nhất).
 * IDOR protection: chỉ client liên quan.
 */
export const clientDownloadContract = async (req, res) => {
  try {
    const contract = await contractService.getContractById(req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: "Không tìm thấy" });

    // IDOR check: chỉ client liên quan
    if (contract.clientId?.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: "Không có quyền tải hợp đồng này" });
    }

    await contractService.trackClientDownload(req.params.id);
    const stream = contractService.getSignedPdfStream(contract);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=hop-dong-${contract._id}.pdf`);
    stream.pipe(res);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
