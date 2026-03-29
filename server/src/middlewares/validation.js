import { body, param, validationResult } from "express-validator";
import mongoose from "mongoose";

// Middleware kiểm tra kết quả validation
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  next();
};

export const validateId = [
  param("id").isMongoId().withMessage("ID không hợp lệ"),
  handleValidationErrors,
];

// Custom validator cho thời gian: đảm bảo có thể parse thành Date hợp lệ
const isValidDate = (value) => {
  if (!value) return true; // cho phép optional
  const date = new Date(value);
  return !isNaN(date.getTime());
};

// Validation cho tạo/cập nhật checkin
export const validateCheckin = [
  body("orderId")
    .notEmpty()
    .withMessage("orderId là bắt buộc")
    .isMongoId()
    .withMessage("orderId không hợp lệ"),
  body("time")
    .optional()
    .isISO8601()
    .withMessage("time phải là định dạng ISO 8601")
    .custom(isValidDate)
    .withMessage("time không phải là thời gian hợp lệ"),
  body("muscle").notEmpty().withMessage("Vui lòng chọn nhóm cơ").isString(),
  body("note").optional().isString().withMessage("note phải là chuỗi"),
  handleValidationErrors,
];

// Validation cho cập nhật checkin
export const validateUpdateCheckin = [
  param("id").isMongoId().withMessage("ID checkin không hợp lệ"),
  body("time")
    .optional()
    .isISO8601()
    .withMessage("time phải là định dạng ISO 8601")
    .custom(isValidDate)
    .withMessage("time không phải là thời gian hợp lệ"),
  body("muscle").optional().isString().withMessage("muscle phải là chuỗi"),
  body("note").optional().isString().withMessage("note phải là chuỗi"),
  handleValidationErrors,
];

// Validation cho tạo đơn hàng
export const validateCreateOrder = [
  (req, res, next) => {
    next();
  },
  body("name")
    .notEmpty()
    .withMessage("Tên không được để trống")
    .isString()
    .withMessage("Tên phải là chuỗi"),
  body("email")
    .notEmpty()
    .withMessage("Email không được để trống")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  body("phone")
    .optional()
    .isMobilePhone("vi-VN")
    .withMessage("Số điện thoại không hợp lệ"),
  body("package")
    .notEmpty()
    .withMessage("Gói tập không được để trống")
    .isString(),
  body("sessions")
    .isInt({ min: 1 })
    .withMessage("Số buổi phải là số nguyên lớn hơn 0"),
  body("gym")
    .notEmpty()
    .withMessage("Phòng tập không được để trống")
    .isString(),
  body("schedule")
    .notEmpty()
    .withMessage("Lịch tập không được để trống")
    .isString(),
  body("note").optional().isString(),
  body("trainerId")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === "") return true;
      return mongoose.Types.ObjectId.isValid(value);
    })
    .withMessage("trainerId không hợp lệ"),
  handleValidationErrors,
];

// Validation cho cập nhật đơn hàng
export const validateUpdateOrder = [
  param("id").isMongoId().withMessage("ID đơn hàng không hợp lệ"),
  body("name").optional().isString(),
  body("email").optional().isEmail(),
  body("phone").optional().isString(),
  body("package").optional().isString(),
  body("sessions").optional().isInt({ min: 1 }),
  body("gym").optional().isString(),
  body("schedule").optional().isString(),
  body("note").optional().isString(),
  body("trainerId")
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage("trainerId không hợp lệ"),
  handleValidationErrors,
];

// Validation cho login
export const validateLogin = [
  body("email")
    .notEmpty()
    .withMessage("Email không được để trống")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  body("password")
    .notEmpty()
    .withMessage("Mật khẩu không được để trống")
    .isLength({ min: 6 })
    .withMessage("Mật khẩu tối thiểu 6 ký tự"),
  handleValidationErrors,
];

// Validation cho tạo trainer
export const validateCreateTrainer = [
  body("name").notEmpty().withMessage("Tên không được để trống"),
  body("email").notEmpty().withMessage("Email không được để trống").isEmail(),
  body("password")
    .notEmpty()
    .withMessage("Mật khẩu không được để trống")
    .isLength({ min: 6 })
    .withMessage("Mật khẩu tối thiểu 6 ký tự"),
  handleValidationErrors,
];

// Validation cho xóa user/trainer
export const validateDeleteUser = [
  param("id").isMongoId().withMessage("ID không hợp lệ"),
  handleValidationErrors,
];
