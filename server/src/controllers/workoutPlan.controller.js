import WorkoutPlan from "../models/WorkoutPlan.js";
import User from "../models/User.js";

// Default sections template
const DEFAULT_SECTIONS = [
  { name: "WARM UP", icon: "🔥", sortOrder: 0, exercises: [] },
  { name: "STRENGTH PREPARATION", icon: "🏋️", sortOrder: 1, exercises: [] },
  { name: "ISOLATION TRAINING", icon: "🍑", sortOrder: 2, exercises: [] },
  { name: "COOLDOWN / STRETCHING", icon: "🧘", sortOrder: 3, exercises: [] },
];

// ===== GET /api/workout-plans — Danh sách plans =====
export const getWorkoutPlans = async (req, res) => {
  try {
    const trainerId = req.isAdmin ? undefined : req.user.id;
    const { clientEmail, startDate, endDate, status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (trainerId) query.trainerId = trainerId;
    if (clientEmail) query.clientEmail = clientEmail.toLowerCase().trim();
    if (status) query.status = status;
    if (startDate || endDate) {
      query.planDate = {};
      if (startDate) query.planDate.$gte = new Date(startDate);
      if (endDate) query.planDate.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await WorkoutPlan.countDocuments(query);

    const plans = await WorkoutPlan.find(query)
      .populate("clientId", "name email avatar")
      .sort({ planDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      data: plans,
      pagination: {
        total,
        totalPages: Math.ceil(total / Number(limit)),
        currentPage: Number(page),
      },
    });
  } catch (err) {
    console.error("getWorkoutPlans error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// ===== GET /api/workout-plans/my — Khách hàng xem giáo án =====
export const getMyWorkoutPlans = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("email").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy user" });
    }

    const plans = await WorkoutPlan.find({
      clientEmail: user.email,
      status: { $in: ["published", "completed"] },
    })
      .populate("trainerId", "name avatar")
      .sort({ planDate: -1 })
      .lean();

    return res.json({ success: true, data: plans });
  } catch (err) {
    console.error("getMyWorkoutPlans error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// ===== GET /api/workout-plans/:id — Chi tiết 1 plan =====
export const getWorkoutPlanById = async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id)
      .populate("clientId", "name email avatar")
      .populate("trainerId", "name avatar")
      .lean();

    if (!plan) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo án" });
    }

    // Check quyền: trainer sở hữu hoặc admin hoặc client
    const isAdmin = req.user.role === "admin";
    if (!isAdmin && plan.trainerId._id.toString() !== req.user.id.toString()) {
      // Cho phép client xem plan của mình
      const user = await User.findById(req.user.id).select("email").lean();
      if (!user || user.email !== plan.clientEmail) {
        return res.status(403).json({ success: false, message: "Không có quyền truy cập" });
      }
    }

    return res.json({ success: true, data: plan });
  } catch (err) {
    console.error("getWorkoutPlanById error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// ===== POST /api/workout-plans — Tạo plan mới =====
export const createWorkoutPlan = async (req, res) => {
  try {
    const trainerId = req.user.id;
    const { title, planDate, clientName, clientEmail, sections, trainerNote } = req.body;

    if (!title || !planDate || !clientName) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tiêu đề, ngày tập hoặc tên khách hàng",
      });
    }

    // Tìm clientId từ email
    let clientId = null;
    if (clientEmail) {
      const client = await User.findOne({ email: clientEmail.toLowerCase().trim() });
      if (client) clientId = client._id;
    }

    const plan = await WorkoutPlan.create({
      trainerId,
      clientId,
      clientName: clientName.trim(),
      clientEmail: clientEmail ? clientEmail.toLowerCase().trim() : "",
      title: title.trim(),
      planDate: new Date(planDate),
      sections: sections && sections.length > 0 ? sections : DEFAULT_SECTIONS,
      trainerNote: trainerNote || "",
      status: "draft",
    });

    return res.status(201).json({
      success: true,
      data: plan,
      message: "Tạo giáo án thành công",
    });
  } catch (err) {
    console.error("createWorkoutPlan error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// ===== PUT /api/workout-plans/:id — Cập nhật plan =====
export const updateWorkoutPlan = async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo án" });
    }

    // Check quyền
    if (!req.isAdmin && plan.trainerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: "Không có quyền chỉnh sửa" });
    }

    const allowed = ["title", "planDate", "clientName", "clientEmail", "sections", "trainerNote", "status", "overallAssessment"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === "clientEmail") {
          plan[key] = req.body[key].toLowerCase().trim();
          // Cập nhật clientId
          const client = await User.findOne({ email: plan.clientEmail });
          plan.clientId = client ? client._id : null;
        } else if (key === "planDate") {
          plan[key] = new Date(req.body[key]);
        } else {
          plan[key] = req.body[key];
        }
      }
    }

    await plan.save();

    return res.json({
      success: true,
      data: plan,
      message: "Cập nhật giáo án thành công",
    });
  } catch (err) {
    console.error("updateWorkoutPlan error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// ===== DELETE /api/workout-plans/:id — Xóa plan =====
export const deleteWorkoutPlan = async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo án" });
    }

    if (!req.isAdmin && plan.trainerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: "Không có quyền xóa" });
    }

    await plan.deleteOne();

    return res.json({ success: true, message: "Đã xóa giáo án" });
  } catch (err) {
    console.error("deleteWorkoutPlan error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// ===== POST /api/workout-plans/:id/duplicate — Nhân bản plan =====
export const duplicateWorkoutPlan = async (req, res) => {
  try {
    const original = await WorkoutPlan.findById(req.params.id).lean();
    if (!original) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo án gốc" });
    }

    if (!req.isAdmin && original.trainerId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ success: false, message: "Không có quyền nhân bản" });
    }

    // Reset assessment cho tất cả exercises
    const resetSections = original.sections.map((section) => ({
      ...section,
      _id: undefined,
      exercises: section.exercises.map((ex) => ({
        ...ex,
        assessment: "",
        maxWeight: "",
      })),
    }));

    const newPlan = await WorkoutPlan.create({
      trainerId: original.trainerId,
      clientId: original.clientId,
      clientName: original.clientName,
      clientEmail: original.clientEmail,
      title: `${original.title} (Bản sao)`,
      planDate: req.body.planDate ? new Date(req.body.planDate) : new Date(),
      sections: resetSections,
      trainerNote: original.trainerNote,
      status: "draft",
      overallAssessment: "",
    });

    return res.status(201).json({
      success: true,
      data: newPlan,
      message: "Nhân bản giáo án thành công",
    });
  } catch (err) {
    console.error("duplicateWorkoutPlan error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};
