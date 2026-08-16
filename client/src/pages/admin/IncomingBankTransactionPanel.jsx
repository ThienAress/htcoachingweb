import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  Check,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "react-toastify";

import {
  approveIncomingBankTransaction,
  getAdminDeposits,
  getIncomingBankTransactions,
  ignoreIncomingBankTransaction,
  reverseIncomingBankTransaction,
} from "../../services/adminDeposit.service";
import {
  formatDateTime,
  formatVND,
  incomingStatusFilters,
  reasonLabels,
  statusLabels,
} from "./incomingBankTransactionAdmin.ui";
import IncomingBankTransactionPagination from "./IncomingBankTransactionPagination";

const IncomingBankTransactionPanel = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("needs_review");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState("");
  const [depositRequestId, setDepositRequestId] = useState("");

  const incomingQuery = useQuery({
    queryKey: ["admin-incoming-bank-transactions", status, page],
    queryFn: ({ signal }) =>
      getIncomingBankTransactions({ status, page, signal }).then(
        (response) => response.data.data,
      ),
  });
  const depositsQuery = useQuery({
    queryKey: ["admin-deposits", "all", "incoming-link-options"],
    queryFn: () => getAdminDeposits("all").then((response) => response.data.data),
  });

  const closeAction = () => {
    setAction(null);
    setReason("");
    setDepositRequestId("");
  };
  const openAction = (type, item) => {
    setAction({ type, item });
    setReason("");
    setDepositRequestId(item.depositRequestId?._id || "");
  };

  const mutation = useMutation({
    mutationFn: ({ type, item, selectedDepositId, note }) => {
      if (type === "approve") {
        return approveIncomingBankTransaction(item._id, {
          depositRequestId: selectedDepositId,
          reason: note,
        });
      }
      if (type === "ignore") {
        return ignoreIncomingBankTransaction(item._id, note);
      }
      return reverseIncomingBankTransaction(item._id, note);
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin-incoming-bank-transactions"],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin-deposits"] }),
      ]);
      toast.success(response.data.message);
      closeAction();
    },
    onError: (error) =>
      toast.error(error.response?.data?.message || "Không thể xử lý giao dịch"),
  });

  const submitAction = () => {
    const note = reason.trim();
    if (!action || note.length < 8) return;
    if (action.type === "approve" && !depositRequestId) return;
    mutation.mutate({
      type: action.type,
      item: action.item,
      selectedDepositId: depositRequestId,
      note,
    });
  };

  const items = incomingQuery.data?.items || [];

  return (
    <section aria-labelledby="incoming-bank-title" className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="incoming-bank-title" className="text-xl font-bold text-gray-900">
            Giao dịch ngân hàng
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-600">
            Chỉ duyệt sau khi đã đối chiếu tiền thực nhận. Số tài khoản và dữ liệu
            provider được giới hạn theo nguyên tắc tối thiểu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => incomingQuery.refetch()}
          disabled={incomingQuery.isFetching}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-[background-color,border-color] duration-200 hover:border-gray-400 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-wait disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 motion-reduce:animate-none ${incomingQuery.isFetching ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          Làm mới
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc trạng thái">
          {incomingStatusFilters.map((value) => (
          <button
            type="button"
            key={value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            aria-pressed={status === value}
            className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold transition-[background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              status === value
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-gray-300 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {value === "all" ? "Tất cả" : statusLabels[value]}
          </button>
        ))}
      </div>

      {incomingQuery.isPending ? (
        <p role="status" className="py-10 text-center text-gray-500">
          Đang tải giao dịch ngân hàng...
        </p>
      ) : incomingQuery.isError ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Không thể tải giao dịch. Hãy thử làm mới.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
          Không có giao dịch ở trạng thái này.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1 text-sm text-gray-600">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-lg font-bold text-gray-900">{formatVND(item.amount)}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {statusLabels[item.status] || item.status}
                    </span>
                  </div>
                  <p>
                    {item.gateway} · {item.maskedAccountNumber} · {formatDateTime(item.transactionAt)}
                  </p>
                  <p>
                    Mã nạp: <span className="font-mono font-semibold text-gray-800">{item.depositCode || "Không có"}</span>
                  </p>
                  {item.reviewReason && (
                    <p className="inline-flex items-center gap-2 font-semibold text-amber-700">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      {reasonLabels[item.reviewReason] || item.reviewReason}
                    </p>
                  )}
                  {item.userId && (
                    <p>{item.userId.name} · {item.userId.email}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {["received", "needs_review"].includes(item.status) && (
                    <>
                      <button
                        type="button"
                        onClick={() => openAction("approve", item)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Duyệt tiền thực nhận
                      </button>
                      <button
                        type="button"
                        onClick={() => openAction("ignore", item)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors duration-200 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                      >
                        <Ban className="h-4 w-4" aria-hidden="true" />
                        Không cộng ví
                      </button>
                    </>
                  )}
                  {item.status === "settled" && (
                    <button
                      type="button"
                      onClick={() => openAction("reverse", item)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Hoàn tác
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <IncomingBankTransactionPagination
        pagination={incomingQuery.data?.pagination}
        disabled={incomingQuery.isFetching}
        onPageChange={setPage}
      />

      {action && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950/60 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !mutation.isPending) closeAction();
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="incoming-action-title" aria-describedby="incoming-action-amount" className="z-50 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h3 id="incoming-action-title" className="text-lg font-bold text-gray-900">
              {action.type === "approve"
                ? "Duyệt tiền thực nhận"
                : action.type === "ignore"
                  ? "Không cộng giao dịch này"
                  : "Hoàn tác giao dịch"}
            </h3>
            <p id="incoming-action-amount" className="mt-2 text-sm text-gray-600">
              Số tiền ngân hàng ghi nhận: <strong>{formatVND(action.item.amount)}</strong>
            </p>
            {action.type === "approve" && (
              <label className="mt-4 block text-sm font-semibold text-gray-700">
                Yêu cầu nạp của khách hàng
                <select
                  value={depositRequestId}
                  autoFocus
                  onChange={(event) => setDepositRequestId(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Chọn yêu cầu nạp</option>
                  {(depositsQuery.data || []).map((deposit) => (
                    <option key={deposit._id} value={deposit._id}>
                      {deposit.depositCode} · {deposit.userId?.name || "Khách hàng"} · {formatVND(deposit.amount)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="mt-4 block text-sm font-semibold text-gray-700">
              Lý do đối soát
              <textarea
                value={reason}
                autoFocus={action.type !== "approve"}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Nhập ít nhất 8 ký tự"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={closeAction} className="min-h-11 rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
                Hủy
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={mutation.isPending || reason.trim().length < 8 || (action.type === "approve" && !depositRequestId)}
                className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutation.isPending ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
export default IncomingBankTransactionPanel;
