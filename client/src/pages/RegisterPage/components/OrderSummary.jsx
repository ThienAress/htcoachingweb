import { Gift, Tag, Calendar, MapPin, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

function OrderSummary({
  planMode,
  selectedPackage,
  isLoggedIn,
  hasExistingBooking,
  discountCode,
  gifts,
  onCopyCode,
}) {
  const { t } = useTranslation("auth");

  const getPlanDisplay = () => {
    const modeText =
      planMode === "trial"
        ? t("order.trial")
        : planMode === "1-1"
          ? t("order.one_on_one")
          : t("order.online");
    return `${modeText} - ${selectedPackage.title}`;
  };

  return (
    <div className="lg:w-96">
      <div className="sticky top-8 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-white/30">
        <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-4">
          <h3 className="text-white text-xl font-bold flex items-center gap-2">
            {t("order.title")}
          </h3>
        </div>

        <div className="p-6 space-y-5">
          <div className="border-b border-gray-100 pb-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Sparkles size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {t("order.package_selected")}
                </p>
                <p className="font-bold text-gray-800 text-lg">
                  {getPlanDisplay()}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedPackage.durationText} ·{" "}
                  {t("order.sessions", { count: selectedPackage.totalSessions })}
                </p>
              </div>
            </div>
          </div>

          {isLoggedIn && !hasExistingBooking && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-green-500 rounded-full p-1.5">
                  <Tag size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-green-700">
                    {t("order.first_time_discount")}
                  </p>
                  <p className="text-xs text-green-600">
                    {t("order.logged_in_apply")}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-2 flex items-center justify-between border border-green-200">
                <span className="text-xs text-gray-500">
                  {t("order.your_code")}
                </span>
                <span className="font-mono font-bold text-green-700 tracking-wider">
                  {discountCode}
                </span>
                <button
                  onClick={() => onCopyCode(discountCode)}
                  className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded transition"
                >
                  {t("order.copy")}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {t("order.discount_note")}
              </p>
            </div>
          )}

          {isLoggedIn && hasExistingBooking && (
            <div className="bg-gray-100 rounded-xl p-4 border border-gray-300 text-center">
              <p className="text-gray-600 text-sm">
                {t("order.existing_discount")}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {t("order.existing_discount_desc")}
              </p>
            </div>
          )}

          {gifts.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <Gift size={18} className="text-amber-600" />
                <span className="font-semibold text-amber-800">
                  {t("order.gifts")}
                </span>
              </div>
              <ul className="space-y-1.5">
                {gifts.map((gift, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-amber-800"
                  >
                    <span className="text-amber-500">•</span>
                    <span>{gift}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{t("order.contact_24h")}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <span>{t("order.support_branches")}</span>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-gray-400">
              {t("order.secure_info")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderSummary;
