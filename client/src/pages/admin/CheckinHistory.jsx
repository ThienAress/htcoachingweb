import { useState } from "react";
import {
  Edit,
  Trash,
  Calendar,
  Dumbbell,
  FileText,
  X,
  Save,
  History,
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  getCheckins,
  deleteCheckin,
  updateCheckin,
} from "../../services/checkin.service";
import { utcToLocalDateTime, localDateTimeToUTC } from "../../utils/date";

const CheckinHistory = () => {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchName, setSearchName] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const limit = 10;

  // Build query params
  const buildParams = () => {
    const params = new URLSearchParams();
    params.append("page", currentPage);
    params.append("limit", limit);
    if (searchName) params.append("search", searchName);
    if (selectedMonth && selectedYear) {
      params.append("month", selectedMonth);
      params.append("year", selectedYear);
    }
    return params.toString();
  };

  const {
    data: checkinsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "checkins",
      currentPage,
      searchName,
      selectedMonth,
      selectedYear,
    ],
    queryFn: () =>
      getCheckins(buildParams()).then((res) => ({
        data: res.data.data,
        pagination: res.data.pagination,
      })),
    keepPreviousData: true,
  });

  const checkins = checkinsData?.data || [];
  const pagination = checkinsData?.pagination || {
    total: 0,
    totalPages: 0,
    page: 1,
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteCheckin,
    onSuccess: () => {
      toast.success("Xóa check-in thành công");
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCheckin(id, data),
    onSuccess: () => {
      toast.success("Cập nhật thành công");
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDelete = (id) => {
    if (!window.confirm("Xóa checkin này?")) return;
    deleteMutation.mutate(id);
  };

  const handleEdit = (c) => {
    setEditing({
      ...c,
      timeUTC: c.time,
      timeLocal: utcToLocalDateTime(c.time),
    });
    setShowModal(true);
  };
  const handleSave = () => {
    if (!editing) return;
    const updatedTimeUTC = localDateTimeToUTC(editing.timeLocal);
    updateMutation.mutate({
      id: editing._id,
      data: {
        time: updatedTimeUTC,
        muscle: editing.muscle,
        note: editing.note,
      },
    });
  };

  // Reset filters
  const resetFilters = () => {
    setSearchName("");
    setSelectedMonth("");
    setSelectedYear("");
    setCurrentPage(1);
  };

  // Danh sách năm có sẵn (từ dữ liệu, nhưng nếu không có dữ liệu thì bạn có thể tạo danh sách năm từ 2020-2030)
  const availableYears = [2024, 2025, 2026]; // bạn có thể lấy từ API riêng

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/3 md:w-1/4"></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500">
        Lỗi tải dữ liệu, vui lòng thử lại.
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 h-full">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
            Lịch sử check-in
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý các buổi tập đã check-in của khách hàng
          </p>
        </div>
        <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-center">
          Tổng: {pagination.total} lượt
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm md:text-base"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 sm:flex-none">
            <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none text-sm md:text-base w-full sm:w-auto"
            >
              <option value="">Tháng</option>
              {Array.from({ length: 12 }, (_, i) =>
                String(i + 1).padStart(2, "0"),
              ).map((m) => (
                <option key={m} value={m}>
                  Tháng {parseInt(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 sm:flex-none">
            <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none text-sm md:text-base w-full sm:w-auto"
            >
              <option value="">Năm</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          {(searchName || selectedMonth || selectedYear) && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              title="Xóa bộ lọc"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[60px]">
                  STT
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[120px]">
                  Tên
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[100px]">
                  Gói tập
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[150px]">
                  Ngày
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[100px]">
                  Nhóm cơ
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[150px]">
                  Ghi chú
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[80px]">
                  Còn lại
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600 min-w-[80px]">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {checkins.map((c, i) => (
                <tr
                  key={c._id}
                  className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-500">
                    {(pagination.page - 1) * limit + i + 1}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-slate-700 break-words">
                    {c.name}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {c.package}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600 whitespace-nowrap">
                    <Calendar className="inline w-3.5 h-3.5 text-slate-400 mr-1" />
                    {new Date(c.time).toLocaleString("vi-VN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Dumbbell className="w-3.5 h-3.5 text-slate-400" />
                      {c.muscle}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600 max-w-xs truncate">
                    {c.note || "—"}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <span className="inline-flex justify-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 whitespace-nowrap">
                      {c.remainingSessions} buổi
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(c)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="Sửa"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c._id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Xóa"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {checkins.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 md:px-4 py-6 md:py-8 text-center text-slate-500"
                  >
                    Không có dữ liệu check-in phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page === 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">
            Trang {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
            }
            disabled={pagination.page === pagination.totalPages}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600" />
                Sửa thông tin check-in
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Ngày check-in
                </label>
                <input
                  type="datetime-local"
                  value={editing.timeLocal || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, timeLocal: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-sm md:text-base"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Dumbbell className="w-4 h-4" /> Nhóm cơ
                </label>
                <input
                  type="text"
                  value={editing.muscle}
                  onChange={(e) =>
                    setEditing({ ...editing, muscle: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm md:text-base"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Ghi chú
                </label>
                <textarea
                  value={editing.note}
                  onChange={(e) =>
                    setEditing({ ...editing, note: e.target.value })
                  }
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm md:text-base"
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 md:px-6 py-3 md:py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-2 md:px-4 md:py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm md:text-base"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-3 py-2 md:px-4 md:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckinHistory;
