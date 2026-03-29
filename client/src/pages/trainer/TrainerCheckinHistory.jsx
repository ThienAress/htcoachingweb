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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import { getCheckins, updateCheckin } from "../../services/checkin.service";
import { utcToLocalDateTime, localDateTimeToUTC } from "../../utils/date";
const TrainerCheckinHistory = () => {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const limit = 10;

  const {
    data: checkinsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["checkins", currentPage],
    queryFn: () =>
      getCheckins(currentPage, limit).then((res) => ({
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

  // Lọc theo tên khách hàng (client-side trên dữ liệu của trang hiện tại)
  const filteredCheckins = checkins.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateCheckin(id, data),
    onSuccess: () => {
      toast.success("Cập nhật thành công");
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
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
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
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
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            Lịch sử check-in
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
                    {new Date(c.time).toLocaleString("vi-VN")}
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
                <span>{new Date(c.time).toLocaleString("vi-VN")}</span>
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

      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page === 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
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
  );
};

export default TrainerCheckinHistory;
