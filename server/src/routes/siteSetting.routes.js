import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  getSiteSettings,
  uploadSettingImage,
  removeSettingImage,
} from "../controllers/siteSetting.controller.js";
import {
  uploadHeroImage,
  uploadHeroAvatar,
  uploadAboutImage,
  uploadTrainerImage,
  uploadClassesImage,
  uploadToolsImage,
} from "../middlewares/siteSettingUpload.js";

const router = express.Router();

// Lấy settings (Public cho ai cũng xem được)
router.get("/", getSiteSettings);

// Sửa settings yêu cầu quyền Admin + CSRF
router.use(protect, requireRoles("admin"), csrfProtection);

// POST upload ảnh cho từng phần
router.post("/upload/hero", uploadHeroImage.array("images", 5), (req, res, next) => { req.body.fieldName = 'hero'; next(); }, uploadSettingImage);
router.post("/upload/hero-avatars", uploadHeroAvatar.array("images", 3), (req, res, next) => { req.body.fieldName = 'heroAvatars'; next(); }, uploadSettingImage);
router.post("/upload/about", uploadAboutImage.array("images", 5), (req, res, next) => { req.body.fieldName = 'about'; next(); }, uploadSettingImage);
router.post("/upload/trainer", uploadTrainerImage.single("image"), (req, res, next) => { req.body.fieldName = 'trainer'; next(); }, uploadSettingImage);
router.post("/upload/classes", uploadClassesImage.array("images", 5), (req, res, next) => { req.body.fieldName = 'classes'; next(); }, uploadSettingImage);
router.post("/upload/tools", uploadToolsImage.single("image"), (req, res, next) => { req.body.fieldName = 'tools'; next(); }, uploadSettingImage);

// DELETE xoá ảnh
router.delete("/remove", removeSettingImage);

export default router;
