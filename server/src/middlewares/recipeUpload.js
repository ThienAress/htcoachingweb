import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { resolveCloudinaryFolder } from "../utils/cloudinaryPath.js";
import { recordCloudinaryUsage } from "../observability/providerUsageMetrics.js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: resolveCloudinaryFolder("htcoaching/recipes"),
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 800, crop: "fill", quality: "auto" }],
  },
});

export const instrumentCloudinaryStorage = (storageEngine) => ({
  _handleFile(req, file, callback) {
    return storageEngine._handleFile(req, file, (error, info) => {
      recordCloudinaryUsage({
        operation: "upload",
        success: !error,
        bytes: info?.size,
      });
      callback(error, info);
    });
  },
  _removeFile(req, file, callback) {
    return storageEngine._removeFile(req, file, (error, result) => {
      recordCloudinaryUsage({
        operation: "delete",
        success:
          !error && ["ok", "not found"].includes(result?.result),
      });
      callback(error, result);
    });
  },
});

const storage = instrumentCloudinaryStorage(cloudinaryStorage);

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

export const uploadRecipeThumbnail = upload.single("image");

export default upload;
