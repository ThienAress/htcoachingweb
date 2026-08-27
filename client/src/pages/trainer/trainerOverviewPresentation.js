const ATTENTION = {
  missed_weekly_checkin: {
    label: "Thiếu báo cáo tuần trước",
    detail: "Nhắc học viên gửi báo cáo khi phù hợp",
  },
  weekly_checkin_missing: {
    label: "Thiếu báo cáo tuần trước",
    detail: "Nhắc học viên gửi báo cáo khi phù hợp",
  },
  stress_high: {
    label: "Căng thẳng ở mức cao",
    detail: "Xem nhật ký được chia sẻ",
  },
  soreness_high: {
    label: "Đau mỏi ở mức cao",
    detail: "Xem nhật ký được chia sẻ",
  },
  pain_high: {
    label: "Mức đau cần được chú ý",
    detail: "Xem nhật ký được chia sẻ",
  },
  pain_reported: {
    label: "Có cảnh báo đau cần xem",
    detail: "Xem nhật ký được chia sẻ",
  },
  pain_flag: {
    label: "Có cảnh báo đau cần xem",
    detail: "Xem nhật ký được chia sẻ",
  },
  pending_feedback: {
    label: "Có buổi huấn luyện chờ phản hồi",
    detail: "Kiểm tra tiến độ bài tập",
  },
  weekly_review_pending: {
    label: "Có báo cáo tuần chờ nhận xét",
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
