import path from "path";
import SiteSetting from "../models/SiteSetting.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

// Lấy hoặc tạo cấu hình mặc định
const getSettings = async () => {
  let settings = await SiteSetting.findOne({ isSingleton: true });
  if (!settings) {
    settings = await SiteSetting.create({ isSingleton: true });
  }
  return settings;
};

// GET: Lấy toàn bộ setting
export const getSiteSettings = async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST: Tải ảnh lên và lưu URL vào đúng field
export const uploadSettingImage = async (req, res) => {
  try {
    const { fieldName } = req.body;
    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) {
      return res.status(400).json({ success: false, message: "Không có file nào được tải lên" });
    }

    const folderMap = { hero: 1920, about: 1200, trainer: 800, classes: 800, tools: 1920 };
    const maxWidth = folderMap[fieldName] || 1200;

    const settings = await getSettings();

    const uploadResults = await Promise.all(
      files.map((file) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const safeBaseName = path
          .basename(file.originalname || "image", ext)
          .replace(/[^a-zA-Z0-9-_]/g, "_")
          .slice(0, 50);
        return uploadBufferToCloudinary(file.buffer, {
          folder: `htcoaching/site-settings/${fieldName}`,
          public_id: `${Date.now()}-${Math.round(Math.random() * 10000)}-${safeBaseName}`,
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          transformation: [
            { width: maxWidth, crop: "limit" },
            { quality: "auto", fetch_format: "auto" },
          ],
        });
      })
    );

    const uploadedUrls = uploadResults.map((r) => r.url);

    if (fieldName === "hero") {
      settings.heroImages = [...settings.heroImages, ...uploadedUrls];
    } else if (fieldName === "about") {
      settings.aboutImages = [...settings.aboutImages, ...uploadedUrls];
    } else if (fieldName === "trainer") {
      settings.trainerImage = uploadedUrls[0];
    } else if (fieldName === "classes") {
      settings.classesImages = [...settings.classesImages, ...uploadedUrls];
    } else if (fieldName === "tools") {
      settings.toolsImage = uploadedUrls[0];
    }

    await settings.save();
    res.json({ success: true, data: settings, message: "Cập nhật ảnh thành công!" });
  } catch (error) {
    console.error("Upload Image Error:", error);
    res.status(500).json({ success: false, message: "Lỗi upload ảnh" });
  }
};

// DELETE: Xoá ảnh khỏi mảng
export const removeSettingImage = async (req, res) => {
  try {
    const { fieldName, imageUrl } = req.body;
    const settings = await getSettings();
    
    if (fieldName === 'hero') {
      settings.heroImages = settings.heroImages.filter(url => url !== imageUrl);
    } else if (fieldName === 'about') {
      settings.aboutImages = settings.aboutImages.filter(url => url !== imageUrl);
    } else if (fieldName === 'classes') {
      settings.classesImages = settings.classesImages.filter(url => url !== imageUrl);
    } else if (fieldName === 'trainer') {
      settings.trainerImage = "";
    } else if (fieldName === 'tools') {
      settings.toolsImage = "";
    }

    await settings.save();
    res.json({ success: true, data: settings, message: "Đã xóa ảnh!" });
  } catch (error) {
     res.status(500).json({ success: false, message: error.message });
  }
};
