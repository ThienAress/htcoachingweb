const ATTENTION = {
  missed_weekly_checkin: {
    label: "Thiếu Weekly Check-in tuần trước",
    detail: "Nhắc học viên check-in khi phù hợp",
  },
  weekly_checkin_missing: {
    label: "Thiếu Weekly Check-in tuần trước",
    detail: "Nhắc học viên check-in khi phù hợp",
  },
  pain_reported: {
    label: "Có pain flag cần xem",
    detail: "Xem nhật ký được chia sẻ",
  },
  pain_flag: {
    label: "Có pain flag cần xem",
    detail: "Xem nhật ký được chia sẻ",
  },
  pending_feedback: {
    label: "Có buổi coaching chờ phản hồi",
    detail: "Kiểm tra tiến độ bài tập",
  },
  weekly_review_pending: {
    label: "Có buổi coaching chờ phản hồi",
    detail: "Kiểm tra tiến độ bài tập",
  },
};

export const attentionRows = (items = []) =>
  items.map((item) => ({
    ...item,
    label: ATTENTION[item.code]?.label || item.code,
    detail: ATTENTION[item.code]?.detail || "Cần kiểm tra",
  }));

const TODAY_STATUS = {
  completed: "Đã hoàn thành",
  in_progress: "Đang thực hiện",
  not_started: "Chưa bắt đầu",
  rest_day: "Ngày nghỉ",
  unavailable: "Chưa có dữ liệu",
};

export const todayStatusLabel = (status) =>
  TODAY_STATUS[status] || "Chưa xác định";
