import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateByKey } from "../../queries/invalidation";
import { adminQueryKeys } from "../../queries/queryKeys";
import { toast } from "react-toastify";
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
import { createContract } from "../../services/contract.service";
import { getTrainerAssignmentCandidates } from "../../services/trainerAssignment.service";
import { getOrderStatusMeta } from "../../constants/orderStatus";
import { useAuth } from "../../context/AuthContext";
import { useConversionOriginOptions } from "../../hooks/useConversionOriginOptions";
import ConversionOriginFields from "../../components/admin/ConversionOriginFields";

const orderSchema = z
  .object({
    name: z.string().min(1, "Họ tên không được để trống"),
    email: z.string().email("Email không hợp lệ"),
    phone: z.string().optional(),
    package: z.string().min(1, "Vui lòng chọn gói tập"),
    sessions: z.number().min(1, "Số buổi phải lớn hơn 0"),
    gym: z.string().min(1, "Vui lòng chọn phòng tập"),
    schedule: z.string().min(1, "Vui lòng nhập thời gian tập"),
    note: z.string().optional(),
    trainerId: z.string().nullable(),
    originType: z.enum(["", "booking", "contact"]).optional(),
    originId: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.originType && !value.originId) {
      context.addIssue({
        code: "custom",
        path: ["originId"],
        message: "Vui lòng chọn đúng bản ghi nguồn",
      });
    }
  });
const ORDER_STATUS_ICONS = {
  pending: Clock,
  approved: Check,
  completed: Check,
  cancelled: X,
};

const OrderStatusBadge = ({ status, className = "" }) => {
  const meta = getOrderStatusMeta(status);
  const Icon = ORDER_STATUS_ICONS[status] || Clock;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${meta.badgeClass} ${className}`}><Icon className="h-3 w-3" />{meta.label}</span>;
};


const Orders = ({ embedded = false }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const orderScope = isAdmin ? "admin" : user?._id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [editingTrainerId, setEditingTrainerId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [createdContractOrderIds, setCreatedContractOrderIds] = useState(new Set());
  const [contractOrderTarget, setContractOrderTarget] = useState(null);
  const conversionOrigins = useConversionOriginOptions(
    isAdmin && showModal && !editingId,
  );

  const {
    data: ordersData,
    isLoading: isLoadingOrders,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: adminQueryKeys.orders.list({
      scope: orderScope,
      page: currentPage,
      limit: 6,
    }),
    queryFn: () => getOrders(currentPage, 6).then((res) => res.data.data),
    placeholderData: keepPreviousData,
  });

  const totalPages = ordersData?.totalPages || 1;

  const {
    data: trainersData,
    isLoading: trainersLoading,
    isError: trainersError,
    refetch: refetchTrainers,
  } = useQuery({
    queryKey: ["trainer-assignment-candidates"],
    queryFn: () => getTrainerAssignmentCandidates().then((res) => res.data.data.trainers),
    enabled: isAdmin,
  });
  const trainers = trainersData || [];

  const filteredOrders = useMemo(() => {
    const orders = ordersData?.orders || [];
    if (!search) return orders;
    return orders.filter((o) =>
      o.name?.toLowerCase().includes(search.toLowerCase()),
    );
  }, [ordersData?.orders, search]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
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
      originType: "",
      originId: "",
    },
  });
  const originType = useWatch({ control, name: "originType" }) || "";
  const originId = useWatch({ control, name: "originId" }) || "";
  const currentPackage = useWatch({ control, name: "package" }) || "";
  const isTrainerEditingApproved =
    !isAdmin && editingStatus === "approved";

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
      originType: "",
      originId: "",
    });
    setEditingId(null);
    setEditingStatus(null);
    setEditingTrainerId(null);
    setShowModal(false);
  }, [reset]);

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      invalidateByKey(queryClient, adminQueryKeys.orders.all());
      toast.success("Tạo đơn hàng thành công");
      resetForm();
    },
    onError: (err) =>
      toast.error(
        err.response?.data?.message ||
          err.response?.data?.errors?.[0]?.msg ||
          "Lỗi hệ thống",
      ),
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }) => updateOrder(id, data),
    onSuccess: () => {
      invalidateByKey(queryClient, adminQueryKeys.orders.all());
      toast.success("Cập nhật đơn hàng thành công");
      resetForm();
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi hệ thống"),
  });

  const approveOrderMutation = useMutation({
    mutationFn: (id) => approveOrder(id),
    onSuccess: () => {
      invalidateByKey(queryClient, adminQueryKeys.orders.all());
      toast.success("Đã xác nhận đơn hàng");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi xác nhận"),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id) => deleteOrder(id),
    onSuccess: () => {
      invalidateByKey(queryClient, adminQueryKeys.orders.all());
      toast.success("Đã xóa đơn hàng");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const createContractMutation = useMutation({
    mutationFn: (orderId) => createContract(orderId),
    onSuccess: (_, orderId) => {
      setCreatedContractOrderIds((prev) => new Set(prev).add(orderId));
      toast.success("Tạo hợp đồng thành công!");
      navigate(isAdmin ? "/admin/contracts" : "/trainer/contracts");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi tạo hợp đồng"),
  });

  const onSubmit = useCallback(
    (data) => {
      let submitData = { ...data, sessions: Number(data.sessions) };
      if (isTrainerEditingApproved) {
        const safeApprovedUpdate = { ...submitData };
        delete safeApprovedUpdate.email;
        delete safeApprovedUpdate.package;
        delete safeApprovedUpdate.sessions;
        submitData = safeApprovedUpdate;
      }
      if (submitData.trainerId === "") submitData.trainerId = null;
      if (editingId) {
        updateOrderMutation.mutate({ id: editingId, data: submitData });
      } else {
        createOrderMutation.mutate(submitData);
      }
    },
    [
      editingId,
      isTrainerEditingApproved,
      updateOrderMutation,
      createOrderMutation,
    ],
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
      setValue("originType", "");
      setValue("originId", "");
      setEditingId(order._id);
      setEditingStatus(order.status);
      setEditingTrainerId(order.trainerId?._id || order.trainerId || null);
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
    return new Date(dateString).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  };

  if (isError) {
    return (
      <div
        className={
          embedded ? "bg-gray-50" : "min-h-screen bg-gray-50 p-4 md:p-6"
        }
      >
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-red-500">Lỗi tải dữ liệu: {error?.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 min-h-11 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <phantom-ui loading={isLoadingOrders || undefined}>
      <div
        className={
          embedded ? "bg-gray-50" : "min-h-screen bg-gray-50 p-4 md:p-6"
        }
      >

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-fluid-2xl font-bold text-gray-800 flex items-center gap-2 uppercase">
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
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-white transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" /> Tạo đơn mới
            </button>
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
                  <div
                    className={`px-4 py-3 border-b ${getOrderStatusMeta(order.status).headerClass}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <User size={18} className="text-gray-600" />
                        <span className="font-semibold text-gray-800">
                          {order.name}
                        </span>
                      </div>
                      <OrderStatusBadge status={order.status} />
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
                    {isAdmin && order.trainerId && (
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
                      className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-gray-600 transition hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                      <Eye size={16} /> Chi tiết
                    </button>
                    <div className="flex gap-2">
                      {isAdmin && order.status === "pending" && (
                        <button
                          onClick={() => handleApprove(order._id)}
                          disabled={approveOrderMutation.isPending}
                          className="inline-flex size-11 items-center justify-center rounded-lg text-green-600 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 disabled:opacity-50"
                          title="Xác nhận"
                          aria-label="Xác nhận đơn hàng"
                        >
                          <Check size={18} />
                        </button>
                      )}
                      {(order.status === "approved" ||
                        (!isAdmin && order.status === "pending")) && (
                        <button
                          onClick={() => handleEdit(order)}
                          className="inline-flex size-11 items-center justify-center rounded-lg text-purple-600 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                          title="Sửa"
                          aria-label="Sửa đơn hàng"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                      {order.status === "approved" && (
                        <button
                          onClick={() => setContractOrderTarget(order)}
                          disabled={createContractMutation.isPending || createdContractOrderIds.has(order._id)}
                          className={`inline-flex size-11 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${createdContractOrderIds.has(order._id) ? "text-gray-300 cursor-not-allowed" : "text-emerald-600 hover:bg-emerald-50"}`}
                          title={createdContractOrderIds.has(order._id) ? "Đã tạo HĐ" : "Tạo hợp đồng"}
                          aria-label={createdContractOrderIds.has(order._id) ? "Đã tạo hợp đồng" : "Tạo hợp đồng"}
                        >
                          <FileText size={18} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(order._id)}
                          disabled={deleteOrderMutation.isPending}
                          className="inline-flex size-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50"
                          title="Xóa"
                          aria-label="Xóa đơn hàng"
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
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 uppercase">
                  <Package className="w-5 h-5 text-red-500" /> Chi tiết đơn hàng
                </h2>
                <button
                  onClick={() => setShowDetail(false)}
                  className="inline-flex size-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  aria-label="Đóng chi tiết đơn hàng"
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
                    <OrderStatusBadge status={selectedOrder.status} className="ml-2" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">
                      Ngày tạo
                    </label>
                    <p>{formatDateTime(selectedOrder.createdAt)}</p>
                  </div>
                </div>
              </div>
              <div className="border-t px-6 py-4 flex justify-end gap-3">
                {selectedOrder.status === "approved" && (
                  <button
                    onClick={() => {
                      setContractOrderTarget(selectedOrder);
                      setShowDetail(false);
                    }}
                    disabled={createContractMutation.isPending || createdContractOrderIds.has(selectedOrder._id)}
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    {createdContractOrderIds.has(selectedOrder._id) ? "Đã tạo HĐ" : "Tạo Hợp Đồng"}
                  </button>
                )}
                <button
                  onClick={() => setShowDetail(false)}
                  className="min-h-11 rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
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
                <h2 className="text-xl font-bold text-gray-800 uppercase">
                  {editingId ? "Cập nhật đơn hàng" : "Tạo đơn hàng mới"}
                </h2>
                <button
                  type="button"
                  onClick={resetForm}
                  aria-label="Đóng biểu mẫu đơn hàng"
                  className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                {isTrainerEditingApproved && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Đơn đã được duyệt. Gói tập, email và số buổi do admin quản lý;
                    bạn vẫn có thể cập nhật thông tin vận hành bên dưới.
                  </p>
                )}
                {/* Các trường input giữ nguyên như cũ */}
                <div className="space-y-1">
                  <label htmlFor="order-name" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4" /> Họ tên{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="order-name"
                    {...register("name")}
                    placeholder="Nhập họ tên"
                    className="min-h-11 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-400"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label htmlFor="order-email" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="order-email"
                    {...register("email")}
                    readOnly={isTrainerEditingApproved}
                    placeholder="example@email.com"
                    className="min-h-11 w-full border border-gray-300 rounded-lg px-3 py-2 read-only:cursor-not-allowed read-only:bg-gray-100"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label htmlFor="order-phone" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Số điện thoại
                  </label>
                  <input
                    id="order-phone"
                    {...register("phone")}
                    placeholder="0901234567"
                    className="min-h-11 w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="order-package" className="text-sm font-medium text-gray-700">
                      <Package className="w-4 h-4 inline mr-1" /> Gói tập{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    {isTrainerEditingApproved ? (
                      <>
                        <input type="hidden" {...register("package")} />
                        <p className="flex min-h-11 items-center rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700">
                          {currentPackage}
                        </p>
                      </>
                    ) : (
                      <select
                        id="order-package"
                        {...register("package")}
                        className="min-h-11 w-full border border-gray-300 rounded-lg px-3 py-2"
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
                    )}
                    {errors.package && (
                      <p className="text-red-500 text-xs">
                        {errors.package.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="order-sessions" className="text-sm font-medium text-gray-700">
                      <Calendar className="w-4 h-4 inline mr-1" /> Số buổi{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="order-sessions"
                      type="number"
                      {...register("sessions", { valueAsNumber: true })}
                      readOnly={isTrainerEditingApproved}
                      placeholder="Số buổi"
                      className="min-h-11 w-full border border-gray-300 rounded-lg px-3 py-2 read-only:cursor-not-allowed read-only:bg-gray-100"
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
                    <label htmlFor="order-gym" className="text-sm font-medium text-gray-700">
                      <MapPin className="w-4 h-4 inline mr-1" /> Phòng tập{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="order-gym"
                      {...register("gym")}
                      className="min-h-11 w-full border border-gray-300 rounded-lg px-3 py-2"
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
                      <option value="Waystation Nguyễn Xí">
                        Waystation Nguyễn Xí
                      </option>
                      <option value="Waystation Ung Văn Khiêm">
                        Waystation Ung Văn Khiêm
                      </option>
                      <option value="Waystation Trần Thị Điệu">
                        Waystation Trần Thị Điệu
                      </option>
                      <option value="Chung cư Flora Novia">
                        Chung cư Flora Novia
                      </option>
                      <option value="Chung cư Flora Novia">
                        Chung cư Phú Đông Sky Garden
                      </option>
                      <option value="Home gym">
                        Home gym
                      </option>
                    </select>
                    {errors.gym && (
                      <p className="text-red-500 text-xs">{errors.gym.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="order-schedule" className="text-sm font-medium text-gray-700">
                      <Clock className="w-4 h-4 inline mr-1" /> Thời gian{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="order-schedule"
                      {...register("schedule")}
                      placeholder="VD: Sáng 8h-10h"
                      className="min-h-11 w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                    {errors.schedule && (
                      <p className="text-red-500 text-xs">
                        {errors.schedule.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="order-note" className="text-sm font-medium text-gray-700">
                    <FileText className="w-4 h-4 inline mr-1" /> Ghi chú
                  </label>
                  <textarea
                    id="order-note"
                    {...register("note")}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                {!editingId && isAdmin && (
                  <ConversionOriginFields
                    originType={originType}
                    originId={originId}
                    onTypeChange={(value) =>
                      setValue("originType", value, { shouldValidate: true })
                    }
                    onIdChange={(value) =>
                      setValue("originId", value, { shouldValidate: true })
                    }
                    bookings={conversionOrigins.bookings}
                    contacts={conversionOrigins.contacts}
                    isLoading={conversionOrigins.isLoading}
                    isError={conversionOrigins.isError}
                    onRetry={conversionOrigins.retry}
                    error={errors.originId?.message}
                  />
                )}
                {isAdmin && (
                  <div>
                    <label htmlFor="order-trainer" className="text-sm font-medium text-gray-700">
                      Trainer phụ trách
                    </label>
                    <select
                      id="order-trainer"
                      {...register("trainerId")}
                      className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2"
                      disabled={Boolean(editingId && editingTrainerId) || trainersLoading || trainersError}
                    >
                      <option value="">-- Không có trainer --</option>
                      {trainers.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name} ({t.email})
                        </option>
                      ))}
                    </select>
                    {editingId && editingTrainerId && (
                      <p className="mt-2 text-xs text-amber-700">
                        Đổi HLV được thực hiện tại mục Điều phối HLV để có bước
                        xem trước và nhật ký chuyển giao.
                      </p>
                    )}
                    {trainersError && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                        <span>Không thể tải danh sách HLV.</span>
                        <button
                          type="button"
                          onClick={() => refetchTrainers()}
                          className="min-h-11 rounded px-3 py-2 font-semibold hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                          Thử lại
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="sticky bottom-0 bg-white border-t pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
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
                    className="min-h-11 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

        {/* Modal xác nhận tạo hợp đồng */}
        {contractOrderTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="p-6 text-center">
                <FileText className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-2">Tạo Hợp Đồng</h3>
                <p className="text-sm text-slate-500 mb-1">Bạn muốn tạo hợp đồng cho đơn hàng này?</p>
                <div className="bg-slate-50 rounded-xl p-3 mt-3 text-left text-sm">
                  <p><strong>Khách hàng:</strong> {contractOrderTarget.name}</p>
                  <p><strong>Gói:</strong> {contractOrderTarget.package}</p>
                  <p><strong>Số buổi:</strong> {contractOrderTarget.sessions || contractOrderTarget.totalSessions}</p>
                </div>
              </div>
              <div className="border-t px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => setContractOrderTarget(null)}
                  className="min-h-11 rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    createContractMutation.mutate(contractOrderTarget._id);
                    setContractOrderTarget(null);
                  }}
                  disabled={createContractMutation.isPending}
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  Xác nhận tạo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </phantom-ui>
  );
};

export default Orders;
