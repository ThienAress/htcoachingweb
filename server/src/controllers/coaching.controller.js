import CoachingDay from "../models/CoachingDay.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

// ================= KHÁCH HÀNG (CLIENT) =================

// 1. Lấy danh sách ngày tập của tôi (để dựng sidebar gập/mở tuần)
export const getMyPlans = async (req, res) => {
  try {
    const plans = await CoachingDay.find({ userId: req.user.id })
      .populate("trainerId", "name email avatar")
      .sort({ date: -1 });

    res.json({
      success: true,
      data: plans,
    });
  } catch (err) {
    console.error("GET MY PLANS ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách bài tập" });
  }
};

// 2. Lấy chi tiết bài tập của một ngày cụ thể (dateString)
export const getMyPlanDetails = async (req, res) => {
  try {
    const { dateString } = req.params;
    const plan = await CoachingDay.findOne({
      userId: req.user.id,
      dateString,
    }).populate("trainerId", "name email avatar");

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giáo án tập luyện cho ngày này",
      });
    }

    res.json({
      success: true,
      data: plan,
    });
  } catch (err) {
    console.error("GET PLAN DETAILS ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi lấy chi tiết bài tập" });
  }
};

// 3. Khách tích chọn hoàn thành bài & gửi feedback kèm video ngắn
export const submitFeedback = async (req, res) => {
  try {
    const { dateString } = req.params;
    const { clientFeedbackText } = req.body;

    let exercises = req.body.exercises;
    if (typeof exercises === "string") {
      try {
        exercises = JSON.parse(exercises);
      } catch (e) {
        console.error("Error parsing exercises JSON:", e);
      }
    }

    const plan = await CoachingDay.findOne({
      userId: req.user.id,
      dateString,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giáo án để cập nhật phản hồi",
      });
    }

    // Cập nhật các trường
    if (exercises && Array.isArray(exercises)) {
      plan.exercises = exercises;
    }
    if (clientFeedbackText !== undefined) {
      plan.clientFeedbackText = clientFeedbackText;
    }

    // Nếu có file video tải lên
    if (req.file) {
      plan.clientFeedbackVideo = req.file.path;
    }

    // Tự động kiểm tra trạng thái hoàn thành ngày tập
    // Nếu tất cả bài tập trong checklist đều có completed = true thì đánh dấu completed
    const allCompleted = plan.exercises.length > 0 && plan.exercises.every((ex) => ex.completed);
    plan.clientStatus = allCompleted ? "completed" : "pending";

    await plan.save();

    res.json({
      success: true,
      data: plan,
      message: "Cập nhật tiến trình tập luyện thành công",
    });
  } catch (err) {
    console.error("SUBMIT FEEDBACK ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi gửi phản hồi tập luyện" });
  }
};

// ================= HUẤN LUYỆN VIÊN (TRAINER) =================

// 4. Lấy danh sách khách hàng được gán cho Trainer (từ các Orders approved)
export const getTrainerClients = async (req, res) => {
  try {
    let query = { status: "approved" };
    
    // Nếu không phải admin thì trainer chỉ lấy khách của họ
    if (req.user.role !== "admin") {
      query.trainerId = req.user.id;
    }

    // Lấy orders approved, populate user
    const orders = await Order.find(query)
      .populate("userId", "name email avatar phone")
      .sort({ updatedAt: -1 });

    // Lọc ra danh sách khách hàng duy nhất
    const clientsMap = {};
    orders.forEach((o) => {
      if (o.userId && o.userId._id) {
        const client = o.userId;
        if (!clientsMap[client._id]) {
          clientsMap[client._id] = {
            _id: client._id,
            name: client.name,
            email: client.email,
            avatar: client.avatar,
            phone: client.phone,
            package: o.package,
            orderId: o._id,
          };
        }
      }
    });

    const uniqueClients = Object.values(clientsMap);

    res.json({
      success: true,
      data: uniqueClients,
    });
  } catch (err) {
    console.error("GET TRAINER CLIENTS ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách khách hàng" });
  }
};

// 5. Xem lịch sử giáo án của một khách hàng cụ thể
export const getClientTimeline = async (req, res) => {
  try {
    const { userId } = req.params;

    // Trainer kiểm tra xem có quyền quản lý khách này không (hoặc là admin)
    if (req.user.role !== "admin") {
      const hasOrder = await Order.findOne({
        userId,
        trainerId: req.user.id,
        status: "approved",
      });
      if (!hasOrder) {
        return res.status(403).json({ success: false, message: "Bạn không quản lý khách hàng này" });
      }
    }

    const history = await CoachingDay.find({ userId })
      .populate("trainerId", "name email")
      .sort({ date: -1 });

    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    console.error("GET CLIENT TIMELINE ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi lấy lịch sử bài tập của khách" });
  }
};

// 6. Huấn luyện viên tạo mới hoặc cập nhật giáo án (Upsert)
export const upsertCoachingDay = async (req, res) => {
  try {
    const { userId } = req.params;
    const { dateString, title, videoUrl, note, exercises } = req.body;

    if (!dateString || !title) {
      return res.status(400).json({ success: false, message: "Vui lòng điền ngày và tiêu đề giáo án" });
    }

    // Kiểm tra quyền quản lý
    if (req.user.role !== "admin") {
      const hasOrder = await Order.findOne({
        userId,
        trainerId: req.user.id,
        status: "approved",
      });
      if (!hasOrder) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền gán bài tập cho khách hàng này" });
      }
    }

    const date = new Date(`${dateString}T00:00:00.000Z`);

    // Thực hiện upsert giáo án
    const plan = await CoachingDay.findOneAndUpdate(
      { userId, dateString },
      {
        userId,
        trainerId: req.user.id,
        dateString,
        date,
        title,
        videoUrl: videoUrl || "",
        note: note || "",
        exercises: exercises || [],
      },
      { returnDocument: 'after', upsert: true }
    );

    res.json({
      success: true,
      data: plan,
      message: "Lưu giáo án thành công",
    });
  } catch (err) {
    console.error("UPSERT COACHING DAY ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi lưu giáo án luyện tập" });
  }
};

// 7. Xoá giáo án của một ngày tập cụ thể
export const deleteCoachingDay = async (req, res) => {
  try {
    const { userId, dateString } = req.params;

    // Kiểm tra quyền
    if (req.user.role !== "admin") {
      const hasOrder = await Order.findOne({
        userId,
        trainerId: req.user.id,
        status: "approved",
      });
      if (!hasOrder) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền chỉnh sửa khách hàng này" });
      }
    }

    const deleted = await CoachingDay.findOneAndDelete({ userId, dateString });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo án tập để xóa" });
    }

    res.json({
      success: true,
      message: "Đã xóa giáo án thành công",
    });
  } catch (err) {
    console.error("DELETE COACHING DAY ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi xóa giáo án tập luyện" });
  }
};

// 8. Tải lên video demo bài tập của Trainer
export const uploadCoachingDemoVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Không tìm thấy file tải lên" });
    }
    res.json({
      success: true,
      url: req.file.path,
      message: "Tải lên video demo thành công",
    });
  } catch (err) {
    console.error("UPLOAD DEMO ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi tải lên video demo" });
  }
};

// 9. Tải lên video phản hồi kỹ thuật bài tập của Client
export const uploadClientFeedbackVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Không tìm thấy file tải lên" });
    }
    res.json({
      success: true,
      url: req.file.path,
      message: "Tải lên video phản hồi thành công",
    });
  } catch (err) {
    console.error("UPLOAD CLIENT FEEDBACK VIDEO ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi tải lên video phản hồi" });
  }
};
