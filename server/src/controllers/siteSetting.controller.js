import path from "path";
import SiteSetting from "../models/SiteSetting.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { safeLog } from "../utils/safeLogger.js";

const ITEM_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ITEM_KEY_LENGTH = 64;
const KEYED_FIELD_BY_SECTION = {
  hero: "heroImagesByKey",
  heroAvatars: "heroAvatarsByKey",
  about: "aboutImagesByKey",
  trainer: "trainerImagesByKey",
  classes: "classesImagesByKey",
  tools: "toolsImagesByKey",
};
const SUPPORTED_FIELDS = new Set([
  "hero",
  "heroAvatars",
  "about",
  "trainer",
  "classes",
  "tools",
]);

const isValidItemKey = (itemKey) => (
  typeof itemKey === "string"
  && itemKey.length <= MAX_ITEM_KEY_LENGTH
  && ITEM_KEY_PATTERN.test(itemKey)
);

const ensureImageMap = (settings, mapField) => {
  const currentValue = settings[mapField];
  if (currentValue?.set && currentValue?.delete) return currentValue;

  const imageMap = new Map(Object.entries(currentValue || {}));
  settings[mapField] = imageMap;
  return imageMap;
};

const validateMediaTarget = (fieldName, itemKey) => {
  if (!SUPPORTED_FIELDS.has(fieldName)) {
    return "Khu vực hình ảnh không hợp lệ";
  }

  if (itemKey !== undefined) {
    if (!KEYED_FIELD_BY_SECTION[fieldName] || !isValidItemKey(itemKey)) {
      return "Mã mục hình ảnh không hợp lệ";
    }
  }

  return "";
};

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
    const { fieldName, itemKey } = req.body;
    const targetError = validateMediaTarget(fieldName, itemKey);
    if (targetError) {
      return res.status(400).json({ success: false, message: targetError });
    }

    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) {
      return res.status(400).json({ success: false, message: "Không có file nào được tải lên" });
    }

    const folderMap = { hero: 1920, heroAvatars: 200, about: 1200, trainer: 800, classes: 800, tools: 1920 };
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
          folder: `htcoaching/site-settings/${fieldName}${itemKey ? `/${itemKey}` : ""}`,
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

    if (itemKey) {
      ensureImageMap(settings, KEYED_FIELD_BY_SECTION[fieldName]).set(itemKey, uploadedUrls[0]);
    } else if (fieldName === "hero") {
      settings.heroImages = [...settings.heroImages, ...uploadedUrls];
    } else if (fieldName === "heroAvatars") {
      settings.heroAvatars = [...settings.heroAvatars, ...uploadedUrls];
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
    safeLog.error("site_setting.image_upload_failed", error);
    res.status(500).json({ success: false, message: "Lỗi upload ảnh" });
  }
};

// DELETE: Xoá ảnh khỏi mảng
export const removeSettingImage = async (req, res) => {
  try {
    const { fieldName, imageUrl, itemKey } = req.body;
    const targetError = validateMediaTarget(fieldName, itemKey);
    if (targetError) {
      return res.status(400).json({ success: false, message: targetError });
    }

    const settings = await getSettings();
    
    if (itemKey) {
      const imageMap = ensureImageMap(settings, KEYED_FIELD_BY_SECTION[fieldName]);
      const currentImageUrl = imageMap.get(itemKey);
      if (currentImageUrl && imageUrl && currentImageUrl !== imageUrl) {
        return res.status(409).json({
          success: false,
          message: "Ảnh đã được thay đổi ở phiên khác. Vui lòng tải lại trang.",
        });
      }
      imageMap.delete(itemKey);
    } else if (fieldName === 'hero') {
      settings.heroImages = settings.heroImages.filter(url => url !== imageUrl);
    } else if (fieldName === 'heroAvatars') {
      settings.heroAvatars = settings.heroAvatars.filter(url => url !== imageUrl);
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
    safeLog.error("site_setting.image_remove_failed", error);
    res.status(500).json({ success: false, message: "Lỗi xóa ảnh" });
  }
};
