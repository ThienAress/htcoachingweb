import ExerciseSuggestion from "../models/ExerciseSuggestion.js";

// Gửi góp ý (public, có thể có user)
export const createSuggestion = async (req, res) => {
  try {
    const { name, muscleGroup, description } = req.body;
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Tên bài tập không được để trống" });
    }
    const suggestion = await ExerciseSuggestion.create({
      name,
      muscleGroup: muscleGroup || "",
      description: description || "",
      suggestedBy: req.user?.id || null,
    });
    res.status(201).json({
      success: true,
      data: suggestion,
      message: "Cảm ơn bạn đã góp ý!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy danh sách góp ý (admin)
export const getSuggestions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search || "";

    let filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const total = await ExerciseSuggestion.countDocuments(filter);
    const suggestions = await ExerciseSuggestion.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("suggestedBy", "name email");

    res.json({
      success: true,
      data: suggestions,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Cập nhật trạng thái (admin)
export const updateSuggestionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;
    const suggestion = await ExerciseSuggestion.findByIdAndUpdate(
      id,
      { status, adminNote },
      { new: true },
    );
    if (!suggestion)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy" });
    res.json({ success: true, data: suggestion });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Xóa góp ý (admin)
export const deleteSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    const suggestion = await ExerciseSuggestion.findByIdAndDelete(id);
    if (!suggestion)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy" });
    res.json({ success: true, message: "Xóa thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
