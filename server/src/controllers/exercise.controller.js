import Exercise from "../models/Exercise.js";

// Lấy tất cả bài tập (có phân trang, tìm kiếm)
export const getExercises = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    let query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const total = await Exercise.countDocuments(query);
    const exercises = await Exercise.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: exercises,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy một bài tập theo ID
export const getExerciseById = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }
    res.json({ success: true, data: exercise });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Tạo bài tập mới (chỉ admin)
export const createExercise = async (req, res) => {
  try {
    const { name, muscleGroup, description, videoUrl, imageUrl } = req.body;
    if (!name || !muscleGroup) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu tên hoặc nhóm cơ" });
    }
    const existing = await Exercise.findOne({ name });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Bài tập đã tồn tại" });
    }
    const exercise = await Exercise.create({
      name,
      muscleGroup,
      description,
      videoUrl,
      imageUrl,
    });
    res.status(201).json({ success: true, data: exercise });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Tạo nhiều bài tập mới (chỉ admin)
export const createManyExercises = async (req, res) => {
  try {
    const exercises = req.body.exercises;
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Dữ liệu không hợp lệ" });
    }
    const results = { success: [], failed: [] };
    for (const item of exercises) {
      try {
        const { name, muscleGroup, description, videoUrl, imageUrl } = item;
        if (!name || !muscleGroup) {
          results.failed.push({ ...item, error: "Thiếu tên hoặc nhóm cơ" });
          continue;
        }
        const existing = await Exercise.findOne({ name });
        if (existing) {
          results.failed.push({ ...item, error: "Tên bài tập đã tồn tại" });
          continue;
        }
        const newExercise = await Exercise.create({
          name,
          muscleGroup,
          description,
          videoUrl,
          imageUrl,
        });
        results.success.push(newExercise);
      } catch (err) {
        results.failed.push({ ...item, error: err.message });
      }
    }
    res.status(201).json({
      success: true,
      data: results,
      message: `Thêm thành công ${results.success.length} / ${exercises.length} bài tập`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Cập nhật bài tập (chỉ admin)
export const updateExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!exercise) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }
    res.json({ success: true, data: exercise });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Xóa bài tập (chỉ admin)
export const deleteExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndDelete(req.params.id);
    if (!exercise) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }
    res.json({ success: true, message: "Xóa thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
