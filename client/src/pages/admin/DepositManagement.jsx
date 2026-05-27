import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  Search,
  Check,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wallet,
  User,
  Filter,
  Trash2,
} from "lucide-react";

import {
  getAdminDeposits,
  approveDeposit,
  rejectDeposit,
  deleteAdminDeposit,
} from "../../services/adminDeposit.service";

const formatVND = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString("vi-VN") : "—";

const statusConfig = {
  pending: { label: "Đang chờ", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  success: { label: "Đã duyệt", color: "bg-green-100 text-green-700", icon: CheckCircle },
  expired: { label: "Hết hạn", color: "bg-gray-100 text-gray-600", icon: XCircle },
  rejected: { label: "Từ chối", color: "bg-red-100 text-red-600", icon: XCircle },
  needs_review: { label: "Cần xem", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
};

const DepositManagement = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-deposits", statusFilter],
    queryFn: () => getAdminDeposits(statusFilter).then((r) => r.data.data),
  });

  const deposits = data || [];

  const filteredDeposits = useMemo(() => {
    if (!search) return deposits;
    return deposits.filter(
      (d) =>
        d.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.userId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        d.depositCode?.toLowerCase().includes(search.toLowerCase())
    );
  }, [deposits, search]);

  const approveMutation = useMutation({
    mutationFn: (id) => approveDeposit(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-deposits"] });
      toast.success(res.data.message);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi duyệt"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => rejectDeposit(id, reason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-deposits"] });
      toast.success(res.data.message);
      setRejectModal(null);
      setRejectReason("");
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi từ chối"),
  });

  const handleApprove = (deposit) => {
    if (
      window.confirm(
        `Xác nhận duyệt nạp ${formatVND(deposit.amount)} cho ${deposit.userId?.name || "user"}?`
      )
    ) {
      approveMutation.mutate(deposit._id);
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectModal) return;
    rejectMutation.mutate({ id: rejectModal._id, reason: rejectReason });
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAdminDeposit(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-deposits"] });
      toast.success(res.data.message);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const handleDelete = (deposit) => {
    if (
      window.confirm(
        `Xác nhận xóa yêu cầu nạp ${formatVND(deposit.amount)} của ${deposit.userId?.name || "user"}?`
      )
    ) {
      deleteMutation.mutate(deposit._id);
    }
  };

  const statusTabs = [
    { value: "all", label: "Tất cả" },
    { value: "pending", label: "Đang chờ" },
    { value: "needs_review", label: "Cần xem lại" },
    { value: "success", label: "Đã duyệt" },
    { value: "expired", label: "Hết hạn" },
    { value: "rejected", label: "Từ chối" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-red-500" />
          Quản lý nạp tiền
        </h1>
        <p className="text-gray-500 mt-1">
          Duyệt / Từ chối yêu cầu nạp tiền của người dùng
        </p>
      </div>

      {/* Filter tabs + Search */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
        <div className="flex gap-2 flex-wrap">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                statusFilter === tab.value
                  ? "border-red-500 bg-red-50 text-red-600"
                  : "border-gray-300 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, mã nạp..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Cards */}
      {filteredDeposits.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Không có yêu cầu nạp tiền nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDeposits.map((deposit) => {
            const cfg = statusConfig[deposit.status] || statusConfig.pending;
            const Icon = cfg.icon;
            return (
              <div
                key={deposit._id}
                className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition"
              >
                {/* Card header */}
                <div
                  className={`px-4 py-3 border-b flex justify-between items-center ${
                    deposit.status === "pending"
                      ? "bg-yellow-50"
                      : deposit.status === "success"
                      ? "bg-green-50"
                      : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-500" />
                    <span className="font-semibold text-gray-800 text-sm">
                      {deposit.userId?.name || "—"}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}
                  >
                    <Icon className="w-3 h-3" /> {cfg.label}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Số tiền</span>
                    <span className="font-bold text-red-500 text-base">
                      {formatVND(deposit.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mã nạp</span>
                    <span className="font-mono font-semibold text-gray-700">
                      {deposit.depositCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-600 truncate max-w-[180px]">
                      {deposit.userId?.email || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tạo lúc</span>
                    <span className="text-gray-600">{formatDateTime(deposit.createdAt)}</span>
                  </div>
                  {deposit.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Duyệt lúc</span>
                      <span className="text-green-600">{formatDateTime(deposit.paidAt)}</span>
                    </div>
                  )}
                  {deposit.approvedBy && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Duyệt bởi</span>
                      <span className="text-gray-600">{deposit.approvedBy?.name || "Admin"}</span>
                    </div>
                  )}
                  {deposit.rejectReason && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-red-600 text-xs">
                      Lý do: {deposit.rejectReason}
                    </div>
                  )}
                </div>

                {/* Card actions */}
                <div className="px-4 py-3 bg-gray-50 border-t flex justify-end gap-2">
                  {["pending", "needs_review", "expired"].includes(deposit.status) && (
                    <>
                      <button
                        onClick={() => handleApprove(deposit)}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Duyệt
                      </button>
                      <button
                        onClick={() => {
                          setRejectModal(deposit);
                          setRejectReason("");
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition"
                      >
                        <X className="w-4 h-4" /> Từ chối
                      </button>
                    </>
                  )}
                  {deposit.status !== "success" && (
                    <button
                      onClick={() => handleDelete(deposit)}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Xóa
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal từ chối */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">
              Từ chối nạp tiền
            </h3>
            <p className="text-sm text-gray-600">
              Từ chối yêu cầu nạp{" "}
              <strong className="text-red-500">{formatVND(rejectModal.amount)}</strong>{" "}
              của <strong>{rejectModal.userId?.name}</strong>?
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Lý do từ chối (tuỳ chọn)..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={rejectMutation.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {rejectMutation.isPending ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepositManagement;
