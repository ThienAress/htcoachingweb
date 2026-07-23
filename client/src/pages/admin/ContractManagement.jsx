import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { FileText, Plus, Eye, Download, XCircle, CheckCircle, AlertTriangle, Trash2, Send, Edit3 } from "lucide-react";

import {
  getContracts,
  getApprovedOrders,
  createContract,
  cancelContract,
  downloadContract,
  deleteContractApi,
} from "../../services/contract.service";
import ContractEditModal from "./ContractEditModal";

const STATUS_MAP = {
  draft: { label: "Nháp", color: "bg-slate-100 text-slate-600", icon: Edit3 },
  sent: { label: "Đã gửi", color: "bg-blue-100 text-blue-700", icon: Send },
  viewed: { label: "Đã xem", color: "bg-indigo-100 text-indigo-700", icon: Eye },
  signed: { label: "Đã ký", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  expired: { label: "Hết hạn", color: "bg-slate-100 text-slate-500", icon: AlertTriangle },
  cancelled: { label: "Đã hủy", color: "bg-red-100 text-red-600", icon: XCircle },
};

const StatusBadge = ({ status }) => {
  const config = STATUS_MAP[status] || STATUS_MAP.draft;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />{config.label}
    </span>
  );
};

const ContractManagement = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingContract, setEditingContract] = useState(null);

  const { data: contractsData, isLoading } = useQuery({
    queryKey: ["contracts", statusFilter],
    queryFn: () => getContracts(statusFilter ? { status: statusFilter } : {}),
  });
  const contracts = contractsData?.data?.data || [];

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["approved-orders-for-contract"],
    queryFn: getApprovedOrders,
    enabled: showCreateModal,
  });
  const approvedOrders = ordersData?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: (orderId) => createContract(orderId),
    onSuccess: (res) => {
      toast.success("Tạo hợp đồng thành công!");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["approved-orders-for-contract"] });
      setShowCreateModal(false);
      const c = res.data?.data;
      if (c) setEditingContract(c);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi tạo hợp đồng"),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelContract(id),
    onSuccess: () => { toast.success("Đã hủy hợp đồng"); queryClient.invalidateQueries({ queryKey: ["contracts"] }); },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteContractApi(id),
    onSuccess: () => { toast.success("Đã xóa hợp đồng"); queryClient.invalidateQueries({ queryKey: ["contracts"] }); queryClient.invalidateQueries({ queryKey: ["approved-orders-for-contract"] }); },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi"),
  });

  const handleDownload = async (id) => {
    try {
      const res = await downloadContract(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `hop-dong-${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("Lỗi tải PDF"); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-7 h-7 text-emerald-600" /> Quản Lý Hợp Đồng
          </h1>
          <p className="text-sm text-slate-500 mt-1">Tạo, chỉnh sửa và gửi hợp đồng huấn luyện cá nhân</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-colors">
          <Plus className="w-4 h-4" /> Tạo Hợp Đồng
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[{ value: "", label: "Tất cả" }, { value: "draft", label: "Nháp" }, { value: "sent", label: "Đã gửi" }, { value: "viewed", label: "Đã xem" }, { value: "signed", label: "Đã ký" }, { value: "expired", label: "Hết hạn" }, { value: "cancelled", label: "Đã hủy" }].map((f) => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === f.value ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? <div className="text-center py-12 text-slate-500">Đang tải...</div> : contracts.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><FileText className="w-12 h-12 mx-auto mb-3 opacity-40" /><p>Chưa có hợp đồng nào</p></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Khách hàng</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">HLV</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Gói</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Trạng thái</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Ngày tạo</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Thao tác</th>
            </tr></thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3"><p className="font-medium text-slate-800">{c.clientInfo?.name}</p><p className="text-xs text-slate-400">{c.clientInfo?.email}</p></td>
                  <td className="px-4 py-3 text-slate-600">{c.trainerInfo?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.packageDetails?.packageName || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === "draft" && (
                        <button onClick={() => setEditingContract(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Chỉnh sửa & Gửi"><Edit3 className="w-4 h-4" /></button>
                      )}
                      {c.status === "signed" && (
                        <button onClick={() => handleDownload(c._id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Tải PDF"><Download className="w-4 h-4" /></button>
                      )}
                      {["draft", "sent", "viewed"].includes(c.status) && (
                        <button onClick={() => { if (confirm("Hủy hợp đồng này?")) cancelMutation.mutate(c._id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Hủy"><XCircle className="w-4 h-4" /></button>
                      )}
                      {["draft", "cancelled", "expired", "signed"].includes(c.status) && (
                        <button onClick={() => { if (confirm("Xóa vĩnh viễn hợp đồng này?")) deleteMutation.mutate(c._id); }} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 rounded-lg" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Tạo Hợp Đồng Mới</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-100 rounded-lg"><XCircle className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {ordersLoading ? <p className="text-center text-slate-500 py-8">Đang tải...</p> : approvedOrders.length === 0 ? (
                <div className="text-center py-8 text-slate-400"><FileText className="w-10 h-10 mx-auto mb-2 opacity-40" /><p>Không có đơn hàng chưa tạo HĐ</p></div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500 mb-3">Chọn đơn hàng đã xác nhận:</p>
                  {approvedOrders.map((order) => (
                    <div key={order._id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
                      <div>
                        <p className="font-medium text-slate-800">{order.name}</p>
                        <p className="text-xs text-slate-500">{order.package} • {order.sessions || order.totalSessions} buổi</p>
                      </div>
                      <button onClick={() => createMutation.mutate(order._id)} disabled={createMutation.isPending}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                        {createMutation.isPending ? "Đang tạo..." : "Tạo HĐ"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingContract && (
        <ContractEditModal
          key={editingContract._id}
          contract={editingContract}
          onClose={() => setEditingContract(null)}
        />
      )}
    </div>
  );
};

export default ContractManagement;
