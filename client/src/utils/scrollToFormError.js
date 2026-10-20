// Khi gửi form bị từ chối vì dữ liệu chưa hợp lệ: cuộn tới ô báo lỗi đầu tiên và đưa focus vào ô đó,
// để người dùng thấy ngay chỗ cần sửa (kể cả khi ô nằm khuất trong hộp thoại dài hoặc là nhóm lựa chọn).
export const FORM_ERROR_ATTR = "data-form-error";

export const scrollToFirstFormError = (formElement) => {
  const marker = formElement?.querySelector?.(`[${FORM_ERROR_ATTR}]`);
  if (!marker) return false;
  marker.scrollIntoView?.({ behavior: "smooth", block: "center" });
  // Ô lỗi đầu tiên: ưu tiên ô nhập/chọn nằm cùng nhóm; không có thì focus chính dòng báo lỗi.
  const container = marker.closest("label, [role=radiogroup], [data-form-field]") || marker.parentElement;
  const control = container?.querySelector?.("input:not([readonly]), select, textarea, button");
  const target = control || marker;
  if (!target.hasAttribute?.("tabindex") && !control) target.setAttribute?.("tabindex", "-1");
  target.focus?.({ preventScroll: true });
  return true;
};
