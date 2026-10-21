// Tính phần gói tháng chưa dùng khi nâng cấp lên gói năm (dùng chung cho HT Fitness+ và gói HLV).
// Server là nguồn sự thật duy nhất của số tiền: client chỉ gửi expectedAmount để xác nhận, không bao giờ quyết định số trừ ví.

const DAY_MS = 24 * 60 * 60 * 1000;
// Làm tròn xuống 100 đồng để số tiền hiển thị gọn.
const CREDIT_ROUNDING_VND = 100;

const ZERO_CREDIT = Object.freeze({ creditAmount: 0, remainingDays: 0, periodDays: 0 });

// Tín dụng = số tiền đã trả cho kỳ hiện tại x (số ngày còn lại / số ngày của kỳ). Ngày còn dở được tính là một ngày.
export const computeUnusedPeriodCredit = ({ paidAmount, startDate, endDate, now = new Date() }) => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const paid = Number(paidAmount);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return ZERO_CREDIT;
  if (!Number.isFinite(paid) || paid <= 0) return ZERO_CREDIT;

  const periodDays = Math.max(1, Math.round((end - start) / DAY_MS));
  const remainingDays = Math.min(periodDays, Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS)));
  const raw = (paid * remainingDays) / periodDays;
  return {
    creditAmount: Math.floor(raw / CREDIT_ROUNDING_VND) * CREDIT_ROUNDING_VND,
    remainingDays,
    periodDays,
  };
};

// Số tiền phải trả sau khi trừ tín dụng; luôn dương và không vượt giá niêm yết.
export const applyUpgradeCredit = (listAmount, creditAmount) =>
  Math.max(Math.min(listAmount, listAmount - creditAmount), 1);

export const isMonthToYearUpgrade = (active, billingCycle) =>
  active?.billingCycle === "month" && billingCycle === "year";
