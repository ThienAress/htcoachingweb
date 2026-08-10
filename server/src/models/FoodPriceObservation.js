import mongoose from "mongoose";

export const FOOD_PRICE_SOURCE_KEYS = Object.freeze([
  "bach_hoa_xanh",
  "winmart",
  "coop_online",
]);

const foodPriceObservationSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      required: true,
      index: true,
    },
    sourceKey: {
      type: String,
      enum: FOOD_PRICE_SOURCE_KEYS,
      required: true,
    },
    region: {
      type: String,
      enum: ["ho_chi_minh"],
      default: "ho_chi_minh",
      required: true,
    },
    currency: { type: String, enum: ["VND"], default: "VND", required: true },
    packGrams: { type: Number, required: true, min: 1, max: 100_000 },
    regularPriceVnd: {
      type: Number,
      required: true,
      min: 1,
      max: 100_000_000,
      validate: Number.isInteger,
    },
    promotionalPriceVnd: {
      type: Number,
      default: null,
      min: 1,
      max: 100_000_000,
      validate: {
        validator: (value) => value == null || Number.isInteger(value),
        message: "Giá khuyến mãi phải là số nguyên VND",
      },
    },
    sourceUrl: { type: String, required: true, trim: true, maxlength: 500 },
    observedAt: { type: Date, required: true },
  },
  { timestamps: true, strict: "throw" },
);

foodPriceObservationSchema.index(
  { foodId: 1, region: 1, sourceKey: 1, observedAt: -1 },
  { name: "food_price_lookup" },
);
foodPriceObservationSchema.index(
  { foodId: 1, sourceKey: 1, observedAt: 1 },
  { unique: true, name: "uniq_food_price_observation" },
);

export default mongoose.model(
  "FoodPriceObservation",
  foodPriceObservationSchema,
);
