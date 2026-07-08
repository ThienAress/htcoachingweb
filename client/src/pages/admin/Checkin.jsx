import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  User,
  Package,
  Calendar,
  Dumbbell,
  FileText,
  CheckCircle,
  History,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Mail,
  Info,
  ChevronDown,
  X,
} from "lucide-react";

import { getOrders } from "../../services/order.service";
import { getCheckins, createCheckin } from "../../services/checkin.service";
import { useAuth } from "../../context/AuthContext";
import SEO from "../../components/SEO";

const muscles = [
  "Ngực",
  "Lưng",
  "Chân",
  "Vai",
  "Tay",
  "Bụng",
  "Cardio",
  "Boxing",
];

const checkinSchema = z.object({
  time: z.string().min(1, "Vui lòng chọn thời gian check-in"),
  muscle: z.array(z.string()).min(1, "Vui lòng chọn ít nhất một nhóm cơ"),
  note: z.string().optional(),
});

const Checkin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dropdownRef = useRef(null);
  const customerDropdownRef = useRef(null);
  const [isMuscleDropdownOpen, setIsMuscleDropdownOpen] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 5;

  // Fetch orders
  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(1, 1000).then((res) => res.data.data.orders || []),
  });

  // Fetch checkins
  const {
    data: checkinsData,
    isLoading: isLoadingCheckins,
    isError,
  } = useQuery({
    queryKey: ["checkins", currentPage],
    queryFn: () =>
      getCheckins(currentPage, limit).then((res) => ({
        data: res.data.data,
        pagination: res.data.pagination,
      })),
    keepPreviousData: true,
  });

  const checkins = checkinsData?.data || [];
  const pagination = checkinsData?.pagination || {
    total: 0,
    totalPages: 0,
    page: 1,
  };

  // Lọc order theo role: admin chỉ thấy order chưa có trainer (trainerId == null)
  const filteredOrdersForCustomer = useMemo(() => {
    if (user?.role === "admin") {
      return orders.filter((o) => !o.trainerId);
    }
    return orders;
  }, [orders, user?.role]);

  // Danh sách khách hàng (unique email) từ orders đã lọc
  const customers = useMemo(() => {
    return [
      ...new Map(filteredOrdersForCustomer.map((o) => [o.email, o])).values(),
    ];
  }, [filteredOrdersForCustomer]);

  const [selection, setSelection] = useState({
    customer: "",
    orderId: "",
    orderData: null,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(checkinSchema),
    defaultValues: { time: "", muscle: [], note: "" },
  });

  const selectedMuscles = watch("muscle");

  const toggleMuscle = useCallback(
    (muscle) => {
      const current = selectedMuscles;
      const updated = current.includes(muscle)
        ? current.filter((m) => m !== muscle)
        : [...current, muscle];
      setValue("muscle", updated, { shouldValidate: true });
    },
    [selectedMuscles, setValue],
  );

  // Click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsMuscleDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectOrder = useCallback(
    (id) => {
      const order = filteredOrdersForCustomer.find((o) => o._id === id);
      setSelection((prev) => ({ ...prev, orderId: id, orderData: order }));
    },
    [filteredOrdersForCustomer],
  );

  const currentDateTimeLocal = useMemo(() => {
    const now = new Date();
    const tzOffsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  }, []);

  const currentYearStart = useMemo(() => {
    return `${new Date().getFullYear()}-01-01T00:00`;
  }, []);

  const createCheckinMutation = useMutation({
    mutationFn: createCheckin,
    onSuccess: () => {
      toast.success("Check-in thành công!");
      reset({ time: "", muscle: [], note: "" });
      setSelection({ customer: "", orderId: "", orderData: null });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Check-in thất bại");
    },
  });

  const onSubmit = useCallback(
    (data) => {
      if (!selection.customer) {
        toast.error("Vui lòng chọn khách hàng");
        return;
      }
      if (!selection.orderId) {
        toast.error("Vui lòng chọn gói tập");
        return;
      }
      const muscleString = data.muscle.join(", ");
      createCheckinMutation.mutate({
        time: new Date(data.time).toISOString(),
        muscle: muscleString,
        note: data.note,
        orderId: selection.orderId,
      });
    },
    [selection, createCheckinMutation],
  );

  const isLoading = isLoadingOrders || isLoadingCheckins;

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500">
        Lỗi tải dữ liệu, vui lòng thử lại.
      </div>
    );
  }

  return (
    <>
      <SEO title="Check-in khách hàng" noindex />
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <phantom-ui loading={isLoading || undefined}>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white py-12 px-4 md:px-6">
          <div className="container-custom space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-2">
                  <CheckCircle className="text-primary w-6 h-6 animate-pulse" />
                  <span className="font-semibold text-primary tracking-wide">QUẢN LÝ CHECK-IN</span>
                </div>
                <h1 className="font-display text-fluid-4xl font-black uppercase text-white tracking-normal">
                  CHECK-IN <span className="text-primary">KHÁCH HÀNG</span>
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Xác nhận buổi tập và ghi nhận lịch sử nhanh chóng
                </p>
              </div>
              <div className="text-sm text-gray-300 bg-gray-800/80 border border-gray-700 px-4 py-2 rounded-full backdrop-blur-sm shadow-inner flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <span>Tổng lượt check‑in: <strong className="text-primary font-bold">{pagination.total}</strong></span>
              </div>
            </div>

            {/* Form checkin */}
            <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-800 p-6 overflow-visible shadow-xl">
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Chọn khách hàng */}
                  <div className="space-y-1" style={{ overflow: "visible" }}>
                    <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <User className="w-4 h-4" /> Khách hàng{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative" ref={customerDropdownRef}>
                      <div
                        onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                        className="w-full border border-gray-700 bg-gray-800 text-white rounded-lg px-3 py-2 cursor-pointer flex justify-between items-center hover:bg-gray-750 transition"
                      >
                        <span className={selection.customer ? "text-white" : "text-gray-400"}>
                          {selection.customer
                            ? customers.find((c) => c.email === selection.customer)?.name || "Chọn khách hàng"
                            : "Chọn khách hàng"}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isCustomerDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                      {isCustomerDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-y-auto max-h-40">
                          <div
                            onClick={() => {
                              setSelection({ customer: "", orderId: "", orderData: null });
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="px-3 py-2 text-gray-400 hover:bg-gray-700 cursor-pointer text-sm transition-colors"
                          >
                            Chọn khách hàng
                          </div>
                          {customers.map((c) => (
                            <div
                              key={c.email}
                              onClick={() => {
                                setSelection({ customer: c.email, orderId: "", orderData: null });
                                setIsCustomerDropdownOpen(false);
                              }}
                              className={`px-3 py-2 cursor-pointer text-sm hover:bg-gray-700 transition-colors ${
                                selection.customer === c.email
                                  ? "bg-primary/20 text-primary font-medium"
                                  : "text-gray-200"
                              }`}
                            >
                              {c.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chọn gói tập */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <Package className="w-4 h-4" /> Gói tập{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selection.orderId}
                      onChange={(e) => handleSelectOrder(e.target.value)}
                      className="w-full border border-gray-700 bg-gray-800 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary hover:bg-gray-750 transition"
                    >
                      <option value="" className="bg-gray-800 text-gray-400">Chọn gói</option>
                      {filteredOrdersForCustomer
                        .filter((o) => o.email === selection.customer)
                        .map((o) => (
                          <option key={o._id} value={o._id} className="bg-gray-800 text-white">
                            {o.package} ({o.sessions} buổi còn lại)
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Thời gian */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Thời gian{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      {...register("time")}
                      min={currentYearStart}
                      className="w-full border border-gray-700 bg-gray-800 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary hover:bg-gray-750 transition"
                    />
                    {errors.time && (
                      <p className="text-red-500 text-xs">{errors.time.message}</p>
                    )}
                  </div>

                  {/* Nhóm cơ */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <Dumbbell className="w-4 h-4" /> Nhóm cơ{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative" ref={dropdownRef}>
                      <div
                        onClick={() =>
                          setIsMuscleDropdownOpen(!isMuscleDropdownOpen)
                        }
                        className="w-full border border-gray-700 bg-gray-800 text-white rounded-lg px-3 py-2 cursor-pointer flex justify-between items-center hover:bg-gray-750 transition"
                      >
                        <span className="text-white">
                          {selectedMuscles.length === 0
                            ? "Chọn nhóm cơ"
                            : `${selectedMuscles.length} nhóm đã chọn`}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isMuscleDropdownOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                      {isMuscleDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                          {muscles.map((muscle) => (
                            <label
                              key={muscle}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-750 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedMuscles.includes(muscle)}
                                onChange={() => toggleMuscle(muscle)}
                                className="rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary"
                              />
                              <span className="text-sm text-gray-200">
                                {muscle}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {errors.muscle && (
                      <p className="text-red-500 text-xs">
                        {errors.muscle.message}
                      </p>
                    )}
                    {selectedMuscles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedMuscles.map((m) => (
                          <span
                            key={m}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/20 text-primary border border-primary/30"
                          >
                            {m}
                            <button
                              type="button"
                              onClick={() => toggleMuscle(m)}
                              className="hover:text-red-400 transition-colors ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Có thể chọn nhiều nhóm cơ
                    </p>
                  </div>

                  {/* Ghi chú */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Ghi chú
                    </label>
                    <input
                      {...register("note")}
                      placeholder="Ghi chú thêm (nếu có)"
                      className="w-full border border-gray-700 bg-gray-800 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-fluid-sm placeholder-gray-500 hover:bg-gray-750 transition"
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={createCheckinMutation.isPending || isSubmitting}
                    className="relative px-6 py-2.5 rounded-lg font-medium text-white bg-linear-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {createCheckinMutation.isPending ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" /> Checkin buổi tập
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Hiển thị thông tin order đã chọn */}
            {selection.orderData && (
              <div className="bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary animate-pulse">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold text-white">
                        {selection.orderData.name}
                      </h3>
                      <span className="text-xs font-semibold bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full uppercase tracking-wider">
                        {selection.orderData.package}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-4 border-t border-gray-800/80 pt-4">
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Phone className="w-4 h-4 text-primary" />
                        <span>SĐT: <strong className="text-white">{selection.orderData.phone || "Chưa có"}</strong></span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Mail className="w-4 h-4 text-primary" />
                        <span>Email: <strong className="text-white">{selection.orderData.email}</strong></span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>Ngày đăng ký: <strong className="text-white">{new Date(selection.orderData.createdAt).toLocaleDateString("vi-VN")}</strong></span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Info className="w-4 h-4 text-primary" />
                        <span>Số buổi còn lại: <span className="font-extrabold text-primary bg-primary/15 border border-primary/30 px-3 py-0.5 rounded-full ml-1">{selection.orderData.sessions} buổi</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bảng lịch sử checkin */}
            <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
              <div className="px-6 py-5 border-b border-gray-800 bg-gray-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-white uppercase tracking-wider">LỊCH SỬ CHECK-IN</h3>
                </div>
                <span className="text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1 rounded-full">
                  {pagination.total} lượt
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/40 border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                        STT
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                        Tên
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                        Gói tập
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                        Thời gian
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                        Nhóm cơ
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                        Ghi chú
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wider text-xs">
                        Còn lại
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkins.map((c, i) => (
                      <tr
                        key={c._id}
                        className="border-t border-gray-850 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-4 text-gray-400 font-medium">
                          {(pagination.page - 1) * limit + i + 1}
                        </td>
                        <td className="px-4 py-4 font-semibold text-white">
                          {c.name}
                        </td>
                        <td className="px-4 py-4 text-gray-300">{c.package}</td>
                        <td className="px-4 py-4 text-gray-300 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          {new Date(c.time).toLocaleString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </td>
                        <td className="px-4 py-4 text-gray-300">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs font-medium text-white">
                            <Dumbbell className="w-3.5 h-3.5 text-primary" />{" "}
                            {c.muscle}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-400 max-w-xs truncate">
                          {c.note || "—"}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex justify-center px-3 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30">
                            {c.remainingSessions} buổi
                          </span>
                        </td>
                      </tr>
                    ))}
                    {checkins.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-gray-400"
                        >
                          Chưa có lượt check‑in nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 py-4 border-t border-gray-800 bg-gray-900/50">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page === 1}
                    className="p-2 rounded-lg border border-gray-700 text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-300">
                    Trang {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(pagination.totalPages, Number(p) + 1))
                    }
                    disabled={pagination.page === pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-700 text-gray-400 bg-gray-800 hover:bg-gray-700 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </phantom-ui>
    </>
  );
};

export default Checkin;
