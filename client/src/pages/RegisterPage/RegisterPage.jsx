import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import { useTranslation, Trans } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

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

const createDiscountCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let code = "HT";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

function RegisterPage() {
  const { t } = useTranslation("auth");
  const { state } = useLocation();
  const navigate = useNavigate();
  const selectedPackage = state?.selectedPackage;
  const planMode = state?.planMode;
  const gifts = useMemo(() => state?.gifts || [], [state?.gifts]);
  const { user } = useAuth();
  const isLoggedIn = !!user;

  // State tạm cho picker ngày/giờ trước khi bấm "+ Thêm"
  const [tempDay, setTempDay] = useState("");
  const [tempTime, setTempTime] = useState("");

  // Booking & discount states
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [bookingRequestId, setBookingRequestId] = useState(null);

  // Helper dịch thứ trong tuần hiển thị cho UX
  const getDayTranslation = useCallback((dayStr) => {
    const map = {
      "Thứ 2": t("register.days.mon"),
      "Thứ 3": t("register.days.tue"),
      "Thứ 4": t("register.days.wed"),
      "Thứ 5": t("register.days.thu"),
      "Thứ 6": t("register.days.fri"),
      "Thứ 7": t("register.days.sat"),
      "Chủ nhật": t("register.days.sun"),
    };
    return map[dayStr] || dayStr;
  }, [t]);

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
  const {
    data: bookingStatus,
    isLoading: loadingBookingStatus,
    refetch: fetchUserBookings,
  } = useQuery({
    queryKey: ["booking-status", user?._id],
    enabled: isLoggedIn,
    queryFn: async () => {
      try {
        const res = await checkUserHasBookings();
        const hasBookings = Boolean(res.data.hasBookings);
        return {
          hasBookings,
          discountCode: hasBookings ? "" : createDiscountCode(),
        };
      } catch {
        return { hasBookings: false, discountCode: createDiscountCode() };
      }
    },
    staleTime: 60_000,
  });
  const hasExistingBooking = bookingStatus?.hasBookings || false;
  const discountCode = bookingStatus?.discountCode || "";
  const loadingCheck = isLoggedIn && loadingBookingStatus;

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
        clientRequestId:
          bookingRequestId || window.crypto.randomUUID(),
      };
      setBookingRequestId(bookingData.clientRequestId);

      try {
        await createBooking(bookingData);
        setBookingRequestId(null);
        await fetchUserBookings();
        toast.success(t("register.success_msg"));
        setTimeout(() => navigate("/"), 1500);
      } catch (error) {
        if (error.response) setBookingRequestId(null);
        if (error.response?.data?.errors) {
          const errorMessages = error.response.data.errors
            .map((e) => e.msg)
            .join("\n");
          toast.error(errorMessages);
        } else if (error.response?.data?.message) {
          toast.error(error.response.data.message);
        } else {
          toast.error(t("register.error_general"));
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
      bookingRequestId,
      fetchUserBookings,
      navigate,
      t,
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
    toast.success(t("register.copy_code_success") + code);
  }, [t]);

  if (!selectedPackage || !planMode) return null;

  if (loadingCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-primary text-xl">{t("register.loading")}</div>
      </div>
    );
  }

  return (
    <>
      <SEO title={t("seo.register_title")} noindex />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pt-12 pb-8">
        <div className="container-custom">
          <div className="text-center mb-8">
            <h1 className="text-gray-800 uppercase">{t("register.title")}</h1>
            <p className="text-gray-500 mt-2">
              {t("register.subtitle")}
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cột trái - Form đăng ký */}
            <div className="flex-1 bg-white rounded-2xl shadow-lg p-6 md:p-8">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-4 mb-6">
                <h2 className="text-gray-800 uppercase">{t("register.info_section")}</h2>
              </div>
              <form
                className="flex flex-col gap-5"
                onSubmit={handleSubmit(onFormSubmit)}
              >
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    {t("register.name")}
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
                    {t("register.phone")}
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
                    {t("register.email")}
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
                    {t("register.location")}
                  </label>
                  <select
                    {...register("location")}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary"
                  >
                    <option value="">{t("register.location_select")}</option>
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
                    {t("register.schedule")}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 mb-3">
                    <select
                      className="flex-1 p-3 border rounded-lg"
                      value={tempDay}
                      onChange={(e) => setTempDay(e.target.value)}
                    >
                      <option value="">{t("register.schedule_day")}</option>
                      <option value="Thứ 2">{t("register.days.mon")}</option>
                      <option value="Thứ 3">{t("register.days.tue")}</option>
                      <option value="Thứ 4">{t("register.days.wed")}</option>
                      <option value="Thứ 5">{t("register.days.thu")}</option>
                      <option value="Thứ 6">{t("register.days.fri")}</option>
                      <option value="Thứ 7">{t("register.days.sat")}</option>
                      <option value="Chủ nhật">{t("register.days.sun")}</option>
                    </select>
                    <select
                      className="flex-1 p-3 border rounded-lg"
                      value={tempTime}
                      onChange={(e) => setTempTime(e.target.value)}
                    >
                      <option value="">{t("register.schedule_time")}</option>
                      {timeOptions.map((tOpt) => (
                        <option key={tOpt} value={tOpt}>
                          {tOpt}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddSchedule}
                      className="order-button px-4 py-3 bg-gradient-to-r from-primary to-primary-dark text-white font-semibold rounded-lg hover:scale-105 transition"
                    >
                      {t("register.add_schedule")}
                    </button>
                  </div>
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg mb-2"
                    >
                      <Clock size={16} className="text-gray-500" />
                      <span className="text-gray-700">
                        {getDayTranslation(field.day)} {t("register.schedule_at")} {field.time}
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
                    {t("register.additional_info")}
                  </label>
                  <textarea
                    rows={4}
                    {...register("note")}
                    className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-primary"
                    placeholder={t("register.additional_info_placeholder")}
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
                      <Trans t={t} i18nKey="register.note_hint">
                        📌 Ví dụ:{" "}
                        <span className="text-blue-500">
                          https://www.facebook.com/example
                        </span>{" "}
                        hoặc Zalo:{" "}
                        <span className="text-blue-500">
                          https://zalo.me/0934215227
                        </span>
                      </Trans>
                    </small>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="order-button w-full py-4 text-lg font-bold text-white bg-gradient-to-r from-primary to-primary-dark rounded-xl shadow-md hover:shadow-lg transition-all mt-4 disabled:opacity-60"
                >
                  {isSubmitting ? t("register.submit_sending") : t("register.submit")}
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
