import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import F1Intake from "../../models/F1Intake.js";
import F1Media from "../../models/F1Media.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import { summarizeMedia } from "./media.helpers.js";

const buildPublicFileUrl = (req, filename) => {
  return `${req.protocol}://${req.get("host")}/uploads/f1-media/${filename}`;
};

const deleteLocalFileIfExists = (url = "") => {
  try {
    if (!url.includes("/uploads/f1-media/")) return;

    const filename = url.split("/uploads/f1-media/")[1];
    if (!filename) return;

    const absolutePath = path.resolve("uploads/f1-media", filename);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (_error) {
    // Không throw để tránh fail luồng xóa record DB
  }
};

export const createF1Media = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng tải file ảnh lên",
      });
    }

    const fileUrl = buildPublicFileUrl(req, req.file.filename);

    const media = await F1Media.create({
      customerId: customer._id,
      intakeId: req.body.intakeId || customer.lastIntakeId || null,
      type: req.body.type,
      url: fileUrl,
      publicId: req.file.filename,
      mimeType: req.file.mimetype || "",
      sizeBytes: req.file.size || 0,
      uploadedBy: req.user.id,
    });

    if (
      customer.lastIntakeId &&
      media.intakeId?.toString() === customer.lastIntakeId?.toString()
    ) {
      const mediaList = await F1Media.find({
        customerId: customer._id,
        intakeId: media.intakeId,
      });

      const postureMediaSummary = summarizeMedia(mediaList);

      await F1Intake.findByIdAndUpdate(media.intakeId, {
        $set: { postureMediaSummary, updatedBy: req.user.id },
      });
    }

    return res.status(201).json({
      success: true,
      data: media,
      message: "Tải ảnh lên thành công",
    });
  } catch (error) {
    return next(error);
  }
};

export const getF1Media = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const filter = { customerId: customer._id };
    if (
      req.query.intakeId &&
      mongoose.Types.ObjectId.isValid(req.query.intakeId)
    ) {
      filter.intakeId = req.query.intakeId;
    }

    const media = await F1Media.find(filter).sort({ createdAt: -1 });

    return res.json({ success: true, data: media });
  } catch (error) {
    return next(error);
  }
};

export const deleteF1Media = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const media = await F1Media.findOneAndDelete({
      _id: req.params.mediaId,
      customerId: customer._id,
    });

    if (!media) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy media",
      });
    }

    deleteLocalFileIfExists(media.url);

    if (media.intakeId) {
      const mediaList = await F1Media.find({
        customerId: customer._id,
        intakeId: media.intakeId,
      });

      const postureMediaSummary = summarizeMedia(mediaList);

      await F1Intake.findByIdAndUpdate(media.intakeId, {
        $set: {
          postureMediaSummary,
          updatedBy: req.user.id,
        },
      });
    }

    return res.json({
      success: true,
      message: "Xóa media thành công",
    });
  } catch (error) {
    return next(error);
  }
};
