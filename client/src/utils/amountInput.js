// Ô nhập số tiền: giữ giá trị gốc là chuỗi chữ số, chỉ hiển thị có dấu phân cách hàng nghìn (10.000.000 thay vì 10000000).
const MAX_DIGITS = 13;

export const normalizeAmountDigits = (raw) => {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, MAX_DIGITS);
  return digits === "" ? "" : String(Number(digits));
};

export const formatAmountInput = (digits, language = "vi") => {
  const normalized = normalizeAmountDigits(digits);
  if (normalized === "") return "";
  const locale = String(language || "vi").startsWith("vi") ? "vi-VN" : "en-US";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(normalized));
};

export const countDigits = (text) => String(text ?? "").replace(/\D/g, "").length;

// Vị trí con trỏ ngay sau chữ số thứ `digitCount` của chuỗi đã định dạng.
export const caretPositionForDigitCount = (formatted, digitCount) => {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) {
      seen += 1;
      if (seen === digitCount) return index + 1;
    }
  }
  return formatted.length;
};

// Xử lý một lần gõ vào ô số tiền đã định dạng. Nếu người dùng chỉ xóa dấu phân cách (số chữ số không đổi),
// xóa chữ số liền kề thay vào đó để phím Backspace/Delete không "đứng yên" ở dấu chấm.
export const resolveAmountEdit = ({ value, selectionStart, previousDigits = "", inputType = "" }) => {
  const text = String(value ?? "");
  let digits = text.replace(/\D/g, "");
  let caretDigits = countDigits(text.slice(0, selectionStart ?? text.length));

  if (inputType.startsWith("deleteContent") && digits.length === previousDigits.length) {
    const cut = inputType === "deleteContentBackward" ? caretDigits - 1 : caretDigits;
    if (cut >= 0 && cut < digits.length) {
      digits = digits.slice(0, cut) + digits.slice(cut + 1);
      caretDigits = cut;
    }
  }

  const normalized = normalizeAmountDigits(digits);
  return { digits: normalized, caretDigits: Math.min(caretDigits, normalized.length) };
};
