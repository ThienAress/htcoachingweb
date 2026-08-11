import Food from "../models/Food.js";
import FoodPriceObservation, {
  FOOD_PRICE_SOURCE_KEYS,
} from "../models/FoodPriceObservation.js";

const FRESHNESS_DAYS = 90;
const SOURCE_HOSTS = Object.freeze({
  bach_hoa_xanh: ["bachhoaxanh.com", "www.bachhoaxanh.com"],
  winmart: ["winmart.vn", "www.winmart.vn"],
  coop_online: ["cooponline.vn", "www.cooponline.vn"],
});

const priceError = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });

const assertSourceUrl = (sourceKey, value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw priceError("FOOD_PRICE_SOURCE_INVALID", "URL nguồn giá không hợp lệ");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !SOURCE_HOSTS[sourceKey]?.includes(url.hostname.toLowerCase())
  ) {
    throw priceError("FOOD_PRICE_SOURCE_INVALID", "Nguồn giá không được hỗ trợ");
  }
  url.hash = "";
  return url.toString();
};

export const normalizeFoodPriceObservation = (input) => {
  const sourceKey = String(input?.sourceKey || "");
  const packGrams = Number(input?.packGrams);
  const regularPriceVnd = Number(input?.regularPriceVnd);
  const promotionalPriceVnd =
    input?.promotionalPriceVnd == null
      ? null
      : Number(input.promotionalPriceVnd);
  const observedAt = new Date(input?.observedAt);
  if (!FOOD_PRICE_SOURCE_KEYS.includes(sourceKey)) {
    throw priceError("FOOD_PRICE_SOURCE_INVALID", "Nguồn giá không hợp lệ");
  }
  if (
    !Number.isFinite(packGrams) ||
    packGrams < 1 ||
    packGrams > 100_000 ||
    !Number.isInteger(regularPriceVnd) ||
    regularPriceVnd < 1 ||
    regularPriceVnd > 100_000_000 ||
    (promotionalPriceVnd !== null &&
      (!Number.isInteger(promotionalPriceVnd) ||
        promotionalPriceVnd < 1 ||
        promotionalPriceVnd > regularPriceVnd)) ||
    Number.isNaN(observedAt.getTime()) ||
    observedAt.getTime() > Date.now() + 86_400_000
  ) {
    throw priceError("FOOD_PRICE_INVALID", "Quan sát giá không hợp lệ");
  }
  return {
    sourceKey,
    region: "ho_chi_minh",
    currency: "VND",
    packGrams,
    regularPriceVnd,
    promotionalPriceVnd,
    sourceUrl: assertSourceUrl(sourceKey, input?.sourceUrl),
    observedAt,
  };
};

const SOURCE_PRIORITY = Object.freeze({
  bach_hoa_xanh: 0,
  winmart: 1,
  coop_online: 2,
});

export const summarizeFoodPriceObservations = (observations) => {
  const selected = [...observations].sort((left, right) => {
    const dateDifference = right.observedAt.getTime() - left.observedAt.getTime();
    if (dateDifference !== 0) return dateDifference;
    return (
      (SOURCE_PRIORITY[left.sourceKey] ?? Number.MAX_SAFE_INTEGER) -
      (SOURCE_PRIORITY[right.sourceKey] ?? Number.MAX_SAFE_INTEGER)
    );
  })[0];
  if (!selected) {
    return {
      region: "ho_chi_minh",
      currency: "VND",
      lowVndPer100g: null,
      typicalVndPer100g: null,
      highVndPer100g: null,
      asOf: null,
      sourceCount: 0,
      coverageStatus: "insufficient",
    };
  }
  const pricePer100g = Math.round(
    (selected.regularPriceVnd / selected.packGrams) * 100,
  );
  return {
    region: "ho_chi_minh",
    currency: "VND",
    lowVndPer100g: pricePer100g,
    typicalVndPer100g: pricePer100g,
    highVndPer100g: pricePer100g,
    asOf: selected.observedAt,
    sourceCount: 1,
    coverageStatus: "sufficient",
  };
};

export const getFoodMarketPriceMap = async (
  foodIds,
  { now = new Date() } = {},
) => {
  if (!Array.isArray(foodIds) || foodIds.length === 0) return new Map();
  const freshAfter = new Date(now.getTime() - FRESHNESS_DAYS * 86_400_000);
  const observations = await FoodPriceObservation.find({
    foodId: { $in: foodIds },
    region: "ho_chi_minh",
    observedAt: { $gte: freshAfter, $lte: now },
  })
    .select("foodId sourceKey packGrams regularPriceVnd observedAt")
    .lean();
  const grouped = new Map();
  observations.forEach((observation) => {
    const key = String(observation.foodId);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(observation);
  });
  return new Map(
    foodIds.map((foodId) => {
      const key = String(foodId);
      return [key, summarizeFoodPriceObservations(grouped.get(key) || [])];
    }),
  );
};

export const listFoodPriceObservations = async (foodId) =>
  FoodPriceObservation.find({ foodId }).sort({ observedAt: -1 }).lean();

export const createFoodPriceObservation = async (foodId, input) => {
  if (!(await Food.exists({ _id: foodId }))) {
    throw priceError("FOOD_NOT_FOUND", "Không tìm thấy thực phẩm", 404);
  }
  return FoodPriceObservation.create({
    foodId,
    ...normalizeFoodPriceObservation(input),
  });
};

export const deleteFoodPriceObservation = async (foodId, observationId) => {
  const deleted = await FoodPriceObservation.findOneAndDelete({
    _id: observationId,
    foodId,
  });
  if (!deleted) {
    throw priceError("FOOD_PRICE_NOT_FOUND", "Không tìm thấy quan sát giá", 404);
  }
};
