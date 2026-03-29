import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Search,
  Plus,
  Edit,
  Trash,
  Check,
  Clock,
  X,
  Package,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  getOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  approveOrder,
} from "../../services/order.service";
import { getTrainers } from "../../services/user.service";
import { useAuth } from "../../context/AuthContext";

const orderSchema = z.object({
  name: z.string().min(1, "Họ tên không được để trống"),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().optional(),
  package: z.string().min(1, "Vui lòng chọn gói tập"),
  sessions: z.number().min(1, "Số buổi phải lớn hơn 0"),
  gym: z.string().min(1, "Vui lòng chọn phòng tập"),
  schedule: z.string().min(1, "Vui lòng nhập thời gian tập"),
  note: z.string().optional(),
  trainerId: z.string().nullable(),
});

const Orders = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const {
    data: ordersData,
    isLoading: isLoadingOrders,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["orders", currentPage],
    queryFn: () => getOrders(currentPage).then((res) => res.data.data),
    keepPreviousData: true,
  });

  const orders = ordersData?.orders || [];
  const totalPages = ordersData?.totalPages || 1;

  const { data: trainersData } = useQuery({
    queryKey: ["trainers"],
    queryFn: () => getTrainers().then((res) => res.data.data),
    enabled: user?.role === "admin",
  });
  const trainers = trainersData || [];

  // Tối ưu: dùng useMemo để filter orders theo search
  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    return orders.filter((o) =>
      o.name?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [orders, search]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      package: "",
      sessions: "",
      gym: "",
      schedule: "",
      note: "",
      trainerId: "",
    },
  });

  const resetForm = useCallback(() => {
    reset({
      name: "",
      email: "",
      phone: "",
      package: "",
      sessions: "",
      gym: "",
      schedule: "",
      note: "",
      trainerId: "",
    });
    setEditingId(null);
    setShowModal(false);
  }, [reset]);

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Tạo đơn hàng thành công");
      resetForm();
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi hệ thống"),
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => updateOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Cập nhật đơn hàng thành công");
      resetForm();
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi hệ thống"),
  });

  const approveOrderMutation = useMutation({
    mutationFn: (id) => approveOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Đã xác nhận đơn hàng");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi xác nhận"),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Đã xóa đơn hàng");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const onSubmit = useCallback(
    (data) => {
      const submitData = { ...data, sessions: Number(data.sessions) };
      if (submitData.trainerId === "") submitData.trainerId = null;

      if (editingId) {
        updateOrderMutation.mutate({ id: editingId, data: submitData });
      } else {
        createOrderMutation.mutate(submitData);
      }
    },
    [editingId, updateOrderMutation, createOrderMutation],
  );

  const handleApprove = useCallback(
    (id) => {
      approveOrderMutation.mutate(id);
    },
    [approveOrderMutation],
  );

  const handleDelete = useCallback(
    (id) => {
      if (window.confirm("Xóa đơn này?")) {
        deleteOrderMutation.mutate(id);
      }
    },
    [deleteOrderMutation],
  );

  const handleEdit = useCallback(
    (order) => {
      setValue("name", order.name);
      setValue("email", order.email);
      setValue("phone", order.phone || "");
      setValue("package", order.package);
      setValue("sessions", order.sessions);
      setValue("gym", order.gym);
      setValue("schedule", order.schedule);
      setValue("note", order.note || "");
      setValue("trainerId", order.trainerId?._id || order.trainerId || "");
      setEditingId(order._id);
      setShowModal(true);
    },
    [setValue],
  );

  if (isLoadingOrders) {
    return (
      <div className="space-y-4 animate-pulse p-4">
        <div className="h-6 bg-gray-300 rounded w-1/3 md:w-1/4"></div>
        <div className="bg-white p-4 rounded shadow space-y-3">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-red-500">
        Lỗi tải dữ liệu: {error?.message}
        <button
          onClick={() => refetch()}
          className="ml-4 px-3 py-1 bg-blue-500 text-white rounded"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 h-full">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
            Quản lý đơn hàng
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý và xử lý đơn hàng của khách hàng
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user?.role === "admin" && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm md:text-base"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo đơn mới</span>
            </button>
          )}
          <Link
            to="/admin/create-trainer"
            className="px-3 py-2 md:px-4 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm md:text-base inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tạo Trainer
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          placeholder="Tìm kiếm theo tên khách hàng..."
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm md:text-base"
          onChange={(e) => setSearch(e.target.value)}
          value={search}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Họ tên
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Email
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  SĐT
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Gói
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Buổi
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Phòng
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Thời gian
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Trainer
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Trạng thái
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr
                  key={o._id}
                  className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-slate-700">
                    {o.name}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {o.email}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {o.phone}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {o.package}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {o.sessions}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {o.gym}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {o.schedule}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {o.trainerId ? o.trainerId.email : "—"}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    {o.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Check className="w-3 h-3" /> Đã xác nhận
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        <Clock className="w-3 h-3" /> Chờ xác nhận
                      </span>
                    )}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <div className="flex items-center gap-1 md:gap-2">
                      {user?.role === "admin" && o.status === "pending" && (
                        <button
                          onClick={() => handleApprove(o._id)}
                          disabled={approveOrderMutation.isPending}
                          className="p-1.5 text-green-600 rounded-lg hover:bg-green-50 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {user?.role === "admin" && o.status === "approved" && (
                        <button
                          onClick={() => handleEdit(o)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {user?.role === "admin" && (
                        <button
                          onClick={() => handleDelete(o._id)}
                          disabled={deleteOrderMutation.isPending}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 md:px-4 py-6 md:py-8 text-center text-slate-500"
                  >
                    {search
                      ? "Không tìm thấy đơn hàng nào."
                      : "Không có đơn hàng nào."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">
            Trang {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal tạo/cập nhật */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-slate-800">
                {editingId ? "Cập nhật đơn hàng" : "Tạo đơn hàng mới"}
              </h2>
              <button
                onClick={resetForm}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="p-4 md:p-6 space-y-4"
            >
              {/* Các trường input giữ nguyên như cũ */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4" /> Họ tên{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("name")}
                  placeholder="Nhập họ tên"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.name && (
                  <p className="text-red-500 text-xs">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("email")}
                  placeholder="example@email.com"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Số điện thoại
                </label>
                <input
                  {...register("phone")}
                  placeholder="0901234567"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Package className="w-4 h-4" /> Gói tập{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("package")}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">Chọn gói</option>
                    <option value="Trail(Trải nghiệm)">
                      Trail(Trải nghiệm)
                    </option>
                    <option value="Cơ Bản(1-1)">Cơ Bản(1-1)</option>
                    <option value="Nâng Cao(1-1)">Nâng Cao(1-1)</option>
                    <option value="Vip(1-1)">Vip(1-1)</option>
                    <option value="Cơ Bản(Online)">Cơ Bản(Online)</option>
                    <option value="Nâng Cao(Online)">Nâng Cao(Online)</option>
                    <option value="Vip(Online)">Vip(Online)</option>
                  </select>
                  {errors.package && (
                    <p className="text-red-500 text-xs">
                      {errors.package.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Số buổi{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    {...register("sessions", { valueAsNumber: true })}
                    placeholder="Số buổi"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                  {errors.sessions && (
                    <p className="text-red-500 text-xs">
                      {errors.sessions.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Phòng tập{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("gym")}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="">Chọn phòng</option>
                    <option value="Waystation Trương Văn Hải">
                      Waystation Trương Văn Hải
                    </option>
                    <option value="Waystation Dân chủ">
                      Waystation Dân chủ
                    </option>
                    <option value="Waystation Hiệp Bình">
                      Waystation Hiệp Bình
                    </option>
                    <option value="Chung cư Flora Novia">
                      Chung cư Flora Novia
                    </option>
                    <option value="Waystation Nguyễn Xí">
                      Waystation Nguyễn Xí
                    </option>
                  </select>
                  {errors.gym && (
                    <p className="text-red-500 text-xs">{errors.gym.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Thời gian{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("schedule")}
                    placeholder="VD: Sáng 8h-10h"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                  {errors.schedule && (
                    <p className="text-red-500 text-xs">
                      {errors.schedule.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Ghi chú
                </label>
                <textarea
                  {...register("note")}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              {user?.role === "admin" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Trainer phụ trách
                  </label>
                  <select
                    {...register("trainerId")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="">-- Không có trainer --</option>
                    {trainers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 md:px-6 py-3 md:py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-2 md:px-4 md:py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    createOrderMutation.isPending ||
                    updateOrderMutation.isPending ||
                    isFormSubmitting
                  }
                  className="px-3 py-2 md:px-4 md:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createOrderMutation.isPending ||
                  updateOrderMutation.isPending ||
                  isFormSubmitting
                    ? "Đang xử lý..."
                    : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
