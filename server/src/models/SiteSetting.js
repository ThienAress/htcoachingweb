import mongoose from "mongoose";

const SiteSettingSchema = new mongoose.Schema(
  {
    // Chúng ta chỉ có 1 document duy nhất trong collection này
    isSingleton: {
      type: Boolean,
      default: true,
      unique: true, // Đảm bảo chỉ có 1 bản ghi
    },
    heroImages: {
      type: [String],
      default: [], // Mảng URL ảnh của slider Hero
    },
    heroImagesByKey: {
      type: Map,
      of: String,
      default: {},
    },
    heroAvatars: {
      type: [String],
      default: [], // Mảng URL avatar học viên xuất hiện ở box CountUp
    },
    heroAvatarsByKey: {
      type: Map,
      of: String,
      default: {},
    },
    aboutImages: {
      type: [String],
      default: [], // Mảng URL ảnh slider About
    },
    aboutImagesByKey: {
      type: Map,
      of: String,
      default: {},
    },
    trainerImage: {
      type: String,
      default: "", // 1 ảnh của Trainer
    },
    trainerImagesByKey: {
      type: Map,
      of: String,
      default: {},
    },
    classesImages: {
      type: [String],
      default: [], // 3 ảnh của 3 class (Personal Training, Cardio, Boxing)
    },
    classesImagesByKey: {
      type: Map,
      of: String,
      default: {},
    },
    toolsImage: {
      type: String,
      default: "", // Ảnh background của Tool (TDEE)
    },
    toolsImagesByKey: {
      type: Map,
      of: String,
      default: {},
    },
    // Quà tặng trên bảng giá theo khóa tab-gói (xem utils/pricingGifts.js). Thiếu khóa = dùng quà mặc định ở giao diện.
    pricingGifts: {
      type: Map,
      of: [String],
      default: {},
    },
    // Quyền lợi khách hàng/hệ thống của các tab 1-1, ONLINE, Trải nghiệm (xem utils/pricingContent.js). Thiếu khóa = dùng nội dung gốc ở giao diện.
    pricingContent: {
      type: Map,
      of: [String],
      default: {},
    },
    // Ưu đãi giảm giá cho lần đăng ký đầu có tài khoản. Chưa lưu = bật, 15%.
    loginPromo: {
      enabled: { type: Boolean, default: true },
      percent: { type: Number, default: 15, min: 1, max: 100, validate: Number.isSafeInteger },
    },
  },
  { timestamps: true }
);

export default mongoose.model("SiteSetting", SiteSettingSchema);
