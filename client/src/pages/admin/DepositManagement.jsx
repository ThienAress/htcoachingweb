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
  Trash2,
  RotateCcw,
  Landmark,
  Save,
  Settings2,
} from "lucide-react";
import IncomingBankTransactionPanel from "./IncomingBankTransactionPanel";
import {
  buildDepositApprovalConfirmation,
  formatVND,
} from "./depositAdmin.ui";

import {
  getAdminDeposits,
  approveDeposit,
  rejectDeposit,
  reverseDeposit,
  deleteAdminDeposit,
  getAdminDepositPolicy,
  updateAdminDepositPolicy,
} from "../../services/adminDeposit.service";
import {
  normalizeDepositPolicyResponse,
  parseDepositBonusRateDraft,
} from "../../utils/depositPolicy";
import { invalidateDepositPolicy } from "../../queries/walletAccount.queries";

const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

const statusConfig = {
  pending: { label: "Đang chờ", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  success: { label: "Đã duyệt", color: "bg-green-100 text-green-700", icon: CheckCircle },
  expired: { label: "Hết hạn", color: "bg-gray-100 text-gray-600", icon: XCircle },
  rejected: { label: "Từ chối", color: "bg-red-100 text-red-600", icon: XCircle },
  needs_review: { label: "Cần xem", color: "bg-orange-100 text-orange-700", icon: AlertTriangle },
  reversed: { label: "Đã hoàn tác", color: "bg-blue-100 text-blue-700", icon: RotateCcw },
};

const WorkspaceSwitch = ({ value, onChange }) => (
  <div className="mb-6 inline-flex rounded-lg border border-gray-300 bg-white p-1" role="group" aria-label="Loại dữ liệu nạp tiền">
    {[
      { value: "requests", label: "Yêu cầu nạp", icon: Wallet },
      { value: "incoming", label: "Giao dịch ngân hàng", icon: Landmark },
    ].map((option) => {
      const Icon = option.icon;
      return (
        <button
          type="button"
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            value === option.value
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {option.label}
        </button>
      );
    })}
  </div>
);

const DepositPolicyEditor = () => {
  const queryClient = useQueryClient();
  const [rates, setRates] = useState(null);
  const policyQuery = useQuery({
    queryKey: ["admin-deposit-policy"],
    queryFn: ({ signal }) =>
      getAdminDepositPolicy({ signal }).then(normalizeDepositPolicyResponse),
  });

  const draftRates =
    rates ||
    (policyQuery.data
      ? Object.fromEntries(
          policyQuery.data.tiers.map((tier) => [tier.key, String(tier.bonusRate)]),
        )
      : { starter: "", growth: "", premium: "" });
  const parsedRates = Object.fromEntries(
    Object.entries(draftRates).map(([key, value]) => [
      key,
      parseDepositBonusRateDraft(value),
    ]),
  );
  const values = [parsedRates.starter, parsedRates.growth, parsedRates.premium];
  const ratesValid =
    values.every(
      (value) => value !== null,
    ) &&
    parsedRates.starter <= parsedRates.growth &&
    parsedRates.growth <= parsedRates.premium;
  const originalRates = policyQuery.data
    ? Object.fromEntries(
        policyQuery.data.tiers.map((tier) => [tier.key, tier.bonusRate]),
      )
    : null;
  const changed = Boolean(
    originalRates &&
      Object.keys(parsedRates).some(
        (key) => parsedRates[key] !== originalRates[key],
      ),
  );

  const updateMutation = useMutation({
    mutationFn: () => updateAdminDepositPolicy(parsedRates),
    onSuccess: async (response) => {
      queryClient.setQueryData(
        ["admin-deposit-policy"],
        normalizeDepositPolicyResponse(response),
      );
      setRates(null);
      await invalidateDepositPolicy(queryClient);
      toast.success(response.data.message);
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Không thể cập nhật tỷ lệ thưởng",
      ),
  });

  if (policyQuery.isPending) {
    return (
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6" role="status">
        <p className="text-sm text-gray-500">Đang tải chính sách thưởng...</p>
      </section>
    );
  }
  if (policyQuery.isError || !policyQuery.data) {
    return (
      <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
        <p className="text-sm text-red-700">Không thể tải chính sách thưởng nạp tiền.</p>
        <button
          type="button"
          onClick={() => policyQuery.refetch()}
          className="mt-3 min-h-11 rounded-lg border border-red-300 px-4 text-sm font-bold text-red-700 transition-colors duration-200 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Thử lại
        </button>
      </section>
    );
  }

  const labels = Object.fromEntries(
    policyQuery.data.tiers.map((tier) => [
      tier.key,
      `Bậc ${formatVND(tier.minAmount)}`,
    ]),
  );
  return (
    <section aria-labelledby="deposit-policy-heading" className="mb-6 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="deposit-policy-heading" className="flex items-center gap-2 text-lg font-black text-gray-900">
            <Settings2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Tỷ lệ thưởng nạp ví
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
            Cập nhật đồng thời cả ba tỷ lệ. Thay đổi chỉ áp dụng cho hóa đơn tạo sau khi lưu; hóa đơn hiện có giữ nguyên quyền lợi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => updateMutation.mutate()}
          disabled={!ratesValid || !changed || updateMutation.isPending}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition-[background-color,box-shadow] duration-200 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {updateMutation.isPending ? "Đang lưu..." : "Lưu tỷ lệ"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {policyQuery.data.tiers.map((tier) => (
          <label
            key={tier.key}
            className={`rounded-xl border p-4 ${
              tier.key === "premium"
                ? "border-emerald-300 bg-emerald-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <span className="block text-sm font-bold text-gray-800">
              {labels[tier.key]}
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              Tối đa {formatVND(policyQuery.data.maxAmount)}
            </span>
            <span className="mt-4 flex items-center rounded-lg border border-gray-300 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
              <input
                type="number"
                name={`depositBonusRate-${tier.key}`}
                min="0"
                max="100"
                step="1"
                value={draftRates[tier.key]}
                onChange={(event) =>
                  setRates((current) => ({
                    ...(current || draftRates),
                    [tier.key]: event.target.value,
                  }))
                }
                aria-label={`Tỷ lệ thưởng ${labels[tier.key]}`}
                className="min-h-11 w-full rounded-l-lg px-3 text-lg font-black text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
              />
              <span className="px-3 font-bold text-emerald-700">%</span>
            </span>
          </label>
        ))}
      </div>
      {!ratesValid && (
        <p className="mt-3 text-sm font-medium text-red-600" role="alert">
          Nhập số nguyên từ 0–100 và bảo đảm tỷ lệ không giảm ở bậc tiền cao hơn.
        </p>
      )}
    </section>
  );
};

const DepositManagement = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [workspace, setWorkspace] = useState("requests");
  const [search, setSearch] = useState("");
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reverseModal, setReverseModal] = useState(null);
  const [reverseReason, setReverseReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-deposits", statusFilter],
    queryFn: () => getAdminDeposits(statusFilter).then((r) => r.data.data),
  });

  const filteredDeposits = useMemo(() => {
    const deposits = data || [];
    if (!search) return deposits;
    return deposits.filter(
      (d) =>
        d.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.userId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        d.depositCode?.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

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
    if (window.confirm(buildDepositApprovalConfirmation(deposit))) {
      approveMutation.mutate(deposit._id);
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectModal) return;
    rejectMutation.mutate({ id: rejectModal._id, reason: rejectReason });
  };

  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }) => reverseDeposit(id, reason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-deposits"] });
      toast.success(res.data.message);
      setReverseModal(null);
      setReverseReason("");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi hoàn tác giao dịch"),
  });

  const handleReverseSubmit = () => {
    if (!reverseModal || reverseReason.trim().length < 8) return;
    reverseMutation.mutate({
      id: reverseModal._id,
      reason: reverseReason.trim(),
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAdminDeposit(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-deposits"] });
      toast.success("Đã xóa");
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
    { value: "reversed", label: "Đã hoàn tác" },
  ];

  if (workspace === "incoming") {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-fluid-2xl font-bold uppercase text-gray-800">
            <Wallet className="h-6 w-6 text-red-500" />
            Quản lý nạp tiền
          </h1>
          <p className="mt-1 text-gray-500">
            Đối soát giao dịch ngân hàng và xử lý trường hợp cần xem lại
          </p>
        </div>
        <DepositPolicyEditor />
        <WorkspaceSwitch value={workspace} onChange={setWorkspace} />
        <IncomingBankTransactionPanel />
      </div>
    );
  }

  return (
    <phantom-ui loading={isLoading || undefined}>
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-fluid-2xl font-bold text-gray-800 flex items-center gap-2 uppercase">
          <Wallet className="w-6 h-6 text-red-500" />
          Quản lý nạp tiền
        </h1>
        <p className="text-gray-500 mt-1">
          Duyệt / Từ chối yêu cầu nạp tiền của người dùng
        </p>
      </div>

      <DepositPolicyEditor />

      <WorkspaceSwitch value={workspace} onChange={setWorkspace} />

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
                    <span className="text-gray-500">Tiền thưởng</span>
                    <span className="font-semibold text-amber-600">
                      +{formatVND(deposit.bonusAmount || 0)} ({deposit.bonusRate || 0}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tổng cộng ví</span>
                    <span className="font-bold text-emerald-700">
                      {formatVND(deposit.creditedAmount || deposit.amount)}
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
                  {deposit.reverseReason && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-blue-700 text-xs space-y-1">
                      <p>Lý do hoàn tác: {deposit.reverseReason}</p>
                      <p>
                        {formatDateTime(deposit.reversedAt)} bởi{" "}
                        {deposit.reversedBy?.name || "Admin"}
                      </p>
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
                  {deposit.status === "success" && (
                    <button
                      onClick={() => {
                        setReverseModal(deposit);
                        setReverseReason("");
                      }}
                      disabled={reverseMutation.isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" /> Hoàn tác
                    </button>
                  )}
                  {["expired", "rejected"].includes(deposit.status) && (
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
      {reverseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-800">
              Hoàn tác giao dịch nạp tiền
            </h3>
            <p className="text-sm text-gray-600">
              Ví sẽ bị trừ{" "}
              <strong className="text-red-500">
                {formatVND(reverseModal.creditedAmount ?? reverseModal.amount)}
              </strong>
              . Ledger gốc vẫn được giữ để đối soát.
            </p>
            <textarea
              value={reverseReason}
              onChange={(event) => setReverseReason(event.target.value)}
              placeholder="Lý do hoàn tác (ít nhất 8 ký tự)"
              maxLength={500}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={4}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setReverseModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleReverseSubmit}
                disabled={
                  reverseMutation.isPending ||
                  reverseReason.trim().length < 8
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {reverseMutation.isPending
                  ? "Đang xử lý..."
                  : "Xác nhận hoàn tác"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </phantom-ui>
  );
};

export default DepositManagement;
