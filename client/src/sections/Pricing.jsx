import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Gift, Sparkles, LogIn, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState("1-1");
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [selectedGifts, setSelectedGifts] = useState([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);

  // Gói ONLINE
  const onlinePlans = [
    {
      title: "Cơ bản",
      durationText: "8 tuần",
      features: [
        "Tập 1 kèm 1",
        "Giáo án cá nhân hóa",
        "Tư vấn dinh dưỡng riêng",
        "Theo dõi tiến độ theo tuần",
        "Sử dụng Notion để lưu trữ bài tập, tiến độ một cách thông minh",
        "Hỗ trợ căng cơ phục hồi sau tập",
        "Cam kết kết quả 100%",
      ],
      gifts: [],
      totalSessions: 24,
    },
    {
      title: "Nâng cao",
      durationText: "16 tuần",
      features: [
        "Tập 1 kèm 1",
        "Giáo án cá nhân hóa",
        "Tư vấn dinh dưỡng riêng",
        "Theo dõi tiến độ theo tuần",
        "Sử dụng Notion để lưu trữ bài tập, tiến độ một cách thông minh",
        "Hỗ trợ căng cơ phục hồi sau tập",
        "Cam kết kết quả 100%",
      ],
      gifts: [],
      featured: true,
      totalSessions: 48,
    },
    {
      title: "VIP",
      durationText: "24 tuần",
      features: [
        "Tập 1 kèm 1",
        "Giáo án cá nhân hóa",
        "Tư vấn dinh dưỡng riêng",
        "Theo dõi tiến độ theo tuần",
        "Sử dụng Notion để lưu trữ bài tập, tiến độ một cách thông minh",
        "Hỗ trợ căng cơ phục hồi sau tập",
        "Cam kết kết quả 100%",
      ],
      gifts: [],
      totalSessions: 72,
    },
  ];

  // Gói 1-1
  const oneOnOnePlans = [
    {
      title: "Cơ bản",
      durationText: "8 tuần",
      features: [
        "Tập 1 kèm 1",
        "Giáo án cá nhân hóa",
        "Tư vấn dinh dưỡng riêng",
        "Theo dõi tiến độ theo tuần",
        "Sử dụng Notion để lưu trữ bài tập, tiến độ một cách thông minh",
        "Hỗ trợ căng cơ phục hồi sau tập",
        "Cam kết kết quả 100%",
      ],
      gifts: ["Shaker Bình Lắc Cao Cấp 600ml"],
      totalSessions: 24,
    },
    {
      title: "Nâng cao",
      durationText: "16 tuần",
      features: [
        "Tập 1 kèm 1",
        "Giáo án cá nhân hóa",
        "Tư vấn dinh dưỡng riêng",
        "Theo dõi tiến độ theo tuần",
        "Sử dụng Notion để lưu trữ bài tập, tiến độ một cách thông minh",
        "Hỗ trợ căng cơ phục hồi sau tập",
        "Cam kết kết quả 100%",
      ],
      gifts: ["Shaker Bình Lắc Cao Cấp 600ml", "2 bánh Biscotti 300g"],
      featured: true,
      totalSessions: 48,
    },
    {
      title: "VIP",
      durationText: "24 tuần",
      features: [
        "Tập 1 kèm 1",
        "Giáo án cá nhân hóa",
        "Tư vấn dinh dưỡng riêng",
        "Theo dõi tiến độ theo tuần",
        "Sử dụng Notion để lưu trữ bài tập, tiến độ một cách thông minh",
        "Hỗ trợ căng cơ phục hồi sau tập",
        "Cam kết kết quả 100%",
      ],
      gifts: [
        "Whey Protein Isolate cao cấp",
        "Shaker Bình Lắc Cao Cấp 600ml",
        "2 bánh Biscotti 300g",
      ],
      totalSessions: 72,
    },
  ];

  const trialPlan = {
    title: "Trải nghiệm",
    durationText: "4 tuần",
    features: [
      "Tập 1 kèm 1",
      "Giáo án cá nhân hóa",
      "Tư vấn dinh dưỡng riêng",
      "Theo dõi tiến độ theo tuần",
      "Sử dụng Notion để lưu trữ bài tập, tiến độ một cách thông minh",
      "Hỗ trợ căng cơ phục hồi sau tập",
      "Cam kết kết quả 100%",
    ],
    gifts: [],
    totalSessions: 12,
  };

  const plans = mode === "online" ? onlinePlans : oneOnOnePlans;

  const handleRegister = (plan, planMode) => {
    if (!user) {
      setPendingPlan(plan);
      setPendingMode(planMode);
      setShowLoginPrompt(true);
      return;
    }
    navigate("/register", {
      state: {
        selectedPackage: {
          title: plan.title,
          durationText: plan.durationText,
          totalSessions: plan.totalSessions,
        },
        planMode,
        gifts: plan.gifts || [],
      },
    });
  };

  const handleContinueWithoutLogin = () => {
    setShowLoginPrompt(false);
    navigate("/register", {
      state: {
        selectedPackage: {
          title: pendingPlan.title,
          durationText: pendingPlan.durationText,
          totalSessions: pendingPlan.totalSessions,
        },
        planMode: pendingMode,
        gifts: pendingPlan.gifts || [],
      },
    });
  };

  const handleLoginRedirect = () => {
    setShowLoginPrompt(false);
    navigate("/login", { state: { from: "/pricing" } });
  };

  const showGiftModal = (gifts) => {
    setSelectedGifts(gifts);
    setGiftModalVisible(true);
  };

  return (
    <section className="py-16 bg-[#262626]">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-[2rem] sm:text-[2.5rem] md:text-[3rem] lg:text-[4rem] font-bold text-center text-red-500 uppercase tracking-wide mb-8">
          Gói tập của chúng tôi
        </h2>

        <div className="flex justify-center items-center gap-4 flex-wrap mb-10">
          <div className="relative w-64 h-12 rounded-full bg-[#222] shadow-lg">
            <div className="relative w-full h-full">
              <input
                type="radio"
                id="oneonone-mode"
                name="mode-toggle"
                className="hidden"
                checked={mode === "1-1"}
                onChange={() => setMode("1-1")}
              />
              <label
                htmlFor="oneonone-mode"
                className={`absolute top-0 left-0 w-1/2 h-full flex items-center justify-center font-semibold text-base cursor-pointer z-10 transition-all ${
                  mode === "1-1" ? "text-white" : "text-gray-400"
                }`}
              >
                1 - 1
              </label>
              <input
                type="radio"
                id="online-mode"
                name="mode-toggle"
                className="hidden"
                checked={mode === "online"}
                onChange={() => setMode("online")}
              />
              <label
                htmlFor="online-mode"
                className={`absolute top-0 right-0 w-1/2 h-full flex items-center justify-center font-semibold text-base cursor-pointer z-10 transition-all ${
                  mode === "online" ? "text-white" : "text-gray-400"
                }`}
              >
                ONLINE
              </label>
              <div
                className={`absolute top-0 w-1/2 h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500 ease-out ${
                  mode === "1-1" ? "left-0" : "left-1/2"
                }`}
              ></div>
            </div>
          </div>
          <button
            onClick={() => setMode("trial")}
            className={`h-12 px-6 rounded-full font-semibold text-base transition-all duration-300 shadow-md ${
              mode === "trial"
                ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                : "bg-[#222] text-white hover:-translate-y-0.5 hover:shadow-lg"
            }`}
          >
            TRẢI NGHIỆM
          </button>
        </div>

        <div className="flex justify-center gap-6 flex-wrap">
          {(mode === "trial" ? [trialPlan] : plans).map((plan, idx) => (
            <div
              key={idx}
              className={`relative bg-[#1a1a1a] border-2 rounded-xl p-8 transition-all duration-300 w-96 ${
                plan.featured
                  ? "border-red-500 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a]"
                  : "border-gray-800"
              } hover:-translate-y-2 hover:scale-105 hover:border-red-500 hover:shadow-red-500/30`}
            >
              {plan.featured && (
                <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                  Phổ biến
                </div>
              )}
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold text-white uppercase">
                  {plan.title}
                </h3>
                <div className="mt-1">
                  <span className="text-base text-gray-400">
                    {plan.durationText}
                  </span>
                </div>
              </div>
              <ul className="space-y-2 mb-4 text-gray-200 text-base">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 border-b border-gray-700 pb-1"
                  >
                    <span className="text-red-500">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.gifts && plan.gifts.length > 0 && (
                <div
                  onClick={() => showGiftModal(plan.gifts)}
                  className="mt-4 p-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30 text-yellow-400 font-semibold cursor-pointer flex items-center justify-center gap-2 hover:scale-105 transition text-base"
                >
                  <Gift className="w-5 h-5" /> QUÀ TẶNG ĐẶC BIỆT
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-dashed border-gray-700 text-base text-gray-400 text-center">
                Tổng số buổi: {plan.totalSessions}
              </div>
              <button
                onClick={() =>
                  handleRegister(plan, mode === "trial" ? "trial" : mode)
                }
                className="relative w-full mt-5 py-3 font-bold uppercase tracking-wide rounded-md overflow-hidden group transition-all duration-300 bg-transparent border-2 border-red-500 text-red-500 hover:text-white hover:border-transparent text-base"
              >
                <span className="relative z-10">Đăng ký ngay</span>
                <span className="absolute inset-0 bg-red-500 transform -translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></span>
              </button>
            </div>
          ))}
        </div>

        {giftModalVisible && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setGiftModalVisible(false)}
          >
            <div
              className="bg-[#1a1a1a] border-2 border-yellow-500 rounded-2xl max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-yellow-500/30">
                <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
                  <Sparkles className="w-6 h-6" /> QUÀ TẶNG ĐẶC BIỆT
                </h3>
                <button
                  onClick={() => setGiftModalVisible(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {selectedGifts.map((gift, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-gray-300 text-base"
                  >
                    <span className="text-yellow-400">✓</span>
                    <span>{gift}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showLoginPrompt && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowLoginPrompt(false)}
          >
            <div
              className="bg-[#1a1a1a] border-2 border-red-500 rounded-2xl max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-red-500/30">
                <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                  <Sparkles className="w-6 h-6" /> ƯU ĐÃI ĐẶC BIỆT
                </h3>
                <button
                  onClick={() => setShowLoginPrompt(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-300 text-center text-lg">
                  Đăng nhập ngay để nhận{" "}
                  <strong className="text-red-400">GIẢM 15%</strong> cho gói tập
                  đầu tiên!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    onClick={handleLoginRedirect}
                    className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:scale-105 transition"
                  >
                    <LogIn size={18} /> Đăng nhập ngay
                  </button>
                  <button
                    onClick={handleContinueWithoutLogin}
                    className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-gray-600 transition"
                  >
                    Tiếp tục đăng ký <ArrowRight size={18} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  * Ưu đãi chỉ áp dụng cho lần đăng ký đầu tiên khi có tài khoản
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Pricing;
