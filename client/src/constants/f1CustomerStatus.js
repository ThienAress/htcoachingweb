export const F1_CUSTOMER_STATUS_LABELS = Object.freeze({
  new: "Mới tạo",
  intake_in_progress: "Đang khảo sát",
  intake_completed: "Đã khảo sát",
  assessment_completed: "Đã đánh giá thể chất",
  ai_report_generated: "Đã có phân tích tự động",
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

export const F1_SOFT_DELETE_DAYS = 7;

// Cột "Trạng thái" của danh sách: "Đã hoàn thành" khi xong cả dự đoán, còn lại ghi bước đang chờ.
export const getF1CustomerStageLabel = (customer) => {
  if (customer?.status === "archived") return F1_CUSTOMER_STATUS_LABELS.archived;
  if (customer?.testPermission === "hold_test" || customer?.readinessStatus === "hold") {
    return "Tạm hoãn";
  }
  const { intakeDone, assessmentDone, reportDone } = getF1Progress(customer?.status);
  if (!intakeDone) return "Khảo sát";
  if (!assessmentDone) return "Đánh giá thể chất";
  if (!reportDone) return "Phân tích tự động";
  if (!customer?.lastResultPredictionId) return "Dự đoán";
  return "Đã hoàn thành";
};

export const getRemainingDeleteDays = (purgeAt, now = Date.now()) => {
  const diff = new Date(purgeAt).getTime() - now;
  return Number.isFinite(diff) ? Math.max(Math.ceil(diff / 86_400_000), 0) : 0;
};
