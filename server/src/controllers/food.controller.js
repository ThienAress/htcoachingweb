// controllers/food.controller.js
import Food from "../models/Food.js";
import {
  hasFoodMacroMutation,
  hasKnownFoodSource,
  normalizeFoodSource,
} from "../services/foodProvenance.js";
import { safeLog } from "../utils/safeLogger.js";
import FoodPriceObservation from "../models/FoodPriceObservation.js";
import { normalizeFoodAllergenProfile } from "../services/foodAllergen.service.js";
import { getFoodMarketPriceMap } from "../services/foodPrice.service.js";
import { FOOD_OPTIONAL_NUTRIENTS } from "../constants/foodNutrition.js";

const optionalNutritionFields = (payload) =>
  Object.fromEntries(
    FOOD_OPTIONAL_NUTRIENTS
      .filter((field) => payload[field] !== undefined)
      .map((field) => [
        field,
        payload[field] === null || payload[field] === ""
          ? null
          : Number(payload[field]),
      ]),
  );

const withMarketPrices = async (foods) => {
  const rows = foods.map((food) =>
    typeof food.toObject === "function" ? food.toObject() : food,
  );
  const prices = await getFoodMarketPriceMap(rows.map(({ _id }) => _id));
  return rows.map((food) => ({
    ...food,
    marketPrice: prices.get(String(food._id)),
  }));
};

const provenanceErrorResponse = (res, error) =>
  res.status(error?.status || 400).json({
    success: false,
    code: error?.code || "FOOD_SOURCE_INVALID",
    message: error?.message || "Nguồn dữ liệu dinh dưỡng không hợp lệ",
  });

const metadataErrorResponse = (res, error) =>
  res.status(error?.statusCode || 400).json({
    success: false,
    code: error?.code || "FOOD_METADATA_INVALID",
    message: error?.message || "Metadata thực phẩm không hợp lệ",
  });

// Lấy danh sách thực phẩm (có phân trang, tìm kiếm) – ai cũng xem được
export const getFoods = async (req, res) => {
  try {
    const search = req.query.search || "";

    let query = {};
    if (search) {
      query.label = { $regex: search, $options: "i" };
    }

    const total = await Food.countDocuments(query);

    let foods;
    if (req.query.all === "true" || req.query.limit === "all") {
      foods = await Food.find(query).sort({ label: 1 }).lean();
      foods = await withMarketPrices(foods);
      res.json({
        success: true,
        data: foods,
        pagination: {
          total,
          page: 1,
          limit: total,
          totalPages: 1,
        },
      });
    } else {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      foods = await Food.find(query)
        .sort({ label: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
      foods = await withMarketPrices(foods);

      res.json({
        success: true,
        data: foods,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  } catch (err) {
    safeLog.error("food.list_failed", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy một thực phẩm theo ID
export const getFoodById = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id).lean();
    if (!food) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thực phẩm" });
    }
    const [data] = await withMarketPrices([food]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Tạo mới (chỉ admin)
export const createFood = async (req, res) => {
  try {
    let { label, protein, carb, fat, calories, nutritionBasis, source, allergenProfile } = req.body;
    source = normalizeFoodSource(source);
    allergenProfile = normalizeFoodAllergenProfile(allergenProfile);

    // validation cơ bản
    if (
      !label ||
      protein === undefined ||
      carb === undefined ||
      fat === undefined
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    // Nếu không có calories, tự tính
    if (calories === undefined || calories === null || calories === "") {
      calories = protein * 4 + carb * 4 + fat * 9;
    } else {
      calories = parseFloat(calories);
    }

    // Kiểm tra trùng label
    const existing = await Food.findOne({ label });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Thực phẩm đã tồn tại" });
    }

    const food = await Food.create({
      label,
      protein: parseFloat(protein),
      carb: parseFloat(carb),
      fat: parseFloat(fat),
      calories,
      ...optionalNutritionFields(req.body),
      nutritionBasis: nutritionBasis || "per_100g",
      source,
      allergenProfile,
    });

    res.status(201).json({ success: true, data: food });
  } catch (err) {
    if (err?.statusCode === 400) return metadataErrorResponse(res, err);
    if (err?.code?.startsWith("FOOD_SOURCE_")) {
      return provenanceErrorResponse(res, err);
    }
    safeLog.error("food.create_failed", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

//Tạo nhiều thực phẩm
export const createManyFoods = async (req, res) => {
  try {
    const foods = req.body.foods; // nhận mảng [{ label, protein, carb, fat, calories }]
    if (!Array.isArray(foods) || foods.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Dữ liệu không hợp lệ" });
    }

    let normalizedSources;
    try {
      normalizedSources = foods.map((item) => normalizeFoodSource(item.source));
    } catch (error) {
      return provenanceErrorResponse(res, error);
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const [index, item] of foods.entries()) {
      try {
        let { label, protein, carb, fat, calories, nutritionBasis } = item;
        const allergenProfile = normalizeFoodAllergenProfile(item.allergenProfile);

        if (
          !label ||
          protein === undefined ||
          carb === undefined ||
          fat === undefined
        ) {
          results.failed.push({ ...item, error: "Thiếu trường bắt buộc" });
          continue;
        }

        // Tính calories nếu chưa có
        if (calories === undefined || calories === null || calories === "") {
          calories = protein * 4 + carb * 4 + fat * 9;
        }

        // Kiểm tra trùng
        const existing = await Food.findOne({ label });
        if (existing) {
          results.failed.push({ ...item, error: "Tên thực phẩm đã tồn tại" });
          continue;
        }

        const newFood = await Food.create({
          label,
          protein: parseFloat(protein),
          carb: parseFloat(carb),
          fat: parseFloat(fat),
          calories: parseFloat(calories),
          ...optionalNutritionFields(item),
          nutritionBasis: nutritionBasis || "per_100g",
          source: normalizedSources[index],
          allergenProfile,
        });
        results.success.push(newFood);
      } catch (err) {
        results.failed.push({ ...item, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      data: results,
      message: `Thêm thành công ${results.success.length} / ${foods.length} thực phẩm`,
    });
  } catch (err) {
    safeLog.error("food.batch_create_failed", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Cập nhật (chỉ admin)
export const updateFood = async (req, res) => {
  try {
    const { label, protein, carb, fat, calories, nutritionBasis, source, allergenProfile } = req.body;
    const food = await Food.findById(req.params.id);
    if (!food) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thực phẩm" });
    }

    if (
      hasFoodMacroMutation(req.body) &&
      !hasKnownFoodSource(food.source) &&
      !source
    ) {
      return provenanceErrorResponse(
        res,
        Object.assign(new Error("Cần bổ sung nguồn trước khi sửa macro legacy"), {
          code: "FOOD_SOURCE_REQUIRED",
          status: 400,
        }),
      );
    }

    if (label) food.label = label;
    if (protein !== undefined) food.protein = protein;
    if (carb !== undefined) food.carb = carb;
    if (fat !== undefined) food.fat = fat;
    if (calories !== undefined) food.calories = calories;
    for (const [field, value] of Object.entries(optionalNutritionFields(req.body))) {
      food[field] = value;
    }
    if (nutritionBasis !== undefined) food.nutritionBasis = nutritionBasis;
    if (source !== undefined) food.source = normalizeFoodSource(source);
    if (allergenProfile !== undefined) {
      food.allergenProfile = normalizeFoodAllergenProfile(allergenProfile);
    }
    await food.save();
    res.json({ success: true, data: food });
  } catch (err) {
    if (err?.statusCode === 400) return metadataErrorResponse(res, err);
    if (err?.code?.startsWith("FOOD_SOURCE_")) {
      return provenanceErrorResponse(res, err);
    }
    safeLog.error("food.update_failed", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Xóa (chỉ admin)
export const deleteFood = async (req, res) => {
  try {
    const food = await Food.findByIdAndDelete(req.params.id);
    if (!food) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thực phẩm" });
    }
    await FoodPriceObservation.deleteMany({ foodId: food._id });
    res.json({ success: true, message: "Xóa thực phẩm thành công" });
  } catch (err) {
    safeLog.error("food.delete_failed", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
