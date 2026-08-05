import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import mongoose from "mongoose";
import Contract from "../models/Contract.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { safeLog } from "../utils/safeLogger.js";

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

async function deletePdfFromGridFS(fileId) {
  if (!fileId) return;
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "contracts",
  });
  await bucket.delete(new mongoose.Types.ObjectId(fileId));
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
  const c = rgb(0.07, 0.09, 0.08);
  const gray = rgb(0.38, 0.43, 0.41);
  const brand = rgb(0.02, 0.45, 0.34);
  const brandSoft = rgb(0.9, 0.97, 0.94);
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
  const decoratePage = (page) => {
    page.drawText("HTCOACHING", {
      x: 175,
      y: 320,
      size: 48,
      font: fontBold,
      color: brand,
      rotate: degrees(35),
      opacity: 0.035,
    });
    page.drawRectangle({ x: 0, y: H - 32, width: W, height: 32, color: brand });
    dt(page, "HTCOACHING", 34, H - 21, {
      size: 12,
      bold: true,
      color: rgb(1, 1, 1),
    });
    dt(page, `Mã hợp đồng: ${contract._id}`, 365, H - 20, {
      size: 8,
      color: rgb(0.9, 1, 0.96),
    });
    hl(page, 34, W - 34, 26);
    dt(page, "Tài liệu hợp đồng điện tử · htcoachingweb.io.vn", 34, 12, {
      size: 7,
      color: gray,
    });
  };

  // ====== TRANG 1: Thông tin ======
  const p1 = pdfDoc.addPage([W, H]);
  decoratePage(p1);
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
  decoratePage(p2);
  y = H - 55;
  centerText(p2, "CHÍNH SÁCH VÀ NỘI QUY CỦA KHÁCH HÀNG VÀ HUẤN LUYỆN VIÊN", y, 13, { bold: true });
  y -= 35;

  let currentPage = p2;
  const sections = customSections || [];
  for (const sec of sections) {
    if (y < 80) {
      currentPage = pdfDoc.addPage([W, H]);
      decoratePage(currentPage);
      y = H - 50;
    }
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
          if (y < 50) {
            currentPage = pdfDoc.addPage([W, H]);
            decoratePage(currentPage);
            y = H - 50;
          }
          dt(currentPage, line, 90, y);
          y -= 15;
        }
      }
    }
    y -= 12;
  }

  // ====== TRANG CHỮ KÝ ======
  const p3 = pdfDoc.addPage([W, H]);
  decoratePage(p3);
  y = H - 80;

  centerText(p3, "XÁC NHẬN KÝ KẾT HỢP ĐỒNG", y, 17, { bold: true });
  y -= 23;
  centerText(
    p3,
    "Hai bên xác nhận đã đọc, hiểu và đồng ý với toàn bộ nội dung hợp đồng.",
    y,
    9,
  );

  const signedAt = new Date();
  const dateText = `TP. Hồ Chí Minh, ngày ${signedAt.getDate()} tháng ${signedAt.getMonth() + 1} năm ${signedAt.getFullYear()}`;
  y -= 34;
  centerText(p3, dateText, y, 10);

  const embedSignature = async (dataUrl) => {
    const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(
      String(dataUrl || ""),
    );
    if (!match) return null;
    const bytes = Buffer.from(match[2], "base64");
    return match[1] === "image/jpeg"
      ? pdfDoc.embedJpg(bytes)
      : pdfDoc.embedPng(bytes);
  };

  const drawSignatureCard = async ({
    x,
    title,
    name,
    signature,
    signedLabel,
  }) => {
    const width = 238;
    const height = 245;
    const top = y - 28;
    p3.drawRectangle({
      x,
      y: top - height,
      width,
      height,
      color: brandSoft,
      borderColor: brand,
      borderWidth: 1,
    });
    dt(p3, title, x + 18, top - 28, {
      size: 11,
      bold: true,
      color: brand,
    });
    dt(p3, "(Ký và ghi rõ họ tên)", x + 18, top - 48, {
      size: 8,
      color: gray,
    });

    p3.drawRectangle({
      x: x + 18,
      y: top - 157,
      width: width - 36,
      height: 92,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.78, 0.84, 0.81),
      borderWidth: 0.75,
    });

    try {
      const image = await embedSignature(signature);
      if (image) {
        const maxW = width - 58;
        const maxH = 68;
        const scale = Math.min(maxW / image.width, maxH / image.height, 1);
        const imageWidth = image.width * scale;
        const imageHeight = image.height * scale;
        p3.drawImage(image, {
          x: x + (width - imageWidth) / 2,
          y: top - 145 + (68 - imageHeight) / 2,
          width: imageWidth,
          height: imageHeight,
        });
      }
    } catch {
      dt(p3, "Không thể hiển thị ảnh chữ ký", x + 32, top - 116, {
        size: 8,
        color: gray,
      });
    }

    dt(p3, name || "Chưa cập nhật họ tên", x + 18, top - 184, {
      size: 11,
      bold: true,
    });
    dt(p3, signedLabel, x + 18, top - 207, {
      size: 8,
      color: gray,
    });
  };

  await drawSignatureCard({
    x: 48,
    title: "ĐẠI DIỆN BÊN A",
    name: trainerInfo?.name,
    signature: contract.trainerSignature,
    signedLabel: "Đã ký trước khi phát hành hợp đồng",
  });
  await drawSignatureCard({
    x: 326,
    title: "BÊN B",
    name: clientInfo?.name,
    signature: signatureBase64,
    signedLabel: `Đã ký lúc ${signedAt.toLocaleString("vi-VN")}`,
  });

  y -= 310;
  p3.drawRectangle({
    x: 48,
    y: y - 70,
    width: W - 96,
    height: 70,
    color: rgb(0.96, 0.98, 0.97),
    borderColor: rgb(0.82, 0.88, 0.85),
    borderWidth: 0.75,
  });
  dt(p3, "BẢO TOÀN TÀI LIỆU", 66, y - 23, {
    size: 9,
    bold: true,
    color: brand,
  });
  dt(
    p3,
    "Bản PDF hoàn tất được lưu cùng mã băm SHA-256 để kiểm tra tính toàn vẹn.",
    66,
    y - 44,
    { size: 8, color: gray },
  );

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

function contractSigningError(contract) {
  const error = new Error();
  const states = {
    draft: ["Hợp đồng chưa được gửi", "CONTRACT_NOT_SENT", 409],
    sent: ["Vui lòng xem hết hợp đồng trước khi ký", "CONTRACT_NOT_VIEWED", 409],
    signing: ["Hợp đồng đang được ký bởi yêu cầu khác", "CONTRACT_SIGNING", 409],
    signed: ["Hợp đồng đã được ký", "CONTRACT_ALREADY_SIGNED", 409],
    expired: ["Hợp đồng đã hết hạn", "CONTRACT_EXPIRED", 409],
    cancelled: ["Hợp đồng đã bị hủy", "CONTRACT_CANCELLED", 409],
  };
  const [message, code, statusCode] = contract
    ? states[contract.status] || [
        "Hợp đồng không ở trạng thái có thể ký",
        "CONTRACT_NOT_SIGNABLE",
        409,
      ]
    : ["Hợp đồng không tồn tại", "CONTRACT_NOT_FOUND", 404];
  error.message = message;
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

export async function createContract(orderId, createdBy, ipAddress, userAgent) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Đơn hàng không tồn tại");
  if (order.status !== "approved") throw new Error("Đơn hàng chưa được xác nhận");

  const user = order.userId ? await User.findById(order.userId) : null;
  const trainer = order.trainerId ? await User.findById(order.trainerId) : null;

  try {
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
      isActive: true,
      auditTrail: [{ action: "created", ipAddress, userAgent, timestamp: new Date() }],
    });
    return contract;
  } catch (err) {
    // Duplicate key → đã có contract active cho order này
    if (err.code === 11000) {
      throw new Error("Đơn hàng đã có hợp đồng");
    }
    throw err;
  }
}

export async function getContracts(query = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.trainerId) filter.trainerId = query.trainerId;
  return Contract.find(filter)
    .select("-auditTrail -signatureImage -trainerSignature")
    .populate("clientId", "name email")
    .populate("orderId", "package sessions status")
    .sort({ createdAt: -1 })
    .lean();
}

export async function getContractById(contractId) {
  return Contract.findById(contractId)
    .select("-auditTrail")
    .populate("clientId", "name email phone")
    .populate("orderId", "package sessions totalSessions status gym schedule")
    .populate("trainerId", "name email");
}

export async function getContractByOrderId(orderId) {
  return Contract.findOne({ orderId, isActive: true }).lean();
}

export async function markAsViewed(
  contractId,
  clientId,
  ipAddress,
  userAgent,
) {
  const contract = await Contract.findOne({ _id: contractId, clientId });
  if (!contract) throw contractSigningError(null);
  if (contract.status === "sent") {
    contract.status = "viewed";
    contract.auditTrail.push({
      action: "viewed",
      ipAddress,
      userAgent,
      timestamp: new Date(),
    });
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

export async function signContract({
  contractId,
  clientId,
  signatureImage,
  acceptedTerms,
  ipAddress,
  userAgent,
}) {
  if (acceptedTerms !== true) {
    const error = new Error("Bạn cần đồng ý với hợp đồng trước khi ký");
    error.code = "CONSENT_REQUIRED";
    error.statusCode = 400;
    throw error;
  }

  const reserved = await Contract.findOneAndUpdate(
    { _id: contractId, clientId, status: "viewed" },
    { $set: { status: "signing" } },
    { returnDocument: "after" },
  );

  if (!reserved) {
    const existing = await Contract.findOne({ _id: contractId, clientId })
      .select("status")
      .lean();
    throw contractSigningError(existing);
  }

  let fileId;
  try {
    const pdfBytes = await generateSignedPdf(reserved, signatureImage);
    const fileHash = crypto.createHash("sha256").update(pdfBytes).digest("hex");
    const signedAt = new Date();
    fileId = await savePdfToGridFS(
      pdfBytes,
      `hop-dong-${reserved._id}-${Date.now()}.pdf`,
    );

    const signed = await Contract.findOneAndUpdate(
      { _id: contractId, clientId, status: "signing" },
      {
        $set: {
          status: "signed",
          signatureImage,
          signedAt,
          signedPdfFileId: fileId,
          fileHash,
        },
        $push: {
          auditTrail: {
            action: "signed",
            ipAddress,
            userAgent,
            timestamp: signedAt,
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    );

    if (!signed) {
      const error = new Error("Không thể hoàn tất ký hợp đồng");
      error.code = "CONTRACT_SIGNING_CONFLICT";
      error.statusCode = 409;
      throw error;
    }
    return signed;
  } catch (error) {
    await Contract.updateOne(
      { _id: contractId, clientId, status: "signing" },
      { $set: { status: "viewed" } },
    );
    if (fileId) {
      await deletePdfFromGridFS(fileId).catch((cleanupError) => {
        safeLog.warn(
          "contract.signed_pdf_cleanup_failed",
          "Could not remove an orphaned signed PDF after signing failed",
          { errorName: cleanupError?.name || "Error" },
        );
      });
    }
    throw error;
  }
}

export function getSignedPdfStream(contract) {
  if (!contract.signedPdfFileId) throw new Error("Hợp đồng chưa có file PDF");
  return getPdfStreamFromGridFS(contract.signedPdfFileId);
}

export async function cancelContract(contractId, ipAddress, userAgent) {
  const contract = await Contract.findOneAndUpdate(
    {
      _id: contractId,
      status: { $in: ["draft", "sent", "viewed", "signing"] },
    },
    {
      $set: { status: "cancelled", isActive: false },
      $push: {
        auditTrail: {
          action: "cancelled",
          ipAddress,
          userAgent,
          timestamp: new Date(),
        },
      },
    },
    { returnDocument: "after", runValidators: true },
  );
  if (contract) return contract;

  const existing = await Contract.findById(contractId);
  if (!existing) throw new Error("Hợp đồng không tồn tại");
  if (existing.status === "signed") {
    throw new Error("Không thể hủy hợp đồng đã ký");
  }
  if (existing.status === "cancelled") return existing;
  throw new Error("Không thể hủy hợp đồng đã hết hiệu lực");
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
  const contract = await Contract.findOneAndDelete({
    _id: contractId,
    status: "draft",
  });
  if (!contract) {
    const existing = await Contract.findById(contractId).select("status").lean();
    if (!existing) throw new Error("Hợp đồng không tồn tại");
    throw new Error("Chỉ có thể xóa hợp đồng ở trạng thái nháp");
  }
  return { deleted: true };
}

export async function trackClientDownload(contractId) {
  // Atomic: chỉ set clientDownloadedAt nếu chưa có
  const contract = await Contract.findOneAndUpdate(
    { _id: contractId, clientDownloadedAt: null },
    {
      $set: { clientDownloadedAt: new Date() },
      $push: { auditTrail: { action: "downloaded", timestamp: new Date() } },
    },
    { returnDocument: "after" }
  );
  if (!contract) {
    const exists = await Contract.findById(contractId);
    if (!exists) throw new Error("Hợp đồng không tồn tại");
    throw new Error("Bạn đã tải hợp đồng này rồi. Mỗi hợp đồng chỉ được tải 1 lần.");
  }
  return contract;
}

export async function getMyContracts(userId) {
  return Contract.find({ clientId: userId })
    .select("status packageDetails signedAt clientDownloadedAt createdAt")
    .populate("orderId", "package sessions status")
    .sort({ createdAt: -1 })
    .lean();
}

export async function expireOldContracts() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await Contract.updateMany(
    { status: { $in: ["draft", "sent", "viewed", "signing"] }, createdAt: { $lt: sevenDaysAgo } },
    {
      $set: { status: "expired", isActive: false },
      $push: { auditTrail: { action: "expired", timestamp: new Date() } },
    }
  );
  return result.modifiedCount;
}

export async function getApprovedOrdersWithoutContract() {
  const contractedOrderIds = await Contract.distinct("orderId", {
    isActive: true,
  });
  return Order.find({ status: "approved", _id: { $nin: contractedOrderIds } }).populate("userId", "name email phone").sort({ approvedAt: -1 }).lean();
}
