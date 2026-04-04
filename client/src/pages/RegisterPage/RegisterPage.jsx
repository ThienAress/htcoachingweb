import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  X,
  Gift,
  ShoppingBag,
  Tag,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  createBooking,
  checkUserHasBookings,
} from "../../services/booking.service.js";
import HeaderMinimal from "../../sections/Header/HeaderMinimal";

function RegisterPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const selectedPackage = state?.selectedPackage;
  const planMode = state?.planMode;
  const gifts = state?.gifts || [];
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const [isNoteFocused, setIsNoteFocused] = useState(false);
  const [isNoteHintHovered, setIsNoteHintHovered] = useState(false);
  const [errors, setErrors] = useState({});
  const [newSchedule, setNewSchedule] = useState({ day: "", time: "" });
  const [discountCode, setDiscountCode] = useState("");
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const [hasExistingBooking, setHasExistingBooking] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: user?.email || "",
    note: "",
    location: "WAYSTATION DÂN CHỦ",
    schedule: [],
  });

  // Hàm kiểm tra user đã có booking chưa
  const fetchUserBookings = async () => {
    if (isLoggedIn) {
      try {
        const res = await checkUserHasBookings();
        setHasExistingBooking(res.data.hasBookings);
      } catch (err) {
        console.error("Check booking error:", err);
        setHasExistingBooking(false);
      }
    } else {
      setHasExistingBooking(false);
    }
    setLoadingCheck(false);
  };

  useEffect(() => {
    fetchUserBookings();
  }, [isLoggedIn]);

  // Tạo mã giảm giá chỉ khi chưa từng đăng ký
  useEffect(() => {
    if (isLoggedIn && !hasExistingBooking && !loadingCheck) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
      let code = "HT";
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      setDiscountCode(code);
    } else {
      setDiscountCode("");
    }
  }, [isLoggedIn, hasExistingBooking, loadingCheck]);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      2500,
    );
  };

  const containsProhibitedContent = (text) => {
    const badWords = [
      "địt",
      "dit",
      "đụ",
      "du",
      "đụ má",
      "đụ mẹ",
      "đm",
      "dm",
      "dmm",
      "dcm",
      "cặc",
      "cak",
      "cac",
      "cạc",
      "lồn",
      "lon",
      "loz",
      "l",
      "buồi",
      "buoi",
      "bùi",
      "bui",
      "chim",
      "bướm",
      "buom",
      "bú",
      "bu",
      "bú lol",
      "bú l",
      "ăn cặc",
      "ăn l",
      "ăn buồi",
      "đéo",
      "deo",
      "đếch",
      "dek",
      "vl",
      "vkl",
      "cl",
      "vcl",
      "cc",
      "shit",
      "fuck",
      "fml",
      "diss",
      "bitch",
      "bóp vú",
      "nứng",
      "nứng lồn",
      "nứng vl",
      "chịch",
      "chich",
      "xoạc",
      "xoc",
      "rape",
      "hiếp",
      "hiếp dâm",
      "gạ tình",
      "gạ gẫm",
      "sex",
      "sexy",
      "69",
      "xxx",
      "jav",
      "phim sex",
      "phim jav",
      "trai gọi",
      "gái gọi",
      "gái mại dâm",
      "bán dâm",
      "đi khách",
      "bong",
      "casino",
      "bet",
      "ku",
      "cmd368",
      "w88",
      "fun88",
      "fifa",
      "letou",
      "cacuoc",
      "1xbet",
      "dafabet",
      "188bet",
      "m88",
      "baccarat",
      "xoso",
      "xổ số",
      "danh bai",
      "game bai",
      "rakhoi",
      "choi casino",
      "vn88",
      "bong88",
      "new88",
      "nhacaionline",
      "nhà cái",
      "fck",
      "f u",
      "dmml",
      "dmvl",
      "ml",
      "ccmm",
      "đkm",
      "bố mày",
      "mẹ mày",
      "con đĩ",
      "con chó",
      "thằng chó",
      "clgt",
      "clmm",
      "sv",
      "óc chó",
      "súc vật",
      "não chó",
    ];
    const scriptRegex = /<script.*?>.*?<\/script>/gis;
    const domainRegex =
      /(https?:\/\/)?[a-z0-9.-]*(rakhoi|sv388|win88|cmd368|fun88|go88|f8bet|esball|ae888|123win|789win|hi88|okvip|new88|w88|m88|b52|uw88|nổhũ|bàiđổithưởng|cáđộ|cá cược)[^\s]*/gi;
    const lowered = text.toLowerCase();
    return (
      badWords.some((word) => lowered.includes(word)) ||
      domainRegex.test(lowered) ||
      scriptRegex.test(text)
    );
  };

  useEffect(() => {
    if (!selectedPackage || !planMode) {
      navigate("/", { replace: true });
    }
  }, [selectedPackage, planMode, navigate]);

  if (!selectedPackage || !planMode) return null;

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim() || formData.name.length < 8) {
      newErrors.name = "Họ và tên phải có ít nhất 8 ký tự";
    }
    if (!formData.phone.match(/^[0-9]{10}$/)) {
      newErrors.phone = "Số điện thoại phải đúng 10 chữ số";
    }
    if (!formData.email.match(/^[a-zA-Z0-9._%+-]+@gmail\.com$/)) {
      newErrors.email = "Email phải đúng định dạng @gmail.com";
    }
    if (formData.note.trim() && formData.note.length < 8) {
      newErrors.note =
        "Nếu nhập thông tin bổ sung, vui lòng nhập ít nhất 8 ký tự";
    } else if (
      formData.note.trim() &&
      containsProhibitedContent(formData.note)
    ) {
      newErrors.note = "Thông tin chứa từ ngữ hoặc nội dung không phù hợp!";
    }
    if (formData.schedule.length === 0) {
      newErrors.schedule = "Vui lòng thêm ít nhất 1 thời gian tập luyện.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddSchedule = () => {
    if (!newSchedule.day || !newSchedule.time) return;
    setFormData({
      ...formData,
      schedule: [...formData.schedule, newSchedule],
    });
    setNewSchedule({ day: "", time: "" });
  };

  const handleRemoveSchedule = (index) => {
    const updated = [...formData.schedule];
    updated.splice(index, 1);
    setFormData({ ...formData, schedule: updated });
  };

  const performSubmit = async () => {
    const scheduleString = formData.schedule
      .map((s) => `${s.day} ${s.time}`)
      .join(", ");
    const bookingData = {
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      gym: formData.location,
      schedule: scheduleString,
      note: formData.note,
      package: `${planMode === "trial" ? "Trải nghiệm" : planMode === "1-1" ? "1-1" : "Online"} - ${selectedPackage.title}`,
      sessions: selectedPackage.totalSessions,
      discountCode: isLoggedIn && !hasExistingBooking ? discountCode : null,
      gifts: gifts,
    };

    try {
      await createBooking(bookingData);
      // Cập nhật lại trạng thái đã có booking
      await fetchUserBookings();
      showToast(
        "Đăng ký thành công! Chúng tôi sẽ liên hệ tư vấn sớm nhất.",
        "success",
      );
      setTimeout(() => navigate("/"), 1500);
    } catch (error) {
      console.error(error);
      if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors
          .map((e) => e.msg)
          .join("\n");
        showToast(errorMessages, "error");
      } else if (error.response?.data?.message) {
        showToast(error.response.data.message, "error");
      } else {
        showToast("Có lỗi xảy ra, vui lòng thử lại.", "error");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isLoggedIn && !hasExistingBooking && !loadingCheck) {
      setShowFirstTimeModal(true);
      return;
    }
    await performSubmit();
  };

  const confirmFirstTimeSubmit = async () => {
    setShowFirstTimeModal(false);
    await performSubmit();
  };

  const timeOptions = Array.from({ length: 17 }, (_, i) => {
    const hour = 7 + i;
    return `${hour.toString().padStart(2, "0")}:00`;
  });

  const getPlanDisplay = () => {
    const modeText =
      planMode === "trial"
        ? "Trải nghiệm"
        : planMode === "1-1"
          ? "1 Kèm 1"
          : "Online";
    return `${modeText} - ${selectedPackage.title}`;
  };

  if (loadingCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Đang tải...</div>
      </div>
    );
  }

  return (
    <>
      <HeaderMinimal />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
              Đăng ký gói tập
            </h1>
            <p className="text-gray-500 mt-2">
              Vui lòng điền thông tin bên dưới để chúng tôi liên hệ tư vấn
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cột trái - Form đăng ký */}
            <div className="flex-1 bg-white rounded-2xl shadow-lg p-6 md:p-8">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-4 mb-6">
                <ShoppingBag className="text-red-500" size={24} />
                <h2 className="text-2xl font-bold text-gray-800">
                  Thông tin đăng ký
                </h2>
              </div>
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-400 transition"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-400"
                    value={formData.phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[0-9]*$/.test(val))
                        setFormData({ ...formData, phone: val });
                    }}
                    maxLength={10}
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-400"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Phòng tập mong muốn *
                  </label>
                  <select
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-400"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  >
                    <option value="">-- Chọn phòng tập --</option>
                    <option>WAYSTATION DÂN CHỦ</option>
                    <option>WAYSTATION TRƯƠNG VĂN HẢI</option>
                    <option>WAYSTATION HIỆP BÌNH</option>
                    <option>WAYSTATION QL13</option>
                    <option>Chung Cư Flora Novia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Thời gian tập luyện mong muốn *
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 mb-3">
                    <select
                      className="flex-1 p-3 border rounded-lg"
                      value={newSchedule.day}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          day: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Chọn ngày --</option>
                      <option>Thứ 2</option>
                      <option>Thứ 3</option>
                      <option>Thứ 4</option>
                      <option>Thứ 5</option>
                      <option>Thứ 6</option>
                      <option>Thứ 7</option>
                      <option>Chủ nhật</option>
                    </select>
                    <select
                      className="flex-1 p-3 border rounded-lg"
                      value={newSchedule.time}
                      onChange={(e) =>
                        setNewSchedule((prev) => ({
                          ...prev,
                          time: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Chọn giờ --</option>
                      {timeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddSchedule}
                      className="order-button px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-lg hover:scale-105 transition"
                    >
                      + Thêm
                    </button>
                  </div>
                  {formData.schedule.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg mb-2"
                    >
                      <Clock size={16} className="text-gray-500" />
                      <span className="text-gray-700">
                        {item.day} lúc {item.time}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSchedule(i)}
                        className="ml-auto text-red-500 hover:text-red-700"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                  {errors.schedule && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.schedule}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Thông tin bổ sung (không bắt buộc)
                  </label>
                  <textarea
                    rows={4}
                    className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-red-400"
                    placeholder="VD: link Facebook, Zalo, địa chỉ cụ thể, mong muốn khác..."
                    value={formData.note}
                    onChange={(e) =>
                      setFormData({ ...formData, note: e.target.value })
                    }
                    onFocus={() => setIsNoteFocused(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        if (!isNoteHintHovered) setIsNoteFocused(false);
                      }, 100);
                    }}
                  />
                  {errors.note && (
                    <p className="text-red-500 text-sm mt-1">{errors.note}</p>
                  )}
                  {(isNoteFocused || isNoteHintHovered) && (
                    <small
                      className="block text-gray-500 text-sm mt-1 bg-gray-50 p-2 rounded"
                      onMouseEnter={() => setIsNoteHintHovered(true)}
                      onMouseLeave={() => setIsNoteHintHovered(false)}
                    >
                      📌 Ví dụ:{" "}
                      <span className="text-blue-500">
                        https://www.facebook.com/example
                      </span>{" "}
                      hoặc Zalo:{" "}
                      <span className="text-blue-500">
                        https://zalo.me/0934215227
                      </span>
                    </small>
                  )}
                </div>

                <button
                  type="submit"
                  className="order-button w-full py-4 text-lg font-bold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-md hover:shadow-lg transition-all mt-4"
                >
                  GỬI ĐĂNG KÝ
                </button>
              </form>
            </div>

            {/* Cột phải - Đơn hàng của bạn */}
            <div className="lg:w-96">
              <div className="sticky top-8 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                  <h3 className="text-white text-xl font-bold flex items-center gap-2">
                    <ShoppingBag size={22} /> Đơn hàng của bạn
                  </h3>
                </div>

                <div className="p-6 space-y-5">
                  <div className="border-b border-gray-100 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-red-100 p-2 rounded-lg">
                        <Sparkles size={20} className="text-red-600" />
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

                  {/* Chỉ hiển thị giảm giá nếu đăng nhập và chưa có booking */}
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
                          onClick={() => {
                            navigator.clipboard.writeText(discountCode);
                            showToast(
                              "Đã sao chép mã: " + discountCode,
                              "success",
                            );
                          }}
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

                  {/* Nếu đã có booking thì hiển thị thông báo đã dùng ưu đãi */}
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
          </div>
        </div>
      </div>

      {/* Toast giữa màn hình */}
      {toast.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div
            className={`px-6 py-4 rounded-xl shadow-xl text-white font-medium text-center max-w-sm ${
              toast.type === "success" ? "bg-green-500" : "bg-red-500"
            } animate-fade-in`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Modal xác nhận lần đầu (chỉ hiện khi chưa có booking và modal được mở) */}
      {showFirstTimeModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60">
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 p-6 shadow-2xl animate-fade-in">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Tag className="text-green-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Ưu đãi lần đầu
              </h3>
              <p className="text-gray-600 mb-4">
                Mỗi tài khoản chỉ được nhận{" "}
                <strong className="text-green-600">mã giảm giá 15%</strong> cho{" "}
                <strong>lần đăng ký đầu tiên</strong>.<br />
                Bạn có muốn sử dụng ưu đãi này cho đơn hàng hiện tại?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmFirstTimeSubmit}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition"
                >
                  Đồng ý, sử dụng
                </button>
                <button
                  onClick={() => setShowFirstTimeModal(false)}
                  className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Để sau
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                * Nếu chọn "Để sau", bạn vẫn có thể đăng ký nhưng không được
                giảm giá.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RegisterPage;
