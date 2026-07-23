// controllers/recipe.controller.js
import Recipe from "../models/Recipe.js";
import { v2 as cloudinary } from "cloudinary";
import { trackDbQuery } from "../observability/queryTelemetry.js";
import { safeLog } from "../utils/safeLogger.js";
import { triggerNetlifyBuild } from "../utils/triggerBuild.js";

// Whitelist fields cho admin update/create
const ALLOWED_RECIPE_FIELDS = [
  "name", "nameEn", "slug", "category", "area", "prepTime",
  "tags", "isPublished", "ingredients", "instructions",
  "youtubeUrl", "sourceUrl", "source",
];

const normalizeSlug = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const RECIPE_STRING_FIELDS = [
  "name",
  "nameEn",
  "category",
  "area",
  "prepTime",
  "youtubeUrl",
  "sourceUrl",
];

const normalizeRecipeData = (rawData, { forCreate = false } = {}) => {
  const data = { ...rawData };

  for (const field of RECIPE_STRING_FIELDS) {
    if (data[field] === undefined) continue;
    if (typeof data[field] !== "string") {
      throw new TypeError(`${field} must be a string`);
    }
    data[field] = data[field].trim();
  }

  if (data.slug !== undefined) {
    if (typeof data.slug !== "string") {
      throw new TypeError("slug must be a string");
    }
    data.slug = normalizeSlug(data.slug);
  } else if (forCreate && data.name) {
    data.slug = normalizeSlug(data.name);
  }

  if (
    data.isPublished !== undefined &&
    typeof data.isPublished !== "boolean"
  ) {
    throw new TypeError("isPublished must be a boolean");
  }

  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      throw new TypeError("tags must be an array");
    }
    data.tags = data.tags
      .map((tag) => {
        if (typeof tag !== "string") {
          throw new TypeError("each tag must be a string");
        }
        return tag.trim();
      })
      .filter(Boolean);
  }

  if (data.ingredients !== undefined) {
    if (!Array.isArray(data.ingredients)) {
      throw new TypeError("ingredients must be an array");
    }
    data.ingredients = data.ingredients.map((ingredient) => {
      if (
        !ingredient ||
        typeof ingredient !== "object" ||
        typeof ingredient.name !== "string" ||
        (ingredient.measure !== undefined &&
          typeof ingredient.measure !== "string")
      ) {
        throw new TypeError("ingredient payload is invalid");
      }
      return {
        name: ingredient.name.trim(),
        measure: String(ingredient.measure || "").trim(),
      };
    });
  }

  if (data.instructions !== undefined) {
    if (
      !Array.isArray(data.instructions) ||
      data.instructions.some((step) => typeof step !== "string")
    ) {
      throw new TypeError("instructions must be an array of strings");
    }
    data.instructions = data.instructions
      .map((step) => step.trim())
      .filter(Boolean);
  }

  if (
    data.source !== undefined &&
    !["mealdb", "ai", "manual"].includes(data.source)
  ) {
    throw new TypeError("source is invalid");
  }

  return data;
};

const sendRecipeWriteError = (res, error) => {
  if (error.code === 11000) {
    return res
      .status(409)
      .json({ success: false, message: "Slug already exists" });
  }
  if (
    error instanceof TypeError ||
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: error.message });
};

const getCloudinaryPublicId = (recipe) => {
  if (recipe.thumbnailPublicId) return recipe.thumbnailPublicId;
  if (!recipe.thumbnail) return "";
  const parts = recipe.thumbnail.split("/");
  const folderIndex = parts.indexOf("htcoaching");
  if (folderIndex === -1) return "";
  return parts.slice(folderIndex).join("/").replace(/\.[^.]+$/, "");
};

const destroyCloudinaryAsset = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    safeLog.error("recipe.cloudinary_cleanup_failed", error);
  }
};

const pickAllowedFields = (body) => {
  const result = {};
  for (const key of ALLOWED_RECIPE_FIELDS) {
    if (body[key] !== undefined) result[key] = body[key];
  }
  return result;
};

// Lấy danh sách recipes (phân trang, filter, search) – public
export const getRecipes = async (req, res) => {
  try {
    const {
      search = "",
      category,
      area,
      tag,
      source,
      page: rawPage,
      limit: rawLimit,
    } = req.query;

    const query = { isPublished: true };

    if (search) {
      const safeSearch = search
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { nameEn: { $regex: safeSearch, $options: "i" } },
      ];
    }
    if (category) query.category = String(category).trim().slice(0, 100);
    // Gộp "Việt Nam" và "Vietnamese" khi filter
    if (area) {
      const normalizedArea = String(area).trim().slice(0, 100);
      query.area =
        normalizedArea === "Việt Nam"
          ? { $in: ["Việt Nam", "Vietnamese"] }
          : normalizedArea;
    }
    if (tag) query.tags = String(tag).trim().slice(0, 100);
    if (["mealdb", "ai", "manual"].includes(source)) query.source = source;

    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(rawLimit, 10) || 12, 1),
      50,
    );
    const skip = (page - 1) * limit;

    // Aggregate: sort Việt Nam lên đầu
    const pipeline = [
      { $match: query },
      {
        $addFields: {
          _vn: {
            $cond: [
              { $in: ["$area", ["Việt Nam", "Vietnamese"]] },
              0,
              1,
            ],
          },
        },
      },
      { $sort: { _vn: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          name: 1, slug: 1, category: 1, area: 1,
          thumbnail: 1, prepTime: 1, tags: 1, source: 1,
        },
      },
    ];

    const [recipes, total] = await trackDbQuery("recipe.public.list", () =>
      Promise.all([
        Recipe.aggregate(pipeline),
        Recipe.countDocuments(query),
      ]),
    );

    res.json({
      success: true,
      data: recipes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy chi tiết recipe theo slug – public
export const getRecipeBySlug = async (req, res) => {
  try {
    const recipe = await Recipe.findOne({
      slug: String(req.params.slug || "").toLowerCase().trim().slice(0, 180),
      isPublished: true,
    }).lean();
    if (!recipe) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy công thức" });
    }
    res.json({ success: true, data: recipe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy danh sách categories (cho filter UI) – public
export const getRecipeCategories = async (req, res) => {
  try {
    const categories = await Recipe.distinct("category", {
      isPublished: true,
    });
    res.json({
      success: true,
      data: categories.filter(Boolean).sort(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy danh sách areas/quốc gia (cho filter UI) – public
export const getRecipeAreas = async (req, res) => {
  try {
    let areas = await Recipe.distinct("area", { isPublished: true });
    // Normalize: gộp "Vietnamese" → "Việt Nam"
    areas = [...new Set(areas.map((a) => (a === "Vietnamese" ? "Việt Nam" : a)))]
      .filter(Boolean);
    // Sort: Việt Nam lên đầu, còn lại alphabetical
    areas.sort((a, b) => {
      if (a === "Việt Nam") return -1;
      if (b === "Việt Nam") return 1;
      return a.localeCompare(b);
    });
    res.json({ success: true, data: areas });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Bookmark: Lưu/bỏ lưu recipe – cần đăng nhập
export const toggleBookmark = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipeId } = req.params;

    const recipe = await Recipe.findOne({
      _id: recipeId,
      isPublished: true,
    });
    if (!recipe) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy công thức" });
    }

    // Lazy import User để tránh circular dependency
    const User = (await import("../models/User.js")).default;
    const user = await User.findById(userId);

    const bookmarks = user.savedRecipes || [];
    const index = bookmarks.findIndex(
      (id) => id.toString() === recipeId,
    );

    if (index === -1) {
      bookmarks.push(recipeId);
    } else {
      bookmarks.splice(index, 1);
    }

    user.savedRecipes = bookmarks;
    await user.save();

    res.json({
      success: true,
      saved: index === -1,
      message: index === -1 ? "Đã lưu công thức" : "Đã bỏ lưu công thức",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addBookmark = async (req, res) => {
  try {
    const recipe = await Recipe.findOne({
      _id: req.params.recipeId,
      isPublished: true,
    }).select("_id");
    if (!recipe) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy công thức" });
    }

    const User = (await import("../models/User.js")).default;
    await User.updateOne(
      { _id: req.user.id },
      { $addToSet: { savedRecipes: recipe._id } },
    );
    return res.json({
      success: true,
      saved: true,
      message: "Đã lưu công thức",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const removeBookmark = async (req, res) => {
  try {
    const User = (await import("../models/User.js")).default;
    await User.updateOne(
      { _id: req.user.id },
      { $pull: { savedRecipes: req.params.recipeId } },
    );
    return res.json({
      success: true,
      saved: false,
      message: "Đã bỏ lưu công thức",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy danh sách recipes đã bookmark – cần đăng nhập
export const getBookmarkedRecipes = async (req, res) => {
  try {
    const User = (await import("../models/User.js")).default;
    const user = await User.findById(req.user.id).lean();
    const savedIds = user.savedRecipes || [];

    if (savedIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const recipes = await Recipe.find({
      _id: { $in: savedIds },
      isPublished: true,
    })
      .select("name slug category area thumbnail prepTime tags")
      .lean();

    res.json({ success: true, data: recipes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: Tạo recipe mới
export const createRecipe = async (req, res) => {
  try {
    const data = normalizeRecipeData(pickAllowedFields(req.body), {
      forCreate: true,
    });
    const recipe = await Recipe.create(data);
    if (recipe.isPublished) {
      void triggerNetlifyBuild();
    }
    res.status(201).json({ success: true, data: recipe });
  } catch (err) {
    return sendRecipeWriteError(res, err);
  }
};

// Admin: Cập nhật recipe
export const updateRecipe = async (req, res) => {
  try {
    const updates = normalizeRecipeData(pickAllowedFields(req.body));
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!recipe) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy công thức" });
    }
    void triggerNetlifyBuild();
    res.json({ success: true, data: recipe });
  } catch (err) {
    return sendRecipeWriteError(res, err);
  }
};

// Admin: Xóa recipe
export const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .select("+thumbnailPublicId");
    if (!recipe) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy công thức" });
    }

    await Recipe.deleteOne({ _id: recipe._id });
    await destroyCloudinaryAsset(getCloudinaryPublicId(recipe));
    if (recipe.isPublished) {
      void triggerNetlifyBuild();
    }

    res.json({ success: true, message: "Xóa công thức thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: Lấy tất cả danh sách (kể cả chưa duyệt)
export const getAdminRecipes = async (req, res) => {
  try {
    const { search = "", isPublished } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );
    const query = {};

    if (search) {
      const safeSearch = search
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { nameEn: { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (isPublished !== undefined && isPublished !== "") {
      query.isPublished = isPublished === "true";
    }

    const skip = (page - 1) * limit;

    const [recipes, total] = await Promise.all([
      Recipe.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Recipe.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: recipes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: Upload hình ảnh thumbnail cho Recipe
export const uploadThumbnail = async (req, res) => {
  const uploadedPublicId = req.file?.filename || "";
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
    }

    const recipe = req.recipe;
    const previousPublicId = getCloudinaryPublicId(recipe);
    recipe.thumbnail = req.file.path;
    recipe.thumbnailPublicId = uploadedPublicId;
    await recipe.save();
    if (previousPublicId && previousPublicId !== uploadedPublicId) {
      await destroyCloudinaryAsset(previousPublicId);
    }

    res.json({
      success: true,
      message: "Tải ảnh lên thành công",
      data: recipe,
    });
  } catch (err) {
    await destroyCloudinaryAsset(uploadedPublicId);
    return sendRecipeWriteError(res, err);
  }
};

export const loadRecipeForUpload = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .select("+thumbnailPublicId");
    if (!recipe) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy công thức" });
    }
    req.recipe = recipe;
    return next();
  } catch (err) {
    return next(err);
  }
};
