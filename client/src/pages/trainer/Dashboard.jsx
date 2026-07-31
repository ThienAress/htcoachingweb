import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Mail,
  Package,
  Phone,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getTrainerClients } from "../../services/coaching.service";
import { buildTrainerClientWorkspacePath } from "./trainerClientWorkspace.helpers";

const loadClients = async () =>
  (await getTrainerClients()).data.data || [];

const TrainerDashboard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const clientsQuery = useQuery({
    queryKey: ["trainer-clients"],
    queryFn: loadClients,
    staleTime: 30_000,
    gcTime: 0,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });

  const clients = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return clientsQuery.data || [];
    return (clientsQuery.data || []).filter(
      (client) =>
        client.name?.toLowerCase().includes(normalized) ||
        client.email?.toLowerCase().includes(normalized),
    );
  }, [clientsQuery.data, searchTerm]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Users className="h-6 w-6 text-cyan-700" aria-hidden="true" />
            Khách của tôi
          </h1>
          <p className="mt-1 max-w-prose text-sm leading-6 text-slate-600">
            Quản lý tiến trình, mục tiêu sức khỏe và thói quen của từng học viên.
          </p>
        </div>
        <span className="text-sm font-semibold text-slate-600">
          {clientsQuery.data?.length || 0} học viên đang hoạt động
        </span>
      </header>

      <label className="relative block max-w-md">
        <span className="sr-only">Tìm học viên</span>
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Tìm theo tên hoặc email..."
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
        />
      </label>

      {clientsQuery.isLoading ? (
        <div className="space-y-3" role="status">
          <span className="sr-only">Đang tải danh sách học viên...</span>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-xl bg-slate-200"
            />
          ))}
        </div>
      ) : clientsQuery.isError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          <p className="font-semibold">Không thể tải danh sách học viên.</p>
          <p className="mt-1 text-sm">
            {clientsQuery.error?.response?.data?.message ||
              "Vui lòng kiểm tra kết nối và thử lại."}
          </p>
          <button
            type="button"
            onClick={() => clientsQuery.refetch()}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </button>
        </section>
      ) : clients.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <Users className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 font-bold text-slate-800">
            {searchTerm ? "Không tìm thấy học viên" : "Chưa có học viên đang hoạt động"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {searchTerm
              ? "Thử tìm bằng tên hoặc email khác."
              : "Học viên sẽ xuất hiện khi có gói được duyệt và còn buổi."}
          </p>
        </section>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Học viên</th>
                  <th className="px-5 py-3 font-semibold">Liên hệ</th>
                  <th className="px-5 py-3 font-semibold">Gói</th>
                  <th className="px-5 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client._id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <strong className="text-slate-900">{client.name}</strong>
                      <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        {client.email}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {client.phone || "Chưa cập nhật"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        {client.package || "Gói huấn luyện"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={buildTrainerClientWorkspacePath(client._id)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-bold text-cyan-700 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      >
                        Quản lý
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {clients.map((client) => (
              <article key={client._id} className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="font-bold text-slate-900">{client.name}</h2>
                <p className="mt-1 truncate text-sm text-slate-500">{client.email}</p>
                <p className="mt-3 text-sm text-slate-600">
                  {client.package || "Gói huấn luyện"}
                </p>
                <Link
                  to={buildTrainerClientWorkspacePath(client._id)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 font-bold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  Quản lý học viên
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TrainerDashboard;
