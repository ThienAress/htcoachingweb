import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";

import { useAuth } from "../../context/AuthContext";
import { X, Clock } from "lucide-react";
import {
  createBooking,
  checkUserHasBookings,
} from "../../services/booking.service.js";
import SEO from "../../components/SEO";

import { registerSchema } from "./registerSchema";
import OrderSummary from "./components/OrderSummary";
import FirstTimeModal from "./components/FirstTimeModal";

function RegisterPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const selectedPackage = state?.selectedPackage;
  const planMode = state?.planMode;
  const gifts = state?.gifts || [];
  const { user } = useAuth();
  const isLoggedIn = !!user;

  // State tạm cho picker ngày/giờ trước khi bấm "+ Thêm"
  const [tempDay, setTempDay] = useState("");
  const [tempTime, setTempTime] = useState("");

  // Booking & discount states
  const [discountCode, setDiscountCode] = useState("");
  const [hasExistingBooking, setHasExistingBooking] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);


  // Note hint UX states
  const [isNoteFocused, setIsNoteFocused] = useState(false);
  const [isNoteHintHovered, setIsNoteHintHovered] = useState(false);

  // react-hook-form + zod
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: user?.email || "",
      note: "",
      location: "WAYSTATION DÂN CHỦ",
      schedules: [],
    },
  });

  // useFieldArray: quản lý mảng lịch tập trong RHF
  const { fields, append, remove } = useFieldArray({
    control,
    name: "schedules",
  });

  // Time options
  const timeOptions = useMemo(
    () =>
      Array.from({ length: 17 }, (_, i) => {
        const hour = 7 + i;
        return `${hour.toString().padStart(2, "0")}:00`;
      }),
    [],
  );

  // Fetch booking status
  const fetchUserBookings = useCallback(async () => {
    if (isLoggedIn) {
      try {
        const res = await checkUserHasBookings();
        setHasExistingBooking(res.data.hasBookings);
      } catch {
        setHasExistingBooking(false);
      }
    } else {
      setHasExistingBooking(false);
    }
    setLoadingCheck(false);
  }, [isLoggedIn]);

  useEffect(() => {
    fetchUserBookings();
  }, [fetchUserBookings]);

  // Generate discount code
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

  // Redirect if no package selected
  useEffect(() => {
    if (!selectedPackage || !planMode) {
      navigate("/", { replace: true });
    }
  }, [selectedPackage, planMode, navigate]);

  // Schedule handler: thêm lịch tập vào useFieldArray
  const handleAddSchedule = useCallback(() => {
    if (!tempDay || !tempTime) return;
    append({ day: tempDay, time: tempTime });
    setTempDay("");
    setTempTime("");
  }, [tempDay, tempTime, append]);

  // Submit logic
  const performSubmit = useCallback(
    async (formValues) => {
      // Chuyển đổi array từ useFieldArray thành string cho backend
      const scheduleString = formValues.schedules
        .map((s) => `${s.day} ${s.time}`)
        .join(", ");

      const bookingData = {
        name: formValues.name,
        phone: formValues.phone,
        email: formValues.email,
        gym: formValues.location,
        schedule: scheduleString,
        note: formValues.note || "",
        package: `${planMode === "trial" ? "Trải nghiệm" : planMode === "1-1" ? "1-1" : "Online"} - ${selectedPackage.title}`,
        sessions: selectedPackage.totalSessions,
        discountCode: isLoggedIn && !hasExistingBooking ? discountCode : null,
        gifts: gifts,
      };

      try {
        await createBooking(bookingData);
        await fetchUserBookings();
        toast.success("Đăng ký thành công! Chúng tôi sẽ liên hệ tư vấn sớm nhất.");
        setTimeout(() => navigate("/"), 1500);
      } catch (error) {
        if (error.response?.data?.errors) {
          const errorMessages = error.response.data.errors
            .map((e) => e.msg)
            .join("\n");
          toast.error(errorMessages);
        } else if (error.response?.data?.message) {
          toast.error(error.response.data.message);
        } else {
          toast.error("Có lỗi xảy ra, vui lòng thử lại.");
        }
      }
    },
    [
      planMode,
      selectedPackage,
      isLoggedIn,
      hasExistingBooking,
      discountCode,
      gifts,
      fetchUserBookings,
      navigate,
    ],
  );

  // Ref for pending form data (giữ giá trị form khi hiện modal)
  const [pendingFormData, setPendingFormData] = useState(null);

  const onFormSubmit = useCallback(
    (data) => {
      // schedules đã được Zod validate tự động qua useFieldArray
      if (isLoggedIn && !hasExistingBooking && !loadingCheck) {
        setPendingFormData(data);
        setShowFirstTimeModal(true);
        return;
      }
      performSubmit(data);
    },
    [isLoggedIn, hasExistingBooking, loadingCheck, performSubmit],
  );

  const confirmFirstTimeSubmit = useCallback(() => {
    setShowFirstTimeModal(false);
    if (pendingFormData) {
      performSubmit(pendingFormData);
      setPendingFormData(null);
    }
  }, [pendingFormData, performSubmit]);

  const handleCopyCode = useCallback((code) => {
    navigator.clipboard.writeText(code);
    toast.success("Đã sao chép mã: " + code);
  }, []);

  if (!selectedPackage || !planMode) return null;

  if (loadingCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl">Đang tải...</div>
      </div>
    );
  }

  return (
    <>
      <SEO title="Đăng ký gói tập" noindex />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-12 pb-8">
        <div className="container-custom">
          <div className="text-center mb-8">
            <h1 className="text-gray-800 uppercase">ĐĂNG KÝ GÓI TẬP</h1>
            <p className="text-gray-500 mt-2">
              Vui lòng điền thông tin bên dưới để chúng tôi liên hệ tư vấn
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cột trái - Form đăng ký */}
            <div className="flex-1 bg-white rounded-2xl shadow-lg p-6 md:p-8">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-4 mb-6">
                <h2 className="text-gray-800 uppercase">THÔNG TIN ĐĂNG KÝ</h2>
              </div>
              <form
                className="flex flex-col gap-5"
                onSubmit={handleSubmit(onFormSubmit)}
              >
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    {...register("name")}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary transition"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    {...register("phone")}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary"
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.phone.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    {...register("email")}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Phòng tập mong muốn *
                  </label>
                  <select
                    {...register("location")}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Chọn phòng tập --</option>
                    <option>WAYSTATION DÂN CHỦ</option>
                    <option>WAYSTATION TRƯƠNG VĂN HẢI</option>
                    <option>WAYSTATION HIỆP BÌNH</option>
                    <option>WAYSTATION QL13</option>
                    <option>Chung Cư Flora Novia</option>
                  </select>
                  {errors.location && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.location.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Thời gian tập luyện mong muốn *
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 mb-3">
                    <select
                      className="flex-1 p-3 border rounded-lg"
                      value={tempDay}
                      onChange={(e) => setTempDay(e.target.value)}
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
                      value={tempTime}
                      onChange={(e) => setTempTime(e.target.value)}
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
                      className="order-button px-4 py-3 bg-gradient-to-r from-primary to-primary-dark text-white font-semibold rounded-lg hover:scale-105 transition"
                    >
                      + Thêm
                    </button>
                  </div>
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg mb-2"
                    >
                      <Clock size={16} className="text-gray-500" />
                      <span className="text-gray-700">
                        {field.day} lúc {field.time}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="ml-auto text-red-500 hover:text-red-700"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                  {errors.schedules && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.schedules.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    Thông tin bổ sung (không bắt buộc)
                  </label>
                  <textarea
                    rows={4}
                    {...register("note")}
                    className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-primary"
                    placeholder="VD: link Facebook, Zalo, địa chỉ cụ thể, mong muốn khác..."
                    onFocus={() => setIsNoteFocused(true)}
                    onBlur={() => {
                      setTimeout(() => {
                        if (!isNoteHintHovered) setIsNoteFocused(false);
                      }, 100);
                    }}
                  />
                  {errors.note && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.note.message}
                    </p>
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
                  disabled={isSubmitting}
                  className="order-button w-full py-4 text-lg font-bold text-white bg-gradient-to-r from-primary to-primary-dark rounded-xl shadow-md hover:shadow-lg transition-all mt-4 disabled:opacity-60"
                >
                  {isSubmitting ? "ĐANG GỬI..." : "GỬI ĐĂNG KÝ"}
                </button>
              </form>
            </div>

            {/* Cột phải - Đơn hàng */}
            <OrderSummary
              planMode={planMode}
              selectedPackage={selectedPackage}
              isLoggedIn={isLoggedIn}
              hasExistingBooking={hasExistingBooking}
              discountCode={discountCode}
              gifts={gifts}
              onCopyCode={handleCopyCode}
            />
          </div>
        </div>
      </div>

      {/* Toast đã dùng react-toastify (global) — không cần toast state riêng */}

      {/* Modal xác nhận lần đầu */}
      {showFirstTimeModal && (
        <FirstTimeModal
          discountCode={discountCode}
          onConfirm={confirmFirstTimeSubmit}
          onCancel={() => setShowFirstTimeModal(false)}
        />
      )}
    </>
  );
}

export default RegisterPage;
