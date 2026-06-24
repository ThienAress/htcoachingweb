import { useState } from "react";
import SEO from "../components/SEO";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  Mail,
  Package,
  Calendar,
  Dumbbell,
  History,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
} from "lucide-react";

import { getMyCheckins } from "../services/checkin.service";

const MyHistory = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["myCheckins"],
    queryFn: () => getMyCheckins().then((res) => res.data.data),
  });

  const checkins = data?.checkins || [];
  const orders = data?.orders || [];
  const userData = data?.user;

  const totalPages = Math.ceil(checkins.length / itemsPerPage);
  const paginatedCheckins = checkins.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 rounded-xl border border-red-200">
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

  if (!data || !checkins) {
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 rounded-xl border border-red-200">
        Không có dữ liệu hoặc xảy ra lỗi.
      </div>
    );
  }

  return (
    <phantom-ui loading={isLoading || undefined}>
    <SEO title="Lịch sử tập luyện" noindex />
    <div className="p-4 md:p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <User className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800">
              Thông tin khách hàng
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="w-4 h-4 text-slate-400" />
                <span className="font-medium">Họ tên:</span> {userData?.name}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="font-medium">Email:</span> {userData?.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-800">
            Gói tập của tôi
          </h3>
        </div>
        {orders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orders.map((o) => (
              <div
                key={o._id}
                className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-800">{o.package}</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      <p>
                        <span className="font-medium">Tổng buổi:</span>{" "}
                        {o.totalSessions}
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="font-medium">Còn lại:</span>
                        <span className="bg-green-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                          {o.sessions}
                        </span>
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 italic">Chưa có gói tập nào.</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-800">Lịch sử tập luyện</h3>
          </div>
          <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full shadow-sm">
            {checkins.length} lượt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  STT
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Gói tập
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Ngày
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Nhóm cơ
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Ghi chú
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Còn lại
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedCheckins.length > 0 ? (
                paginatedCheckins.map((c, i) => (
                  <tr
                    key={c._id}
                    className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500">
                      {(currentPage - 1) * itemsPerPage + i + 1}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.package}</td>
                    <td className="px-4 py-3 text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(c.time).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Dumbbell className="w-3.5 h-3.5 text-slate-400" />{" "}
                        {c.muscle}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {c.note || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex justify-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        {c.remainingSessions} buổi
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Chưa có lịch sử tập luyện.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
    </phantom-ui>
  );
};

export default MyHistory;
