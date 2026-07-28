export const F1_CUSTOMER_STATUS_LABELS = Object.freeze({
  new: "Mới tạo",
  intake_in_progress: "Đang khảo sát",
  intake_completed: "Đã khảo sát",
  assessment_completed: "Đã đánh giá thể chất",
  ai_report_generated: "Đã có AI report",
  program_started: "Đã bắt đầu lộ trình",
  archived: "Đã lưu trữ",
});

const STATUS_RANK = Object.freeze({
  new: 0,
  intake_in_progress: 0,
  intake_completed: 1,
  assessment_completed: 2,
  ai_report_generated: 3,
  program_started: 4,
});

export const getF1Progress = (status) => {
  const rank = STATUS_RANK[status] ?? 0;
  return {
    intakeDone: rank >= 1,
    assessmentDone: rank >= 2,
    reportDone: rank >= 3,
  };
};
