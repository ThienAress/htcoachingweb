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
  Eye,
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

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
    (id) => approveOrderMutation.mutate(id),
    [approveOrderMutation],
  );
  const handleDelete = useCallback(
    (id) => {
      if (window.confirm("Xóa đơn này?")) deleteOrderMutation.mutate(id);
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

  const openDetail = (order) => {
    setSelectedOrder(order);
    setShowDetail(true);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("vi-VN");
  };

  if (isLoadingOrders) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-red-500">Lỗi tải dữ liệu: {error?.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="w-6 h-6 text-red-500" />
          Quản lý đơn hàng
        </h1>
        <p className="text-gray-500 mt-1">
          Quản lý và xử lý đơn hàng của khách hàng
        </p>
      </div>

      {/* Filter và Search */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 transition"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {user?.role === "admin" && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Tạo đơn mới
            </button>
          )}
          <Link
            to="/admin/create-trainer"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tạo Trainer
          </Link>
        </div>
      </div>

      {/* Card Grid */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {search ? "Không tìm thấy đơn hàng nào" : "Không có đơn hàng nào"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order) => (
              <div
                key={order._id}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-100"
              >
                {/* Header */}
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <User size={18} className="text-gray-600" />
                      <span className="font-semibold text-gray-800">
                        {order.name}
                      </span>
                    </div>
                    {order.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Check className="w-3 h-3" /> Đã xác nhận
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        <Clock className="w-3 h-3" /> Chờ xác nhận
                      </span>
                    )}
                  </div>
                </div>
                {/* Nội dung */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={16} />
                    <span className="truncate">{order.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={16} />
                    <span>{order.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package size={16} />
                    <span className="font-medium">{order.package}</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                      {order.sessions} buổi
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={16} />
                    <span>{order.gym}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar size={16} />
                    <span className="truncate">{order.schedule}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock size={16} />
                    <span>{formatDateTime(order.createdAt)}</span>
                  </div>
                  {order.trainerId && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User size={16} />
                      <span>Trainer: {order.trainerId.email}</span>
                    </div>
                  )}
                </div>
                {/* Hành động */}
                <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                  <button
                    onClick={() => openDetail(order)}
                    className="text-gray-600 hover:text-red-500 transition flex items-center gap-1 text-sm"
                  >
                    <Eye size={16} /> Chi tiết
                  </button>
                  <div className="flex gap-2">
                    {user?.role === "admin" && order.status === "pending" && (
                      <button
                        onClick={() => handleApprove(order._id)}
                        disabled={approveOrderMutation.isPending}
                        className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg"
                        title="Xác nhận"
                      >
                        <Check size={18} />
                      </button>
                    )}
                    {user?.role === "admin" && order.status === "approved" && (
                      <button
                        onClick={() => handleEdit(order)}
                        className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg"
                        title="Sửa"
                      >
                        <Edit size={18} />
                      </button>
                    )}
                    {user?.role === "admin" && (
                      <button
                        onClick={() => handleDelete(order._id)}
                        disabled={deleteOrderMutation.isPending}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Xóa"
                      >
                        <Trash size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
              >
                Trước
              </button>
              <span className="text-gray-600">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition"
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal chi tiết đơn hàng */}
      {showDetail && selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-red-500" /> Chi tiết đơn hàng
              </h2>
              <button
                onClick={() => setShowDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Họ tên
                  </label>
                  <p className="font-medium">{selectedOrder.name}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">SĐT</label>
                  <p>{selectedOrder.phone}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Email
                  </label>
                  <p>{selectedOrder.email}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Gói tập
                  </label>
                  <p>{selectedOrder.package}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Số buổi
                  </label>
                  <p>{selectedOrder.sessions}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Phòng tập
                  </label>
                  <p>{selectedOrder.gym}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase">
                    Lịch tập
                  </label>
                  <p>{selectedOrder.schedule}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-500 uppercase">
                    Ghi chú
                  </label>
                  <p>{selectedOrder.note || "—"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Trainer
                  </label>
                  <p>{selectedOrder.trainerId?.email || "—"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Trạng thái
                  </label>
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ml-2 ${selectedOrder.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                  >
                    {selectedOrder.status === "approved"
                      ? "Đã xác nhận"
                      : "Chờ xác nhận"}
                  </span>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">
                    Ngày tạo
                  </label>
                  <p>{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo/cập nhật đơn hàng (giữ nguyên logic) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? "Cập nhật đơn hàng" : "Tạo đơn hàng mới"}
              </h2>
              <button
                onClick={resetForm}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {/* Các trường input giữ nguyên như cũ */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4" /> Họ tên{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("name")}
                  placeholder="Nhập họ tên"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-400"
                />
                {errors.name && (
                  <p className="text-red-500 text-xs">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("email")}
                  placeholder="example@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Số điện thoại
                </label>
                <input
                  {...register("phone")}
                  placeholder="0901234567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    <Package className="w-4 h-4 inline mr-1" /> Gói tập{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("package")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                  <label className="text-sm font-medium text-gray-700">
                    <Calendar className="w-4 h-4 inline mr-1" /> Số buổi{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    {...register("sessions", { valueAsNumber: true })}
                    placeholder="Số buổi"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                  <label className="text-sm font-medium text-gray-700">
                    <MapPin className="w-4 h-4 inline mr-1" /> Phòng tập{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("gym")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                  <label className="text-sm font-medium text-gray-700">
                    <Clock className="w-4 h-4 inline mr-1" /> Thời gian{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("schedule")}
                    placeholder="VD: Sáng 8h-10h"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                  {errors.schedule && (
                    <p className="text-red-500 text-xs">
                      {errors.schedule.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  <FileText className="w-4 h-4 inline mr-1" /> Ghi chú
                </label>
                <textarea
                  {...register("note")}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              {user?.role === "admin" && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
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
              <div className="sticky bottom-0 bg-white border-t pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
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
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
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
