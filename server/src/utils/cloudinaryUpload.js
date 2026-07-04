import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload buffer lên Cloudinary.
 * @param {Buffer} buffer - File buffer từ multer memoryStorage
 * @param {object} options - Cloudinary upload options (folder, public_id, transformation, resource_type, ...)
 * @returns {Promise<{url: string, public_id: string}>}
 */
export const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve({ url: result.secure_url, public_id: result.public_id });
    });
    uploadStream.end(buffer);
  });
};
