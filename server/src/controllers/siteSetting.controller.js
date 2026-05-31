import SiteSetting from "../models/SiteSetting.js";

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
    if (!req.file && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ success: false, message: "Không có file nào được tải lên" });
    }

    const settings = await getSettings();
    
    let uploadedUrls = [];
    if (req.files) {
        uploadedUrls = req.files.map(f => f.path);
    } else if (req.file) {
        uploadedUrls = [req.file.path];
    }

    if (fieldName === 'hero') {
      settings.heroImages = [...settings.heroImages, ...uploadedUrls];
    } else if (fieldName === 'about') {
      settings.aboutImages = [...settings.aboutImages, ...uploadedUrls];
    } else if (fieldName === 'trainer') {
      settings.trainerImage = uploadedUrls[0]; 
    } else if (fieldName === 'classes') {
      settings.classesImages = [...settings.classesImages, ...uploadedUrls];
    } else if (fieldName === 'tools') {
      settings.toolsImage = uploadedUrls[0];
    }

    await settings.save();
    res.json({ success: true, data: settings, message: "Cập nhật ảnh thành công!" });
  } catch (error) {
    console.error("Upload Image Error:", error);
    res.status(500).json({ success: false, message: error.message });
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
