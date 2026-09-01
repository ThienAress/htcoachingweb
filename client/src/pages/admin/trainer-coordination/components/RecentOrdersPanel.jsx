import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { getRecentTrainerOrders } from "../../../../services/trainerCoordination.service";

const statusLabel = {
  pending: "Chờ duyệt",
  approved: "Đang hoạt động",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const RecentOrdersPanel = ({ onStartTransfer }) => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [assignment, setAssignment] = useState("");
  const query = useQuery({
    queryKey: ["trainer-coordination", "recent-orders", { page, search, status, assignment }],
    queryFn: () =>
      getRecentTrainerOrders({ page, limit: 20, search, status, assignment }).then(
        (response) => response.data.data,
      ),
    placeholderData: keepPreviousData,
  });
  const orders = query.data?.orders || [];
  const pagination = query.data?.pagination;

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8" aria-live="polite">
        <div className="h-5 w-56 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
        <div className="mt-5 h-44 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Không tải được đơn mới</h2>
            <p className="mt-1 text-sm text-rose-800">Kiểm tra kết nối rồi thử lại.</p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className="mt-4 min-h-11 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Đơn mới trong 30 ngày</h2>
            <p className="mt-1 text-sm text-slate-600">
              Đơn cũ hơn vẫn được lưu tại trang Đơn hàng.
            </p>
          </div>
          <form onSubmit={submitSearch} className="flex w-full max-w-xl gap-2">
            <label className="sr-only" htmlFor="recent-order-search">Tìm đơn mới</label>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                id="recent-order-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                maxLength={100}
                placeholder="Tên, email hoặc gói tập"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </div>
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              Tìm
            </button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="text-sm font-medium text-slate-700">
            <span className="sr-only">Lọc trạng thái</span>
            <select
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đang hoạt động</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            <span className="sr-only">Lọc phân công</span>
            <select
              value={assignment}
              onChange={(event) => { setAssignment(event.target.value); setPage(1); }}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            >
              <option value="">Tất cả phân công</option>
              <option value="unassigned">Chưa có HLV</option>
              <option value="assigned">Đã có HLV</option>
            </select>
          </label>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-10 text-center">
          <h3 className="font-semibold text-slate-900">Không có đơn phù hợp</h3>
          <p className="mt-1 text-sm text-slate-600">Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-6 py-3 font-semibold">Khách hàng</th>
                <th className="px-6 py-3 font-semibold">Gói / buổi còn lại</th>
                <th className="px-6 py-3 font-semibold">Trạng thái</th>
                <th className="px-6 py-3 font-semibold">HLV</th>
                <th className="px-6 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => {
                const trainer = order.trainerId;
                const client = order.userId || { _id: order.userId, name: order.name, email: order.email };
                return (
                  <tr key={order._id} className="text-slate-700 hover:bg-slate-50">
                    <td className="px-6 py-4"><p className="font-semibold text-slate-950">{client?.name || order.name}</p><p className="mt-1 text-xs text-slate-500">{client?.email || order.email}</p></td>
                    <td className="px-6 py-4"><p>{order.package || "Chưa có tên gói"}</p><p className="mt-1 text-xs text-slate-500">{order.sessions ?? 0}/{order.totalSessions ?? "—"} buổi</p></td>
                    <td className="px-6 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabel[order.status] || order.status}</span></td>
                    <td className="px-6 py-4">{trainer?.name || <span className="font-medium text-amber-700">Chưa phân công</span>}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        disabled={!trainer || !client?._id || !["pending", "approved"].includes(order.status)}
                        onClick={() => onStartTransfer({ client, trainer })}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-cyan-800 transition-colors duration-200 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
                      >
                        Chuyển HLV <ArrowRight className="size-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 sm:px-6">
        <p className="text-sm text-slate-600">{pagination?.total || 0} đơn</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={page <= 1} aria-label="Trang trước" className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="size-4" /></button>
          <span className="min-w-20 text-center text-sm text-slate-600">{page}/{pagination?.totalPages || 1}</span>
          <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= (pagination?.totalPages || 1)} aria-label="Trang sau" className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /></button>
        </div>
      </div>
    </div>
  );
};

export default RecentOrdersPanel;
