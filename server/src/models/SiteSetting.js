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
    aboutImages: {
      type: [String],
      default: [], // Mảng URL ảnh slider About
    },
    trainerImage: {
      type: String,
      default: "", // 1 ảnh của Trainer
    },
    classesImages: {
      type: [String],
      default: [], // 3 ảnh của 3 class (Personal Training, Cardio, Boxing)
    },
    toolsImage: {
      type: String,
      default: "", // Ảnh background của Tool (TDEE)
    },
  },
  { timestamps: true }
);

export default mongoose.model("SiteSetting", SiteSettingSchema);
