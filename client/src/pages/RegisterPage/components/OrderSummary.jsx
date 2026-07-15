import { Gift, Tag, Calendar, MapPin, Sparkles } from "lucide-react";

function OrderSummary({
  planMode,
  selectedPackage,
  isLoggedIn,
  hasExistingBooking,
  discountCode,
  gifts,
  onCopyCode,
}) {
  const getPlanDisplay = () => {
    const modeText =
      planMode === "trial"
        ? "Trải nghiệm"
        : planMode === "1-1"
          ? "1 Kèm 1"
          : "Online";
    return `${modeText} - ${selectedPackage.title}`;
  };

  return (
    <div className="lg:w-96">
      <div className="sticky top-8 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-white/30">
        <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-4">
          <h3 className="text-white text-xl font-bold flex items-center gap-2">
            ĐƠN HÀNG CỦA BẠN
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
                  Gói đã chọn
                </p>
                <p className="font-bold text-gray-800 text-lg">
                  {getPlanDisplay()}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedPackage.durationText} ·{" "}
                  {selectedPackage.totalSessions} buổi
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
                    🎉 Giảm 15% cho lần đầu
                  </p>
                  <p className="text-xs text-green-600">
                    Áp dụng khi đăng nhập
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-2 flex items-center justify-between border border-green-200">
                <span className="text-xs text-gray-500">
                  Mã ưu đãi của bạn:
                </span>
                <span className="font-mono font-bold text-green-700 tracking-wider">
                  {discountCode}
                </span>
                <button
                  onClick={() => onCopyCode(discountCode)}
                  className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded transition"
                >
                  Sao chép
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * Xuất trình mã này khi liên hệ để được giảm giá
              </p>
            </div>
          )}

          {isLoggedIn && hasExistingBooking && (
            <div className="bg-gray-100 rounded-xl p-4 border border-gray-300 text-center">
              <p className="text-gray-600 text-sm">
                ⚠️ Tài khoản của bạn đã sử dụng ưu đãi 15% cho lần đăng
                ký trước.
              </p>
              <p className="text-gray-500 text-xs mt-1">
                Mỗi tài khoản chỉ áp dụng giảm giá 15% một lần duy nhất.
              </p>
            </div>
          )}

          {gifts.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <Gift size={18} className="text-amber-600" />
                <span className="font-semibold text-amber-800">
                  Quà tặng kèm theo
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
              <span>Chúng tôi sẽ liên hệ trong 24h</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <span>Hỗ trợ tập tại tất cả các chi nhánh</span>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-gray-400">
              * Thông tin của bạn được bảo mật tuyệt đối
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderSummary;
