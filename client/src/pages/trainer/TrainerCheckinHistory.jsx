import { useState } from "react";
import {
  Calendar,
  Dumbbell,
  FileText,
  Edit,
  History,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
} from "lucide-react";

import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateByKey } from "../../queries/invalidation";
import { adminQueryKeys } from "../../queries/queryKeys";
import { toast, ToastContainer } from "react-toastify";
import { getCheckins, updateCheckin } from "../../services/checkin.service";
import { utcToLocalDateTime, localDateTimeToUTC } from "../../utils/date";
import {
  CHECKIN_PAGE_SIZE_OPTIONS,
  readCheckinPageSize,
  saveCheckinPageSize,
} from "./checkinPageSize";
const TrainerCheckinHistory = () => {
  const queryClient = useQueryClient();

  // eslint-disable-next-line no-unused-vars
  const currentDateTimeLocal = (() => {
    const now = new Date();
    const tzOffsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  })();

  const currentYearStart = (() => {
    return `${new Date().getFullYear()}-01-01T00:00`;
  })();

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(readCheckinPageSize);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handlePageSizeChange = (value) => {
    setLimit(value);
    setCurrentPage(1);
    saveCheckinPageSize(value);
  };

  const {
    data: checkinsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: adminQueryKeys.checkins.list({
      page: currentPage,
      limit,
      scope: "trainer",
    }),
    queryFn: () =>
      getCheckins(currentPage, limit).then((res) => ({
        data: res.data.data,
        pagination: res.data.pagination,
      })),
    placeholderData: keepPreviousData,
  });

  const checkins = checkinsData?.data || [];
  const pagination = checkinsData?.pagination || {
    total: 0,
    totalPages: 0,
    page: 1,
  };

  // Lọc theo tên khách hàng (client-side trên dữ liệu của trang hiện tại)
  const filteredCheckins = checkins.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCheckin(id, data),
    onSuccess: () => {
      toast.success("Cập nhật thành công");
      setShowModal(false);
      invalidateByKey(queryClient, adminQueryKeys.checkins.all());
    },
    onError: (err) => toast.error(err.message),
  });

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
  if (isError) {
    return (
      <div className="p-6 text-center text-red-500">
        Lỗi tải dữ liệu, vui lòng thử lại.
      </div>
    );
  }

  return (
    <phantom-ui loading={isLoading || undefined}>
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 uppercase">
            <History className="w-6 h-6 text-primary" />
            LỊCH SỬ CHECK-IN
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Danh sách các buổi tập đã check-in của khách hàng
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Tổng: {pagination.total} lượt
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  STT
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Tên
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
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCheckins.map((c, idx) => (
                <tr
                  key={c._id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-500">
                    {(pagination.page - 1) * limit + idx + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {c.name}
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
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleEdit(c)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCheckins.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    {searchTerm
                      ? "Không tìm thấy lịch sử check-in phù hợp."
                      : "Chưa có lịch sử check-in."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredCheckins.map((c) => (
          <div
            key={c._id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-4"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-slate-800">{c.name}</h3>
                <p className="text-sm text-slate-500">{c.package}</p>
              </div>
              <button
                onClick={() => handleEdit(c)}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{new Date(c.time).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Dumbbell className="w-4 h-4 text-slate-400" />
                <span>{c.muscle}</span>
              </div>
              {c.note && (
                <div className="flex items-start gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                  <span className="flex-1">{c.note}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Còn lại:</span>
                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                  {c.remainingSessions} buổi
                </span>
              </div>
            </div>
          </div>
        ))}
        {filteredCheckins.length === 0 && (
          <div className="text-center py-8 text-slate-500 bg-white rounded-xl shadow-sm border">
            {searchTerm
              ? "Không tìm thấy lịch sử check-in phù hợp."
              : "Chưa có lịch sử check-in."}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2" role="group" aria-label="Số check-in mỗi trang">
          <span className="text-sm font-medium text-slate-600">Hiển thị</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {CHECKIN_PAGE_SIZE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handlePageSizeChange(value)}
                aria-pressed={limit === value}
                className={
                  "min-h-9 min-w-10 rounded-md px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
                  (limit === value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100")
                }
              >
                {value}
              </button>
            ))}
          </div>
          <span className="text-sm text-slate-500">lượt / trang</span>
        </div>
        <div className="flex items-center justify-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page <= 1}
            aria-label="Trang check-in trước"
            className="min-h-10 min-w-10 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="mx-auto w-4 h-4" />
          </button>
          <span className="min-w-24 text-center text-sm text-slate-600">
            Trang {pagination.page || 1} / {Math.max(pagination.totalPages || 0, 1)}
          </span>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
            }
            disabled={!pagination.totalPages || pagination.page >= pagination.totalPages}
            aria-label="Trang check-in sau"
            className="min-h-10 min-w-10 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="mx-auto w-4 h-4" />
          </button>
        </div>
      </div>

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 uppercase">
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
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Thời gian
                </label>
                <input
                  type="datetime-local"
                  value={editing.timeLocal || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, timeLocal: e.target.value })
                  }
                  min={currentYearStart}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Nhóm cơ
                </label>
                <input
                  type="text"
                  value={editing.muscle || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, muscle: e.target.value })
                  }
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Ghi chú
                </label>
                <textarea
                  value={editing.note || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, note: e.target.value })
                  }
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </phantom-ui>
  );
};

export default TrainerCheckinHistory;
