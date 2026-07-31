import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  HeartPulse,
  Mail,
  Package,
  Phone,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getTrainerClients } from "../../services/coaching.service";
import {
  buildTrainerClientWorkspacePath,
  buildTrainerHealthWorkspacePath,
} from "./trainerClientWorkspace.helpers";

const loadClients = async () =>
  (await getTrainerClients()).data.data || [];

const TrainerDashboard = () => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const isHealthTracking = location.pathname.startsWith("/trainer/health");
  const PageIcon = isHealthTracking ? HeartPulse : Users;
  const buildWorkspacePath = isHealthTracking
    ? buildTrainerHealthWorkspacePath
    : buildTrainerClientWorkspacePath;
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
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white min-h-[calc(100vh-3rem)] p-4 md:p-8 pt-8">
      <div className="container-custom">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-white uppercase">
            <PageIcon className="h-8 w-8 text-primary" aria-hidden="true" />
            {isHealthTracking ? "Theo dõi sức khỏe" : "Khách của tôi"}
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-6 text-gray-400">
            {isHealthTracking
              ? "Chọn học viên để xem tổng quan, mục tiêu sức khỏe và thói quen hằng ngày."
              : "Quản lý tiến trình, mục tiêu sức khỏe và thói quen của từng học viên."}
          </p>
        </div>
        <span className="text-sm font-semibold text-gray-400 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700">
          {clientsQuery.data?.length || 0} học viên đang hoạt động
        </span>
      </header>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-4 md:p-6 mb-6">
        <label className="relative block max-w-md">
          <span className="sr-only">Tìm học viên</span>
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="min-h-11 w-full rounded-lg border border-gray-600 bg-gray-700 pl-10 pr-4 text-sm text-white placeholder-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </label>
      </div>

      {clientsQuery.isLoading ? (
        <div className="space-y-3" role="status">
          <span className="sr-only">Đang tải danh sách học viên...</span>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-xl bg-gray-800 border border-gray-700"
            />
          ))}
        </div>
      ) : clientsQuery.isError ? (
        <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-400">
          <p className="font-semibold">Không thể tải danh sách học viên.</p>
          <p className="mt-1 text-sm text-red-300/80">
            {clientsQuery.error?.response?.data?.message ||
              "Vui lòng kiểm tra kết nối và thử lại."}
          </p>
          <button
            type="button"
            onClick={() => clientsQuery.refetch()}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 bg-red-500/20 font-semibold hover:bg-red-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </button>
        </section>
      ) : clients.length === 0 ? (
        <section className="rounded-xl border border-gray-700 bg-gray-800/50 backdrop-blur-sm p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-600" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-gray-300">
            {searchTerm ? "Không tìm thấy học viên" : "Chưa có học viên đang hoạt động"}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {searchTerm
              ? "Thử tìm bằng tên hoặc email khác."
              : "Học viên sẽ xuất hiện khi có gói được duyệt và còn buổi."}
          </p>
        </section>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-gray-700 bg-gray-800/50 backdrop-blur-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="px-5 py-3 font-semibold">Học viên</th>
                  <th className="px-5 py-3 font-semibold">Liên hệ</th>
                  <th className="px-5 py-3 font-semibold">Gói</th>
                  <th className="px-5 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {clients.map((client) => (
                  <tr key={client._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4">
                      <strong className="text-white font-medium">{client.name}</strong>
                      <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                        {client.email}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-300">
                      <span className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500" aria-hidden="true" />
                        {client.phone || "Chưa cập nhật"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-300">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-500" aria-hidden="true" />
                        {client.package || "Gói huấn luyện"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={buildWorkspacePath(client._id)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      >
                        {isHealthTracking ? "Xem hồ sơ sức khỏe" : "Quản lý"}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:hidden">
            {clients.map((client) => (
              <article key={client._id} className="rounded-2xl border border-gray-700 bg-gray-800/50 backdrop-blur-sm p-5 hover:border-gray-600 transition-colors">
                <h2 className="font-bold text-white text-lg">{client.name}</h2>
                <p className="mt-1 truncate text-sm text-gray-400">{client.email}</p>
                <p className="mt-3 text-sm text-gray-300 flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  {client.package || "Gói huấn luyện"}
                </p>
                <Link
                  to={buildWorkspacePath(client._id)}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shadow-lg shadow-primary/20"
                >
                  {isHealthTracking
                    ? "Xem hồ sơ sức khỏe"
                    : "Quản lý học viên"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default TrainerDashboard;
