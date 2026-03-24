import { useEffect, useState } from "react";
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

const formatTime24h = (timeStr) => {
  if (!timeStr) return "";
  let date = new Date(timeStr);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  const match = timeStr.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i,
  );
  if (match) {
    let [_, day, month, year, hour, minute, ampm] = match;
    let h = parseInt(hour, 10);
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
      if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    }
    const hours = String(h).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minute}`;
  }
  return timeStr;
};

const MyHistory = () => {
  const [data, setData] = useState({
    user: null,
    checkins: [],
    orders: [],
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getMyCheckins();

      console.log("MY API:", res);

      const payload = res.data?.data || res.data || res;

      setData({
        user: payload.user || null,
        checkins: payload.checkins || [],
        orders: payload.orders || [],
      });
    } catch (err) {
      console.error(err);
      setData({ user: null, checkins: [], orders: [] });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [data?.checkins]);

  const checkins = data?.checkins || [];
  const totalPages = Math.ceil(checkins.length / itemsPerPage);
  const paginatedCheckins = checkins.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 animate-pulse">
        {/* HEADER */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full"></div>
          <div className="space-y-2">
            <div className="h-4 w-40 bg-gray-300 rounded"></div>
            <div className="h-3 w-24 bg-gray-200 rounded"></div>
          </div>
        </div>

        {/* CARD USER */}
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
          <div className="h-5 w-48 bg-gray-300 rounded"></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
            <div className="h-4 w-40 bg-gray-200 rounded"></div>
          </div>
        </div>

        {/* CARD PACKAGES */}
        <div className="bg-white rounded-xl shadow-sm border p-5 space-y-4">
          <div className="h-5 w-40 bg-gray-300 rounded"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl border bg-gray-50 space-y-3"
              >
                <div className="h-4 w-32 bg-gray-300 rounded"></div>
                <div className="h-3 w-24 bg-gray-200 rounded"></div>
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b bg-slate-50 flex justify-between">
            <div className="h-4 w-40 bg-gray-300 rounded"></div>
            <div className="h-4 w-16 bg-gray-200 rounded"></div>
          </div>

          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="grid grid-cols-6 gap-4 items-center">
                <div className="h-3 bg-gray-200 rounded col-span-1"></div>
                <div className="h-3 bg-gray-300 rounded col-span-1"></div>
                <div className="h-3 bg-gray-200 rounded col-span-1"></div>
                <div className="h-3 bg-gray-200 rounded col-span-1"></div>
                <div className="h-3 bg-gray-200 rounded col-span-1"></div>
                <div className="h-4 bg-gray-300 rounded col-span-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.checkins)
    return (
      <div className="p-6 text-center text-red-500 bg-red-50 rounded-xl border border-red-200">
        Không có dữ liệu hoặc xảy ra lỗi.
      </div>
    );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Card 1: Thông tin khách hàng */}
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
                <span className="font-medium">Họ tên:</span> {data.user?.name}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="font-medium">Email:</span> {data.user?.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Gói tập */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-800">
            Gói tập của tôi
          </h3>
        </div>
        {data.orders && data.orders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.orders.map((o) => (
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

      {/* Card 3: Lịch sử check-in */}
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
                      {formatTime24h(c.time)}
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
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyHistory;
