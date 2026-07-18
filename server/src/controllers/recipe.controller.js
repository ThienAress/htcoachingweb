// controllers/recipe.controller.js
import Recipe from "../models/Recipe.js";
import { v2 as cloudinary } from "cloudinary";

// Whitelist fields cho admin update/create
const ALLOWED_RECIPE_FIELDS = [
  "name", "nameEn", "slug", "category", "area", "prepTime",
  "tags", "isPublished", "ingredients", "instructions",
  "youtubeUrl", "sourceUrl", "source", "thumbnail",
];

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

    const query = { isPublished: { $ne: false } };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    if (category) query.category = category;
    // Gộp "Việt Nam" và "Vietnamese" khi filter
    if (area) {
      query.area =
        area === "Việt Nam"
          ? { $in: ["Việt Nam", "Vietnamese"] }
          : area;
    }
    if (tag) query.tags = tag;
    if (source) query.source = source;

    const page = parseInt(rawPage) || 1;
    const limit = parseInt(rawLimit) || 12;
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

    const [recipes, total] = await Promise.all([
      Recipe.aggregate(pipeline),
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

// Lấy chi tiết recipe theo slug – public
export const getRecipeBySlug = async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ slug: req.params.slug }).lean();
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
    const categories = await Recipe.distinct("category");
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
    let areas = await Recipe.distinct("area");
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

    const recipe = await Recipe.findById(recipeId);
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

// Lấy danh sách recipes đã bookmark – cần đăng nhập
export const getBookmarkedRecipes = async (req, res) => {
  try {
    const User = (await import("../models/User.js")).default;
    const user = await User.findById(req.user.id).lean();
    const savedIds = user.savedRecipes || [];

    if (savedIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const recipes = await Recipe.find({ _id: { $in: savedIds } })
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
    const data = pickAllowedFields(req.body);
    const recipe = await Recipe.create(data);
    res.status(201).json({ success: true, data: recipe });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "Slug đã tồn tại" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: Cập nhật recipe
export const updateRecipe = async (req, res) => {
  try {
    const updates = pickAllowedFields(req.body);
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
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

// Admin: Xóa recipe
export const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!recipe) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy công thức" });
    }

    // Cleanup ảnh trên Cloudinary nếu có
    if (recipe.thumbnail) {
      try {
        // Extract public_id từ URL Cloudinary
        // URL format: https://res.cloudinary.com/.../htcoaching/recipes/abc123.jpg
        const parts = recipe.thumbnail.split("/");
        const folderIdx = parts.indexOf("htcoaching");
        if (folderIdx !== -1) {
          const publicId = parts
            .slice(folderIdx)
            .join("/")
            .replace(/\.[^.]+$/, ""); // bỏ extension
          await cloudinary.uploader.destroy(publicId);
        }
      } catch {
        // Không block response nếu xóa ảnh thất bại
      }
    }

    res.json({ success: true, message: "Xóa công thức thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: Lấy tất cả danh sách (kể cả chưa duyệt)
export const getAdminRecipes = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20, isPublished } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { nameEn: { $regex: search, $options: "i" } },
      ];
    }
    
    if (isPublished !== undefined && isPublished !== "") {
      query.isPublished = isPublished === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [recipes, total] = await Promise.all([
      Recipe.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Recipe.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: recipes,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: Upload hình ảnh thumbnail cho Recipe
export const uploadThumbnail = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
    }

    const recipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      { thumbnail: req.file.path },
      { new: true, runValidators: true }
    );

    if (!recipe) {
      return res.status(404).json({ success: false, message: "Không tìm thấy công thức" });
    }

    res.json({
      success: true,
      message: "Tải ảnh lên thành công",
      data: recipe,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
