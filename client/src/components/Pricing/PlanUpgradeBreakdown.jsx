import { useTranslation } from "react-i18next";

const formatMoney = (value, language) =>
  new Intl.NumberFormat(String(language || "vi").startsWith("vi") ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

// Chi tiết thanh toán dùng chung cho HT Fitness+ và gói HLV: giá gói, phần gói tháng chưa dùng được trừ, tổng cộng.
// quote do server tính (/quotes); component không tự tính tiền.
const PlanUpgradeBreakdown = ({ quote, loading = false, error = false, onRetry, fallbackAmount = 0 }) => {
  const { t, i18n } = useTranslation("home");

  if (loading) {
    return (
      <div className="rounded-xl bg-[#222] p-4 text-sm text-gray-400" role="status">
        {t("pricing.upgrade.loading")}
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center" role="alert">
        <p className="text-sm text-red-400">{t("pricing.upgrade.failed")}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            {t("pricing.upgrade.retry")}
          </button>
        )}
      </div>
    );
  }

  const listAmount = quote?.listAmount ?? fallbackAmount;
  const credit = quote?.creditAmount || 0;
  const total = quote?.amount ?? fallbackAmount;
  return (
    <div className="space-y-3 rounded-xl bg-[#222] p-4">
      <div className="flex justify-between gap-4 text-sm">
        <span className="text-gray-400">{t("pricing.upgrade.plan_price")}</span>
        <span className="font-medium text-white">{formatMoney(listAmount, i18n.language)}</span>
      </div>
      {credit > 0 && (
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-gray-400">{t("pricing.upgrade.credit", { days: quote.remainingDays })}</span>
          <span className="font-medium text-green-400">-{formatMoney(credit, i18n.language)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-gray-700 pt-3">
        <span className="font-bold text-white">{t("pricing.upgrade.total")}</span>
        <span className="text-2xl font-bold text-primary">{formatMoney(total, i18n.language)}</span>
      </div>
    </div>
  );
};

export default PlanUpgradeBreakdown;
