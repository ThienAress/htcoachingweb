import mongoose from "mongoose";
import AuditLog from "../../models/AuditLog.js";
import F1Intake from "../../models/F1Intake.js";
import F1Media from "../../models/F1Media.js";
import {
  createF1MediaFromBuffer,
  queueF1MediaDeletion,
  serializeF1Media,
} from "../../services/f1MediaLifecycle.service.js";
import {
  getSignedReadUrl,
  openPrivateReadStream,
} from "../../services/f1MediaStorage.service.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";

const normalizeActorRole = (role) =>
  ["admin", "trainer", "user"].includes(role) ? role : "user";

const getRequestContext = (req) => ({
  requestId: req.id || "",
  ipAddress: req.ip || "",
  userAgent: req.get("user-agent") || "",
});

const getAuthorizedIntake = async (customer, intakeId) => {
  const targetId = intakeId || customer.lastIntakeId;
  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    const error = new Error(
      "Cần lưu consent trong intake trước khi tải ảnh F1",
    );
    error.status = 409;
    error.code = "F1_MEDIA_CONSENT_REQUIRED";
    throw error;
  }
  const intake = await F1Intake.findOne({
    _id: targetId,
    customerId: customer._id,
  });
  if (!intake) {
    const error = new Error("Intake không thuộc khách hàng F1 này");
    error.status = 404;
    throw error;
  }
  if (!intake.consent?.allowMediaStorage || !intake.consent?.version) {
    const error = new Error(
      "Khách hàng chưa đồng ý lưu trữ media theo phiên bản consent hiện tại",
    );
    error.status = 403;
    error.code = "F1_MEDIA_CONSENT_REQUIRED";
    throw error;
  }
  return intake;
};

export const createF1Media = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng tải file ảnh lên",
      });
    }

    const intake = await getAuthorizedIntake(customer, req.body.intakeId);
    const result = await createF1MediaFromBuffer({
      customerId: customer._id,
      intakeId: intake._id,
      type: req.body.type,
      buffer: req.file.buffer,
      actorId: req.user.id,
      actorRole: req.user.role,
      requestContext: getRequestContext(req),
    });

    return res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      data: serializeF1Media(result.media),
      idempotentReplay: result.idempotentReplay,
      message: result.idempotentReplay
        ? "Ảnh này đã được tải lên trước đó"
        : "Tải ảnh lên thành công",
    });
  } catch (error) {
    return next(error);
  }
};

export const getF1Media = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const filter = {
      customerId: customer._id,
      status: { $in: ["pending_upload", "ready", "failed"] },
    };
    if (
      req.query.intakeId &&
      mongoose.Types.ObjectId.isValid(req.query.intakeId)
    ) {
      filter.intakeId = req.query.intakeId;
    }
    const [total, media] = await Promise.all([
      F1Media.countDocuments(filter),
      F1Media.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      success: true,
      data: media.map(serializeF1Media),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const readF1MediaContent = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    const media = await F1Media.findOne({
      _id: req.params.mediaId,
      customerId: customer._id,
      status: "ready",
    });
    if (!media) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy media" });
    }

    await AuditLog.create({
      actorId: req.user.id,
      actorRole: normalizeActorRole(req.user.role),
      action: "read_f1_media",
      targetType: "f1_media",
      targetId: media._id,
      metadata: {
        customerId: String(customer._id),
        requestId: req.id || "",
      },
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
    });

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("Referrer-Policy", "no-referrer");

    const signedUrl = await getSignedReadUrl(media, 300);
    if (signedUrl) return res.redirect(302, signedUrl);

    const stream = openPrivateReadStream(media);
    if (!stream) {
      const error = new Error("Storage provider không hỗ trợ đọc media");
      error.status = 502;
      throw error;
    }
    res.type(media.mimeType || "image/webp");
    stream.on("error", next);
    return stream.pipe(res);
  } catch (error) {
    return next(error);
  }
};

export const deleteF1Media = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    const media = await F1Media.findOne({
      _id: req.params.mediaId,
      customerId: customer._id,
    });
    if (!media) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy media" });
    }

    const updated = await queueF1MediaDeletion({
      media,
      actorId: req.user.id,
      actorRole: req.user.role,
      requestContext: getRequestContext(req),
    });
    return res.status(updated.status === "deleted" ? 200 : 202).json({
      success: true,
      data: serializeF1Media(updated),
      message:
        updated.status === "deleted"
          ? "Media đã được xóa"
          : "Media đã được đưa vào hàng đợi xóa an toàn",
    });
  } catch (error) {
    return next(error);
  }
};
