import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { X, Gift, Sparkles, LogIn, ArrowRight, Wallet, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getMyWallet } from "../services/wallet.service";
import { purchaseTrainerPlan } from "../services/trainerSubscription.service";

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // View mode: "customer" | "trainer" | null
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem("pricingViewMode") || null;
  });
  const [showModeModal, setShowModeModal] = useState(!viewMode);

  const handleSelectMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem("pricingViewMode", mode);
    setShowModeModal(false);
  };

  const isTrainer = viewMode === "trainer";

  const [mode, setMode] = useState("1-1");
  const [billingCycle, setBillingCycle] = useState("month");
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [selectedGifts, setSelectedGifts] = useState([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);

  // Checkout modal states
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [showTrainerLoginPrompt, setShowTrainerLoginPrompt] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null); // { success, message, data }
  const [countdown, setCountdown] = useState(null);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [showAlreadySubscribed, setShowAlreadySubscribed] = useState(false);

  // Fetch gói đang dùng khi đăng nhập
  useEffect(() => {
    if (user) {
      import("../services/trainerSubscription.service").then(({ getMySubscription }) => {
        getMySubscription()
          .then((res) => setActiveSubscription(res.data.data))
          .catch(() => setActiveSubscription(null));
      });
    }
  }, [user]);

  // Khóa scroll khi drawer mở
  useEffect(() => {
    if (checkoutPlan) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0") * -1);
      }
    };
  }, [checkoutPlan]);

  // Đếm ngược và reload sau thanh toán thành công
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        window.location.reload();
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Gói ONLINE
  const onlinePlans = [
    {
      title: "CƠ BẢN",
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
      title: "NÂNG CAO",
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
      title: "CƠ BẢN",
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
      title: "NÂNG CAO",
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
        "Balo cao cấp Degrey",
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

  // ===== GÓI DỊCH VỤ DÀNH CHO TRAINER =====
  const trainerPlans = [
    {
      title: "Tiêu chuẩn",
      icon: "\uD83D\uDD25",
      subtitle: "Dành cho cá nhân mới",
      priceMonth: 5000,
      priceYear: 50000,
      categories: [
        {
          name: "QUYỀN LỢI CƠ BẢN",
          features: [
            "Quản lý tối đa 10 học viên",
            "Truy cap kho bai tap Tiêu chuẩn",
            "Checkin học viên qua hệ thống"
          ]
        },
        {
          name: "Hỗ trợ",
          features: [
            "Hỗ trợ kỹ thuật qua email",
            "Cập nhật tính năng miễn phí"
          ]
        }
      ]
    },
    {
      title: "Chuyên nghiệp",
      icon: "\uD83D\uDC8E",
      subtitle: "Dành cho PT độc lập",
      priceMonth: 7000,
      priceYear: 70000,
      featured: true,
      categories: [
        {
          name: "QUYỀN LỢI CƠ BẢN",
          features: [
            "Quản lý không giới hạn học viên",
            "Truy cập toàn bộ hệ thống bài tập",
            "Hệ thống CRM quản lý khách hàng F1"
          ]
        },
        {
          name: "Tính năng AI & Báo cáo",
          icon: "\u2728",
          features: [
            "Tự động tạo giáo án bằng AI",
            "Báo cáo tiến độ tự động",
            "Gợi ý dinh dưỡng thông minh"
          ]
        }
      ]
    },
    {
      title: "Doanh nghiệp",
      icon: "\uD83D\uDC51",
      subtitle: "Dành cho Studio/Team",
      priceMonth: 10000,
      priceYear: 100000,
      categories: [
        {
          name: "Quyền lợi cao cấp",
          features: [
            "Đăng bài quảng bá trên nền tảng HT",
            "Trang cá nhân HLV có tick xanh",
            "Ưu tiên ghép khách hàng mới"
          ]
        },
        {
          name: "Tính năng AI & Quản lý",
          icon: "\u2728",
          features: [
            "Toàn bộ tính năng AI không giới hạn",
            "Quản lý lịch tập đội ngũ",
            "Phân tích dữ liệu kinh doanh"
          ]
        }
      ]
    }
  ];

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
    <section id="pricing" className="py-16 bg-[#262626]">
      <div className="container-custom mx-auto px-4">
        <h2 className="text-center text-primary uppercase">
          {isTrainer ? "GÓI DỊCH VỤ CỦA CHÚNG TÔI" : "GÓI TẬP CỦA CHÚNG TÔI"}
        </h2>


        {!isTrainer && (
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
                  className={`absolute top-0 left-0 w-1/2 h-full flex items-center justify-center font-semibold text-base cursor-pointer z-10 transition-all ${mode === "1-1" ? "text-white" : "text-gray-400"
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
                  className={`absolute top-0 right-0 w-1/2 h-full flex items-center justify-center font-semibold text-base cursor-pointer z-10 transition-all ${mode === "online" ? "text-white" : "text-gray-400"
                    }`}
                >
                  ONLINE
                </label>
                <div
                  className={`absolute top-0 w-1/2 h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all duration-500 ease-out ${mode === "1-1" ? "left-0" : "left-1/2"
                    }`}
                ></div>
              </div>
            </div>
            <button
              onClick={() => setMode("trial")}
              className={`h-12 px-6 rounded-full font-semibold text-base transition-all duration-300 shadow-md ${mode === "trial"
                ? "bg-gradient-to-r from-primary to-primary-dark text-white"
                : "bg-[#222] text-white hover:-translate-y-0.5 hover:shadow-lg"
                }`}
            >
              Trải nghiệm
            </button>
          </div>
        )}

        {isTrainer && (
          <div className="flex justify-center items-center mb-10">
            <div className="relative w-64 h-12 rounded-full bg-[#222] shadow-lg">
              <div className="relative w-full h-full flex">
                <button
                  className={`relative z-10 w-1/2 h-full rounded-full font-semibold text-base transition-colors duration-300 ${billingCycle === "month" ? "text-white" : "text-gray-400"
                    }`}
                  onClick={() => setBillingCycle("month")}
                >
                  Tháng
                </button>
                <button
                  className={`relative z-10 w-1/2 h-full rounded-full font-semibold text-base transition-colors duration-300 ${billingCycle === "year" ? "text-white" : "text-gray-400"
                    }`}
                  onClick={() => setBillingCycle("year")}
                >
                  Năm
                </button>
                <div
                  className={`absolute top-0 w-1/2 h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all duration-500 ease-out ${billingCycle === "month" ? "left-0" : "left-1/2"
                    }`}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-6 flex-wrap">
          {isTrainer ? (
            trainerPlans.map((plan, idx) => {
              const currentPrice = billingCycle === "year" ? plan.priceYear : plan.priceMonth;
              const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentPrice);
              const averageMonthPrice = billingCycle === "year" ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.round(plan.priceYear / 12)) : null;

              return (
                <div
                  key={idx}
                  className={`relative bg-[#1a1a1a] border-2 rounded-xl p-8 transition-all duration-300 w-[400px] flex flex-col ${plan.featured
                    ? "border-primary bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a]"
                    : "border-gray-800"
                    } hover:-translate-y-2 hover:shadow-xl hover:border-primary`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 -right-3 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                      PHỔ BIẾN
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                      {plan.title} <span className="text-2xl">{plan.icon}</span>
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">{plan.subtitle}</p>

                    <div className="mt-6">
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-white">{formattedPrice}</span>
                        <span className="text-gray-400 mb-1">/{billingCycle === "year" ? "Năm" : "Tháng"}</span>
                      </div>
                      {billingCycle === "year" && (
                        <p className="text-sm text-gray-500 mt-1">
                          Bình quân {averageMonthPrice}/Tháng
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mb-8">
                    <button
                      onClick={async () => {
                        if (!user) {
                          setShowTrainerLoginPrompt(true);
                          return;
                        }
                        // Kiểm tra nếu đang dùng gói này rồi
                        if (activeSubscription && activeSubscription.planTitle === plan.title) {
                          setShowAlreadySubscribed(true);
                          return;
                        }
                        setCheckoutPlan(plan);
                        setCheckoutResult(null);
                        setWalletLoading(true);
                        try {
                          const res = await getMyWallet();
                          setWalletBalance(res.data.data.balance);
                        } catch {
                          setWalletBalance(0);
                        } finally {
                          setWalletLoading(false);
                        }
                      }}
                      className="w-full py-3 font-bold rounded-lg transition-all duration-300 bg-primary text-white hover:bg-orange-500 shadow-lg shadow-orange-500/20"
                    >
                      MUA
                    </button>
                  </div>

                  <div className="flex-1 space-y-6">
                    {plan.categories.map((category, cIdx) => (
                      <div key={cIdx}>
                        <h4 className="text-white font-semibold flex items-center gap-2 mb-3">
                          {category.name} {category.icon && <span className="text-lg">{category.icon}</span>}
                        </h4>
                        <ul className="space-y-2.5">
                          {category.features.map((feature, fIdx) => (
                            <li key={fIdx} className="flex items-start gap-2 text-sm text-gray-300">
                              <span className="text-green-500 mt-0.5">{"\u2713"}</span>
                              <span className="leading-relaxed">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            (mode === "trial" ? [trialPlan] : plans).map((plan, idx) => (
              <div
                key={idx}
                className={`relative bg-[#1a1a1a] border-2 rounded-xl p-8 transition-all duration-300 w-96 ${plan.featured
                  ? "border-primary bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a]"
                  : "border-gray-800"
                  } hover:-translate-y-2 hover:scale-105 hover:border-primary hover:shadow-red-500/30`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 -right-3 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                    PHỔ BIẾN
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
                      <span className="text-primary">{"\u2713"}</span>
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
                <Link
                  to="/register"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRegister(plan, mode === "trial" ? "trial" : mode);
                  }}
                  className="relative flex items-center justify-center w-full mt-5 py-3 font-bold uppercase tracking-wide rounded-md overflow-hidden group transition-all duration-300 bg-transparent border-2 border-primary text-primary hover:text-white hover:border-transparent text-base"
                >
                  <span className="relative z-10">Đăng ký ngay</span>
                  <span className="absolute inset-0 bg-primary transform -translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></span>
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Link chuyển chế độ xem */}
        <div className="text-center mt-10">
          <button
            onClick={() => setShowModeModal(true)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors group"
          >
            {isTrainer ? (
              <>Bạn là khách hàng? <span className="underline underline-offset-2 group-hover:text-primary">Xem gói tập cá nhân</span> <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" /></>
            ) : (
              <>Bạn là huấn luyện viên? <span className="underline underline-offset-2 group-hover:text-primary">Xem gói dành cho HLV</span> <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" /></>
            )}
          </button>
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
                    <span className="text-yellow-400">{"\u2713"}</span>
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
              className="bg-[#1a1a1a] border-2 border-primary rounded-2xl max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-primary/30">
                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
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
                  <strong className="text-primary">GIẢM 15%</strong> cho gói tập
                  đầu tiên!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <button
                    onClick={handleLoginRedirect}
                    className="flex-1 py-3 bg-gradient-to-r from-primary to-primary-dark text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:scale-105 transition"
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

        {/* ===== MODAL ĐĂNG NHẬP CHO HLV ===== */}
        {showTrainerLoginPrompt && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowTrainerLoginPrompt(false)}
          >
            <div
              className="bg-[#1a1a1a] border-2 border-primary rounded-2xl max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end p-3 pb-0">
                <button
                  onClick={() => setShowTrainerLoginPrompt(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 pb-6 space-y-4 text-center">
                <div>
                  <h3 className="text-base font-bold text-white mb-1">ĐĂNG NHẬP ĐỂ TIẾP TỤC</h3>
                  <p className="text-gray-400 text-sm">Vui lòng đăng nhập để mua gói dịch vụ</p>
                </div>
                <button
                  onClick={() => {
                    setShowTrainerLoginPrompt(false);
                    navigate("/login", { state: { from: "/pricing" } });
                  }}
                  className="w-full py-3 bg-gradient-to-r from-primary to-primary-dark text-white font-bold rounded-lg flex items-center justify-center gap-2 hover:scale-105 transition"
                >
                  <LogIn size={18} /> Đăng nhập ngay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== MODAL ĐÃ ĐĂNG KÝ GÓI NÀY ===== */}
        {showAlreadySubscribed && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAlreadySubscribed(false)}
          >
            <div
              className="bg-[#1a1a1a] border-2 border-primary rounded-2xl max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end p-3 pb-0">
                <button
                  onClick={() => setShowAlreadySubscribed(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 pb-6 space-y-4 text-center">
                <span className="text-4xl">{activeSubscription ? ({"Tiêu chuẩn": "\uD83D\uDD25", "Chuyên nghiệp": "\uD83D\uDC8E", "Doanh nghiệp": "\uD83D\uDC51"}[activeSubscription.planTitle] || "") : ""}</span>
                <h3 className="text-base font-bold text-white">
                  Bạn đang sử dụng gói {activeSubscription?.planTitle}
                </h3>
                <p className="text-gray-400 text-sm">
                  Hãy nâng cấp lên gói cao hơn để trải nghiệm nhiều tính năng hơn!
                </p>
                <button
                  onClick={() => setShowAlreadySubscribed(false)}
                  className="w-full py-3 bg-gradient-to-r from-primary to-orange-500 text-white font-bold rounded-lg hover:scale-105 transition"
                >
                  Xem các gói khác
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== DRAWER CHECKOUT GÓI HLV (trượt từ phải) ===== */}
        {checkoutPlan && (() => {
          const price = billingCycle === "year" ? checkoutPlan.priceYear : checkoutPlan.priceMonth;
          const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
          const isEnough = walletBalance !== null && walletBalance >= price;
          const shortage = walletBalance !== null ? price - walletBalance : 0;

          const handlePurchase = async () => {
            setCheckoutLoading(true);
            try {
              const res = await purchaseTrainerPlan(checkoutPlan.title, billingCycle);
              setCheckoutResult({
                success: true,
                message: res.data.message,
                data: res.data.data,
              });
              setCountdown(5);
            } catch (err) {
              setCheckoutResult({
                success: false,
                message: err.response?.data?.message || "Có lỗi xảy ra",
              });
            } finally {
              setCheckoutLoading(false);
            }
          };

          const handleClose = () => {
            if (!checkoutLoading) {
              setCheckoutPlan(null);
              setCheckoutResult(null);
            }
          };

          return (
            <div
              className="fixed inset-0 z-50"
              onClick={handleClose}
            >
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

              {/* Drawer */}
              <div
                className="absolute top-0 right-0 h-full w-full max-w-md bg-[#1a1a1a] border-l border-gray-700 shadow-2xl overflow-y-auto"
                style={{ animation: 'slideInRight 0.35s ease-out forwards' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Nút đóng */}
                <button
                  onClick={handleClose}
                  className="absolute top-4 left-4 w-9 h-9 flex items-center justify-center rounded-full bg-[#222] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Header gói */}
                <div className="pt-16 px-6 pb-5 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{checkoutPlan.icon}</span>
                    <div>
                      <h3 className="text-xl font-bold text-white">{checkoutPlan.title}</h3>
                      <p className="text-gray-400 text-sm">{checkoutPlan.subtitle}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-3xl font-bold text-white">{formattedPrice}</span>
                    <span className="text-gray-400 mb-1">/{billingCycle === "year" ? "Năm" : "Tháng"}</span>
                  </div>
                </div>

                {/* Kết quả thanh toán */}
                {checkoutResult ? (
                  <div className="px-6 py-10 space-y-5">
                    <div className="flex flex-col items-center text-center space-y-4">
                      {checkoutResult.success ? (
                        <>
                          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-green-400" />
                          </div>
                          <h4 className="text-xl font-bold text-green-400">Thanh toán thành công!</h4>
                          <p className="text-gray-400 text-sm">{checkoutResult.message}</p>
                          {checkoutResult.data && (
                            <div className="bg-[#222] rounded-xl p-4 w-full text-sm">
                              <div className="flex justify-between text-gray-400">
                                <span>Số dư còn lại</span>
                                <span className="text-white font-semibold">
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(checkoutResult.data.newBalance)}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-10 h-10 text-red-400" />
                          </div>
                          <h4 className="text-xl font-bold text-red-400">Thanh toán thất bại</h4>
                          <p className="text-gray-400 text-sm">{checkoutResult.message}</p>
                        </>
                      )}
                    </div>
                    {checkoutResult.success ? (
                      <div className="text-center space-y-2">
                        <p className="text-gray-400 text-sm">
                          Đang kích hoạt tài khoản... Tự động chuyển sau <span className="text-primary font-bold text-lg">{countdown || 0}s</span>
                        </p>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-primary to-orange-500 h-full rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${((5 - (countdown || 0)) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleClose}
                        className="w-full py-3 bg-gray-700 text-white font-semibold rounded-xl hover:bg-gray-600 transition"
                      >
                        Đóng
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="px-6 py-6 space-y-6">
                    {/* Phương thức thanh toán */}
                    <div>
                      <p className="text-sm text-gray-400 mb-3 font-medium">Phương thức thanh toán</p>
                      <div className="bg-[#222] border-2 border-primary/50 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                              <Wallet className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">Ví cá nhân</p>
                              {walletLoading ? (
                                <p className="text-gray-500 text-xs">Đang tải...</p>
                              ) : (
                                <p className={`text-xs font-medium ${isEnough ? 'text-green-400' : 'text-red-400'}`}>
                                  Số dư: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(walletBalance || 0)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chi tiết thanh toán */}
                    <div className="bg-[#222] rounded-xl p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Giá gói</span>
                        <span className="text-white font-medium">{formattedPrice}</span>
                      </div>
                      <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
                        <span className="text-white font-bold">Tổng cộng</span>
                        <span className="text-2xl font-bold text-primary">{formattedPrice}</span>
                      </div>
                    </div>

                    {/* Thiếu tiền warning */}
                    {!walletLoading && !isEnough && walletBalance !== null && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center space-y-2">
                        <p className="text-red-400 text-sm font-medium">
                          ⚠️ Số dư không đủ (thiếu {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(shortage)})
                        </p>
                        <button
                          onClick={() => { setCheckoutPlan(null); navigate('/wallet'); }}
                          className="text-primary text-sm font-semibold hover:underline flex items-center justify-center gap-1 mx-auto"
                        >
                          Nạp tiền vào ví <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Nút thanh toán */}
                    <button
                      onClick={handlePurchase}
                      disabled={checkoutLoading || walletLoading || !isEnough}
                      className="w-full py-4 bg-gradient-to-r from-primary to-orange-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      {checkoutLoading ? "Đang xử lý..." : "THANH TOÁN"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ===== MODAL CHON CHE DO ===== */}
        {showModeModal && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <div
              className="bg-[#1a1a1a] border-2 border-primary rounded-2xl max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 space-y-6">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">Bạn là ai?</h3>
                  <p className="text-gray-400 text-sm">Chọn chế độ để xem gói phù hợp với bạn</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleSelectMode("customer")}
                    className="w-full py-4 text-lg font-bold rounded-xl transition-all duration-300 border-2 border-gray-700 text-white hover:border-primary hover:bg-primary/10 hover:scale-[1.02]"
                  >
                    Khách hàng
                  </button>
                  <button
                    onClick={() => handleSelectMode("trainer")}
                    className="w-full py-4 text-lg font-bold rounded-xl transition-all duration-300 border-2 border-gray-700 text-white hover:border-primary hover:bg-primary/10 hover:scale-[1.02]"
                  >
                    Huấn luyện viên
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Pricing;
