// controllers/food.controller.js
import Food from "../models/Food.js";

// Lấy danh sách thực phẩm (có phân trang, tìm kiếm) – ai cũng xem được
export const getFoods = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    let query = {};
    if (search) {
      query.label = { $regex: search, $options: "i" };
    }

    const total = await Food.countDocuments(query);
    const foods = await Food.find(query)
      .sort({ label: 1 })
      .skip(skip)
      .limit(limit);

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
  } catch (err) {
    console.error("GET FOODS ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy một thực phẩm theo ID
export const getFoodById = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thực phẩm" });
    }
    res.json({ success: true, data: food });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Tạo mới (chỉ admin)
export const createFood = async (req, res) => {
  try {
    let { label, protein, carb, fat, calories } = req.body;

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
    });

    res.status(201).json({ success: true, data: food });
  } catch (err) {
    console.error("CREATE FOOD ERROR:", err);
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

    const results = {
      success: [],
      failed: [],
    };

    for (const item of foods) {
      try {
        let { label, protein, carb, fat, calories } = item;

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
    console.error("BATCH CREATE FOODS ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Cập nhật (chỉ admin)
export const updateFood = async (req, res) => {
  try {
    const { label, protein, carb, fat, calories } = req.body;
    const food = await Food.findById(req.params.id);
    if (!food) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy thực phẩm" });
    }

    if (label) food.label = label;
    if (protein !== undefined) food.protein = protein;
    if (carb !== undefined) food.carb = carb;
    if (fat !== undefined) food.fat = fat;
    if (calories !== undefined) food.calories = calories;
    await food.save();
    res.json({ success: true, data: food });
  } catch (err) {
    console.error("UPDATE FOOD ERROR:", err);
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
    res.json({ success: true, message: "Xóa thực phẩm thành công" });
  } catch (err) {
    console.error("DELETE FOOD ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
