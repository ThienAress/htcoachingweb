export const JOINT_SAFETY_SOURCE = Object.freeze({
  title: "AAOS — Không tập xuyên đau; trao đổi với bác sĩ hoặc chuyên viên vật lý trị liệu",
  uri: "https://orthoinfo.aaos.org/globalassets/pdfs/2023-rehab_knee.pdf",
});

export const buildJointDiscomfortResponse = (question, decision) => {
  if (decision?.risk !== "high_stakes" || decision.urgency) return null;
  const normalized = String(question || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/giu, "d").toLowerCase();
  if (!/\b(?:dau goi|khop goi|knee)\b/.test(normalized) ||
      !/\b(?:kho chiu|dau|nhuc|pain|discomfort|ache)\b/.test(normalized) ||
      !/\b(?:squat|tap chan|leg training|bai tap)\b/.test(normalized)) return null;
  return [
    "Nếu squat làm đầu gối khó chịu, hãy dừng động tác đó; đừng cố tập xuyên đau. Mình không thể xác định nguyên nhân hay chọn bài điều trị qua chat.",
    "Bạn có thể giảm tải hoặc biên độ rồi chỉ thử lại khi hoàn toàn không gây đau. Nếu vẫn khó chịu, bỏ bài đó trong buổi này và nhờ người có chuyên môn đánh giá trước khi chọn bài thay thế.",
    "Để vẫn vận động, chỉ giữ những hoạt động quen thuộc không gây triệu chứng trong lúc tập hoặc sau buổi tập, hoặc chuyển sang tập thân trên. Không có bài chân nào được bảo đảm không tạo áp lực lên gối.",
    "Nếu có sưng, kẹt khớp, hụt gối, khó chịu kéo dài/tái diễn, hãy được bác sĩ hoặc chuyên viên vật lý trị liệu đánh giá. Sau chấn thương mà đau nhiều hoặc không chịu lực được, cần khám sớm.",
    "Bạn khó chịu ở vị trí nào, bắt đầu từ khi nào và có sưng hoặc chấn thương gần đây không? Đây là hướng dẫn tham khảo để tránh làm tình trạng nặng hơn, không phải chẩn đoán.",
    `Nguyên tắc không tập xuyên đau được nêu trong [hướng dẫn AAOS](${JOINT_SAFETY_SOURCE.uri}); tài liệu này không xác nhận bài thay thế nào phù hợp riêng với bạn.`,
  ].join("\n\n");
};
