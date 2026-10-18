import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { deprecatedRoute } from "../middlewares/deprecatedRoute.js";
import {
  getSiteSettings,
  uploadSettingImage,
  removeSettingImage,
  savePricingGifts,
  resetPricingGifts,
  savePricingContent,
  resetPricingContent,
  saveLoginPromo,
  resetLoginPromo,
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
router.post("/upload/hero/:itemKey", uploadHeroImage.single("image"), (req, res, next) => { req.body.fieldName = 'hero'; req.body.itemKey = req.params.itemKey; next(); }, uploadSettingImage);
router.post("/upload/hero", uploadHeroImage.array("images", 5), (req, res, next) => { req.body.fieldName = 'hero'; next(); }, uploadSettingImage);
router.post("/upload/hero-avatars/:itemKey", uploadHeroAvatar.single("image"), (req, res, next) => { req.body.fieldName = 'heroAvatars'; req.body.itemKey = req.params.itemKey; next(); }, uploadSettingImage);
router.post("/upload/hero-avatars", uploadHeroAvatar.array("images", 3), (req, res, next) => { req.body.fieldName = 'heroAvatars'; next(); }, uploadSettingImage);
router.post("/upload/about/:itemKey", uploadAboutImage.single("image"), (req, res, next) => { req.body.fieldName = 'about'; req.body.itemKey = req.params.itemKey; next(); }, uploadSettingImage);
router.post("/upload/about", uploadAboutImage.array("images", 5), (req, res, next) => { req.body.fieldName = 'about'; next(); }, uploadSettingImage);
router.post("/upload/trainer/:itemKey", uploadTrainerImage.single("image"), (req, res, next) => { req.body.fieldName = 'trainer'; req.body.itemKey = req.params.itemKey; next(); }, uploadSettingImage);
router.post("/upload/trainer", uploadTrainerImage.single("image"), (req, res, next) => { req.body.fieldName = 'trainer'; next(); }, uploadSettingImage);
router.post("/upload/classes/:itemKey", uploadClassesImage.single("image"), (req, res, next) => { req.body.fieldName = 'classes'; req.body.itemKey = req.params.itemKey; next(); }, uploadSettingImage);
router.post("/upload/classes", uploadClassesImage.array("images", 5), (req, res, next) => { req.body.fieldName = 'classes'; next(); }, uploadSettingImage);
router.post("/upload/tools/:itemKey", uploadToolsImage.single("image"), (req, res, next) => { req.body.fieldName = 'tools'; req.body.itemKey = req.params.itemKey; next(); }, uploadSettingImage);
router.post("/upload/tools", uploadToolsImage.single("image"), (req, res, next) => { req.body.fieldName = 'tools'; next(); }, uploadSettingImage);

// DELETE xoá ảnh (đường cũ /remove giữ làm bí danh; gỡ khi api.deprecated_route_hits về 0)
router.delete("/images", removeSettingImage);
router.delete("/remove", deprecatedRoute("/api/site-settings/images"), removeSettingImage);

// Quà tặng trên bảng giá (khóa tab-gói cố định)
router.put("/pricing-gifts/:key", savePricingGifts);
router.delete("/pricing-gifts/:key", resetPricingGifts);
router.put("/pricing-content/:key", savePricingContent);
router.delete("/pricing-content/:key", resetPricingContent);
router.put("/login-promo", saveLoginPromo);
router.delete("/login-promo", resetLoginPromo);

export default router;
