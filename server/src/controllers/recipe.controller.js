// controllers/recipe.controller.js
import Recipe from "../models/Recipe.js";

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

    const query = {};

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
    const recipe = await Recipe.create(req.body);
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
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, {
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
    res.json({ success: true, message: "Xóa công thức thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
