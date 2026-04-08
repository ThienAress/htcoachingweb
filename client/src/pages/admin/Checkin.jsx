import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import HeaderMinimal from "../../sections/Header/HeaderMinimal";

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
  const [isMuscleDropdownOpen, setIsMuscleDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 5;

  // Fetch orders
  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders().then((res) => res.data.data.orders || []),
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

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6 animate-pulse">
        {/* skeleton loading giữ nguyên */}
        <div className="space-y-2">
          <div className="h-6 bg-gray-300 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded md:col-span-2"></div>
          </div>
          <div className="h-10 bg-gray-300 rounded w-32"></div>
        </div>
        <div className="space-y-3">
          {Array(5)
            .fill()
            .map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500">
        Lỗi tải dữ liệu, vui lòng thử lại.
      </div>
    );
  }

  return (
    <>
      <HeaderMinimal />
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="container-custom space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-primary" />
              CHECK-IN KHÁCH HÀNG
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Xác nhận buổi tập và ghi nhận lịch sử
            </p>
          </div>
          <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Tổng lượt check‑in: {pagination.total}
          </div>
        </div>

        {/* Form checkin */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Chọn khách hàng */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4" /> Khách hàng{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={selection.customer}
                  onChange={(e) =>
                    setSelection({
                      customer: e.target.value,
                      orderId: "",
                      orderData: null,
                    })
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Chọn khách hàng</option>
                  {customers.map((c) => (
                    <option key={c.email} value={c.email}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chọn gói tập */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Gói tập{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={selection.orderId}
                  onChange={(e) => handleSelectOrder(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Chọn gói</option>
                  {filteredOrdersForCustomer
                    .filter((o) => o.email === selection.customer)
                    .map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.package} ({o.sessions} buổi còn lại)
                      </option>
                    ))}
                </select>
              </div>

              {/* Thời gian */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Thời gian{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  {...register("time")}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.time && (
                  <p className="text-red-500 text-xs">{errors.time.message}</p>
                )}
              </div>

              {/* Nhóm cơ */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Dumbbell className="w-4 h-4" /> Nhóm cơ{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={dropdownRef}>
                  <div
                    onClick={() =>
                      setIsMuscleDropdownOpen(!isMuscleDropdownOpen)
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 cursor-pointer bg-white flex justify-between items-center"
                  >
                    <span>
                      {selectedMuscles.length === 0
                        ? "Chọn nhóm cơ"
                        : `${selectedMuscles.length} nhóm đã chọn`}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isMuscleDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                  {isMuscleDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {muscles.map((muscle) => (
                        <label
                          key={muscle}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMuscles.includes(muscle)}
                            onChange={() => toggleMuscle(muscle)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-primary"
                          />
                          <span className="text-sm text-slate-700">
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
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedMuscles.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                      >
                        {m}
                        <button
                          type="button"
                          onClick={() => toggleMuscle(m)}
                          className="hover:text-indigo-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Có thể chọn nhiều nhóm cơ
                </p>
              </div>

              {/* Ghi chú */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Ghi chú
                </label>
                <input
                  {...register("note")}
                  placeholder="Ghi chú thêm (nếu có)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
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
          <div className="bg-linear-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Package className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  {selection.orderData.name}
                  <span className="text-xs font-normal bg-indigo-100 text-primary px-2 py-0.5 rounded-full">
                    {selection.orderData.package}
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {selection.orderData.phone || "Chưa có"}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {selection.orderData.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Ngày đăng ký:{" "}
                    {new Date(selection.orderData.createdAt).toLocaleDateString(
                      "vi-VN",
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Info className="w-4 h-4 text-slate-400" />
                    Số buổi còn lại:{" "}
                    <span className="font-bold text-primary bg-indigo-100 px-2 py-0.5 rounded-full">
                      {selection.orderData.sessions}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bảng lịch sử checkin */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800">LỊCH SỬ CHECK-IN</h3>
            </div>
            <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full shadow-sm">
              {pagination.total} lượt
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    STT
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Tên
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Gói tập
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Thời gian
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Nhóm cơ
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Ghi chú
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    Còn lại
                  </th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c, i) => (
                  <tr
                    key={c._id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-500">
                      {(pagination.page - 1) * limit + i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.package}</td>
                    <td className="px-4 py-3 text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(c.time).toLocaleString("vi-VN", {
                        hour12: false,
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Dumbbell className="w-3.5 h-3.5 text-slate-400" />{" "}
                        {c.muscle}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {c.note || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex justify-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {c.remainingSessions} buổi
                      </span>
                    </td>
                  </tr>
                ))}
                {checkins.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Chưa có lượt check‑in nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Checkin;
