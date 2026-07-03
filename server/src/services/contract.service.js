import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import mongoose from "mongoose";
import Contract from "../models/Contract.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Nội quy mặc định
const DEFAULT_SECTIONS = [
  { title: "1. THỜI GIAN BUỔI TẬP", content: "Các buổi tập được diễn ra trong vòng 1 giờ 30 phút (1H30).", items: [] },
  { title: "2. TRÁCH NHIỆM CỦA HUẤN LUYỆN VIÊN", content: "", items: [
    "Cung cấp đầy đủ các buổi huấn luyện theo thỏa thuận.",
    "Theo dõi và hướng dẫn khách hàng tập luyện đúng kỹ thuật.",
    "Đảm bảo an toàn cho khách hàng trong suốt quá trình tập luyện.",
    "Hỗ trợ tư vấn chế độ dinh dưỡng phù hợp với mục tiêu tập luyện.",
  ]},
  { title: "3. CÁC CAM KẾT VÀ BẢO ĐẢM CỦA HỘI VIÊN", content: "", items: [
    "Tuân thủ lịch tập đã thống nhất.",
    "Thanh toán đầy đủ chi phí dịch vụ theo hợp đồng.",
    "Thông báo trước ít nhất 12 giờ nếu có sự thay đổi lịch tập.",
    "Chấp hành đúng hướng dẫn tập luyện để đảm bảo an toàn và hiệu quả.",
    "Không được phép chuyển nhượng buổi tập cho người khác nếu không có sự đồng ý của HLV.",
    "Nếu vắng mặt không báo trước 12 giờ, buổi tập sẽ bị tính vào số buổi đã sử dụng.",
    "Tuân thủ nội quy phòng tập và tôn trọng huấn luyện viên.",
    "Hội viên có thể kiểm tra check-in và các tính năng khác trực tiếp trên nền tảng web.",
  ]},
  { title: "4. HOÀN TRẢ VÀ CHẤM DỨT HỢP ĐỒNG", content: "", items: [
    "HLV chỉ hoàn lại chi phí cho những buổi chưa tập nếu có lý do chính đáng (chỉ định bác sĩ, chuyển nơi cư trú).",
    "Khách hàng không được yêu cầu hoàn tiền cho các buổi tập đã sử dụng hoặc đã hủy không hợp lệ.",
  ]},
  { title: "5. GIẢ ĐỊNH RỦI RO", content: "", items: [
    "Khách hàng tự chịu trách nhiệm về sức khỏe cá nhân và phải thông báo trước cho HLV về bất kỳ vấn đề y tế nào.",
    "Nếu xảy ra chấn thương, khách hàng có quyền yêu cầu HLV hỗ trợ sơ cứu.",
    "Trong trường hợp chấn thương do lỗi của HLV, khách hàng có quyền yêu cầu hoàn trả hoặc bồi thường.",
    "Nếu gặp vấn đề sức khỏe nghiêm trọng do huấn luyện không phù hợp, có quyền chấm dứt hợp đồng sớm.",
  ]},
];

// ============================================================================
// GRIDFS HELPERS
// ============================================================================

async function savePdfToGridFS(pdfBytes, filename) {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "contracts" });
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, { contentType: "application/pdf" });
    uploadStream.on("finish", () => resolve(uploadStream.id));
    uploadStream.on("error", reject);
    uploadStream.end(Buffer.from(pdfBytes));
  });
}

function getPdfStreamFromGridFS(fileId) {
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "contracts" });
  return bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
}

// ============================================================================
// PDF GENERATION — Sinh từ code (không dùng template)
// ============================================================================

async function generateSignedPdf(contract, signatureBase64) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontPath = path.join(__dirname, "../templates/BeVietnamPro-Regular.ttf");
  const boldFontPath = path.join(__dirname, "../templates/BeVietnamPro-Bold.ttf");
  let font, fontBold;
  try {
    const fontBytes = fs.readFileSync(fontPath);
    font = await pdfDoc.embedFont(fontBytes);
  } catch {
    font = await pdfDoc.embedFont("Helvetica");
  }
  try {
    const boldBytes = fs.readFileSync(boldFontPath);
    fontBold = await pdfDoc.embedFont(boldBytes);
  } catch {
    fontBold = font; // fallback to regular if bold not available
  }

  const W = 612, H = 792;
  const c = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const { trainerInfo, clientInfo, packageDetails, customSections } = contract;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "...";
  const fmtMoney = (n) => n ? n.toLocaleString("vi-VN") : "...";

  // Helper: draw text at position
  const dt = (page, text, x, y, opts = {}) => {
    page.drawText(String(text || ""), { x, y, size: opts.size || 10, font: opts.bold ? fontBold : font, color: opts.color || c });
  };
  // Helper: draw horizontal line
  const hl = (page, x1, x2, y) => {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  };

  // ====== TRANG 1: Thông tin ======
  const p1 = pdfDoc.addPage([W, H]);
  let y = H - 55;

  // Helper: căn giữa text (có option bold)
  const centerText = (page, text, yPos, sz, opts = {}) => {
    const f = opts.bold ? fontBold : font;
    const tw = f.widthOfTextAtSize(text, sz);
    dt(page, text, (W - tw) / 2, yPos, { size: sz, bold: opts.bold });
  };
  centerText(p1, "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", y, 13, { bold: true });
  y -= 20;
  centerText(p1, "Độc lập – Tự do – Hạnh phúc", y, 11);
  y -= 12;
  hl(p1, 200, 412, y);
  y -= 35;
  centerText(p1, "HỢP ĐỒNG DỊCH VỤ HUẤN LUYỆN CÁ NHÂN", y, 16, { bold: true });

  // Bên A
  y -= 40;
  dt(p1, "BÊN CUNG CẤP DỊCH VỤ (BÊN A):", 50, y, { size: 12, bold: true });
  y -= 25;
  // Label bold, value regular
  const drawField = (page, label, value, x, yPos) => {
    dt(page, label, x, yPos, { bold: true });
    const labelW = fontBold.widthOfTextAtSize(label, 10);
    dt(page, ` ${value || ""}`, x + labelW, yPos);
  };
  drawField(p1, "Họ và tên:", trainerInfo?.name, 80, y);
  y -= 18;
  drawField(p1, "Năm sinh:", trainerInfo?.birthYear, 80, y);
  y -= 18;
  drawField(p1, "Địa chỉ:", trainerInfo?.address, 80, y);
  y -= 18;
  drawField(p1, "Số điện thoại:", trainerInfo?.phone, 80, y);
  y -= 18;
  drawField(p1, "Email:", trainerInfo?.email, 80, y);

  // Bên B
  y -= 30;
  dt(p1, "BÊN SỬ DỤNG DỊCH VỤ (BÊN B):", 50, y, { size: 12, bold: true });
  y -= 25;
  drawField(p1, "Họ và tên:", clientInfo.name, 80, y);
  y -= 18;
  drawField(p1, "Số điện thoại:", clientInfo.phone, 80, y);
  y -= 18;
  drawField(p1, "Email:", clientInfo.email, 80, y);

  // Bảng gói DV
  y -= 30;
  dt(p1, "THÔNG TIN GÓI DỊCH VỤ", 50, y, { size: 12, bold: true });
  y -= 8;
  // Table border & header
  const tblLeft = 50, tblRight = 562, col2 = 220, col3 = 420;
  hl(p1, tblLeft, tblRight, y);
  const thY = y - 16;
  dt(p1, "Số buổi tập", tblLeft + 10, thY, { size: 10, bold: true });
  dt(p1, "Số tiền mỗi buổi (VNĐ)", col2, thY, { size: 10, bold: true });
  dt(p1, "Tổng số tiền thanh toán (VNĐ)", col3, thY, { size: 10, bold: true });
  hl(p1, tblLeft, tblRight, thY - 6);
  // Table data
  const tdY = thY - 22;
  dt(p1, String(packageDetails.sessions || ""), tblLeft + 10, tdY, { size: 11 });
  dt(p1, fmtMoney(packageDetails.pricePerSession), col2, tdY, { size: 11 });
  dt(p1, fmtMoney(packageDetails.totalAmount), col3, tdY, { size: 11 });
  hl(p1, tblLeft, tblRight, tdY - 8);

  y = tdY - 30;
  drawField(p1, "Ngày bắt đầu:", fmtDate(packageDetails.startDate), 80, y);
  y -= 18;
  drawField(p1, "Ngày kết thúc:", fmtDate(packageDetails.endDate), 80, y);

  // ====== TRANG 2: Nội quy ======
  const p2 = pdfDoc.addPage([W, H]);
  y = H - 55;
  centerText(p2, "CHÍNH SÁCH VÀ NỘI QUY CỦA KHÁCH HÀNG VÀ HUẤN LUYỆN VIÊN", y, 13, { bold: true });
  y -= 35;

  let currentPage = p2;
  const sections = customSections || [];
  for (const sec of sections) {
    if (y < 80) { currentPage = pdfDoc.addPage([W, H]); y = H - 50; }
    // Section title — Bold, size 12
    dt(currentPage, sec.title || "", 50, y, { size: 12, bold: true });
    y -= 20;
    if (sec.content) {
      const lines = wrapText(sec.content, font, 10, 460);
      for (const line of lines) { dt(currentPage, line, 80, y); y -= 15; }
    }
    if (sec.items) {
      for (let i = 0; i < sec.items.length; i++) {
        const lines = wrapText(`${i + 1}. ${sec.items[i]}`, font, 10, 440);
        for (const line of lines) {
          if (y < 50) { currentPage = pdfDoc.addPage([W, H]); y = H - 50; }
          dt(currentPage, line, 90, y);
          y -= 15;
        }
      }
    }
    y -= 12;
  }

  // ====== TRANG CHỮ KÝ ======
  const p3 = pdfDoc.addPage([W, H]);
  y = H - 80;

  // Helper: căn giữa text trong cột (có option bold)
  function centerColText(page, text, centerX, yPos, sz, clr, bold) {
    const f = bold ? fontBold : font;
    const tw = f.widthOfTextAtSize(String(text), sz);
    dt(page, text, centerX - tw / 2, yPos, { size: sz, color: clr || c, bold });
  }

  // Helper: scale ảnh chữ ký vừa vặn (maxHeight = 60px, maxWidth = 120px)
  function fitSignature(img) {
    const maxW = 120, maxH = 60;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    return { width: img.width * scale, height: img.height * scale };
  }

  // Bên A (trái) — Bên B (phải)
  const leftCenter = W / 4;
  const rightCenter = (W * 3) / 4;

  // Dòng ngày tháng — căn phải bên cột Bên B
  const now = new Date();
  const dateStr = `TP. Hồ Chí Minh, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  const dateTw = font.widthOfTextAtSize(dateStr, 10);
  dt(p3, dateStr, rightCenter - dateTw / 2, y, { size: 10, color: gray });

  y -= 40;
  centerColText(p3, "ĐẠI DIỆN BÊN A", leftCenter, y, 12, c, true);
  centerColText(p3, "BÊN B", rightCenter, y, 12, c, true);
  y -= 16;
  centerColText(p3, "(Ký, ghi rõ họ tên)", leftCenter, y, 9, gray);
  centerColText(p3, "(Ký và ghi rõ họ tên)", rightCenter, y, 9, gray);

  const sigY = y - 20; // vị trí bắt đầu chữ ký

  // Chữ ký HLV
  if (contract.trainerSignature) {
    try {
      const tSigData = contract.trainerSignature.replace(/^data:image\/\w+;base64,/, "");
      const tSigBytes = Buffer.from(tSigData, "base64");
      const tSigImg = await pdfDoc.embedPng(tSigBytes);
      const tDims = fitSignature(tSigImg);
      p3.drawImage(tSigImg, { x: leftCenter - tDims.width / 2, y: sigY - tDims.height, width: tDims.width, height: tDims.height });
    } catch { /* skip */ }
  }
  centerColText(p3, trainerInfo?.name || "", leftCenter, sigY - 80, 10, c, true);

  // Chữ ký KH
  if (signatureBase64) {
    try {
      const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, "");
      const sigBytes = Buffer.from(base64Data, "base64");
      const sigImage = await pdfDoc.embedPng(sigBytes);
      const dims = fitSignature(sigImage);
      p3.drawImage(sigImage, { x: rightCenter - dims.width / 2, y: sigY - dims.height, width: dims.width, height: dims.height });
    } catch { /* skip */ }
  }
  centerColText(p3, clientInfo.name || "", rightCenter, sigY - 80, 10);

  // Nếu KH chưa ký — vẽ dòng chấm
  if (!signatureBase64) {
    const dotLine = "..........................................";
    const dotW = font.widthOfTextAtSize(dotLine, 10);
    dt(p3, dotLine, rightCenter - dotW / 2, sigY - 80);
  }

  return await pdfDoc.save();
}

// Wrap text to fit maxWidth
function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

export async function createContract(orderId, createdBy, ipAddress, userAgent) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Đơn hàng không tồn tại");
  if (order.status !== "approved") throw new Error("Đơn hàng chưa được xác nhận");

  const existing = await Contract.findOne({ orderId, status: { $nin: ["cancelled"] } });
  if (existing) throw new Error("Đơn hàng đã có hợp đồng");

  const user = order.userId ? await User.findById(order.userId) : null;
  const trainer = order.trainerId ? await User.findById(order.trainerId) : null;

  const contract = await Contract.create({
    orderId: order._id,
    clientId: order.userId,
    trainerId: order.trainerId || createdBy,
    trainerInfo: {
      name: trainer?.name || "", birthYear: "", address: "",
      phone: trainer?.phone || "", email: trainer?.email || "",
    },
    clientInfo: {
      name: order.name || user?.name || "",
      email: order.email || user?.email || "",
      phone: order.phone || user?.phone || "",
    },
    packageDetails: {
      packageName: order.package || "",
      sessions: order.sessions || order.totalSessions || 0,
      pricePerSession: 0, totalAmount: 0, startDate: null, endDate: null,
    },
    customSections: DEFAULT_SECTIONS,
    status: "draft",
    auditTrail: [{ action: "created", ipAddress, userAgent, timestamp: new Date() }],
  });
  return contract;
}

export async function getContracts(query = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.trainerId) filter.trainerId = query.trainerId;
  return Contract.find(filter).populate("clientId", "name email").populate("orderId", "package sessions status").sort({ createdAt: -1 }).lean();
}

export async function getContractById(contractId) {
  return Contract.findById(contractId).populate("clientId", "name email phone").populate("orderId", "package sessions totalSessions status gym schedule").populate("trainerId", "name email");
}

export async function getContractByOrderId(orderId) {
  return Contract.findOne({ orderId }).lean();
}

export async function markAsViewed(contractId, ipAddress, userAgent) {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error("Hợp đồng không tồn tại");
  if (contract.status === "sent") {
    contract.status = "viewed";
    contract.auditTrail.push({ action: "viewed", ipAddress, userAgent, timestamp: new Date() });
    await contract.save();
  }
  return contract;
}

export async function sendToClient(contractId, ipAddress, userAgent) {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error("Hợp đồng không tồn tại");
  if (contract.status !== "draft") throw new Error("Chỉ có thể gửi hợp đồng ở trạng thái nháp");
  if (!contract.trainerSignature) throw new Error("HLV chưa ký tên. Vui lòng ký trước khi gửi.");

  contract.status = "sent";
  contract.auditTrail.push({ action: "sent", ipAddress, userAgent, timestamp: new Date() });
  await contract.save();
  return contract;
}

export async function signContract(contractId, signatureBase64, ipAddress, userAgent) {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error("Hợp đồng không tồn tại");
  if (contract.status === "signed") throw new Error("Hợp đồng đã được ký");
  if (contract.status === "expired") throw new Error("Hợp đồng đã hết hạn");
  if (contract.status === "cancelled") throw new Error("Hợp đồng đã bị hủy");
  if (contract.status === "draft") throw new Error("Hợp đồng chưa được gửi");

  const pdfBytes = await generateSignedPdf(contract, signatureBase64);
  const fileHash = crypto.createHash("sha256").update(pdfBytes).digest("hex");
  const filename = `hop-dong-${contract._id}-${Date.now()}.pdf`;
  const fileId = await savePdfToGridFS(pdfBytes, filename);

  contract.status = "signed";
  contract.signatureImage = signatureBase64;
  contract.signedAt = new Date();
  contract.signedPdfFileId = fileId;
  contract.fileHash = fileHash;
  contract.auditTrail.push({ action: "signed", ipAddress, userAgent, timestamp: new Date() });
  await contract.save();
  return contract;
}

export function getSignedPdfStream(contract) {
  if (!contract.signedPdfFileId) throw new Error("Hợp đồng chưa có file PDF");
  return getPdfStreamFromGridFS(contract.signedPdfFileId);
}

export async function cancelContract(contractId, ipAddress, userAgent) {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error("Hợp đồng không tồn tại");
  if (contract.status === "signed") throw new Error("Không thể hủy hợp đồng đã ký");
  contract.status = "cancelled";
  contract.auditTrail.push({ action: "cancelled", ipAddress, userAgent, timestamp: new Date() });
  await contract.save();
  return contract;
}

export async function updateContractDetails(contractId, updateData) {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error("Hợp đồng không tồn tại");
  if (contract.status !== "draft") throw new Error("Chỉ có thể sửa hợp đồng ở trạng thái nháp");

  if (updateData.trainerInfo) Object.assign(contract.trainerInfo, updateData.trainerInfo);
  if (updateData.clientInfo) Object.assign(contract.clientInfo, updateData.clientInfo);
  if (updateData.packageDetails) Object.assign(contract.packageDetails, updateData.packageDetails);
  if (updateData.customSections !== undefined) contract.customSections = updateData.customSections;
  if (updateData.trainerSignature !== undefined) contract.trainerSignature = updateData.trainerSignature;

  contract.auditTrail.push({ action: "updated", timestamp: new Date() });
  await contract.save();
  return contract;
}

export async function deleteContract(contractId) {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error("Hợp đồng không tồn tại");
  if (["sent", "viewed"].includes(contract.status)) throw new Error("Không thể xóa hợp đồng đã gửi cho khách hàng");

  // Xóa file PDF trong GridFS nếu có — tránh orphan files
  if (contract.signedPdfFileId) {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "contracts" });
      await bucket.delete(new mongoose.Types.ObjectId(contract.signedPdfFileId));
    } catch {
      // File có thể đã bị xóa trước đó — bỏ qua lỗi, vẫn tiếp tục xóa document
    }
  }

  await Contract.findByIdAndDelete(contractId);
  return { deleted: true };
}

export async function trackClientDownload(contractId) {
  const contract = await Contract.findById(contractId);
  if (!contract) throw new Error("Hợp đồng không tồn tại");
  if (contract.clientDownloadedAt) throw new Error("Bạn đã tải hợp đồng này rồi. Mỗi hợp đồng chỉ được tải 1 lần.");
  contract.clientDownloadedAt = new Date();
  contract.auditTrail.push({ action: "downloaded", timestamp: new Date() });
  await contract.save();
  return contract;
}

export async function getMyContracts(userId) {
  return Contract.find({ clientId: userId }).populate("orderId", "package sessions status").sort({ createdAt: -1 }).lean();
}

export async function expireOldContracts() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await Contract.updateMany(
    { status: { $in: ["draft", "sent", "viewed"] }, createdAt: { $lt: sevenDaysAgo } },
    { $set: { status: "expired" }, $push: { auditTrail: { action: "expired", timestamp: new Date() } } }
  );
  return result.modifiedCount;
}

export async function getApprovedOrdersWithoutContract() {
  const contractedOrderIds = await Contract.distinct("orderId", { status: { $nin: ["cancelled"] } });
  return Order.find({ status: "approved", _id: { $nin: contractedOrderIds } }).populate("userId", "name email phone").sort({ approvedAt: -1 }).lean();
}
