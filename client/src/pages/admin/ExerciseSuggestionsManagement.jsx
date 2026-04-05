import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileWarning,
  MessageSquare,
} from "lucide-react";
import {
  getExerciseSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
} from "../../services/exerciseSuggestion.service";

const ExerciseSuggestionsManagement = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["exerciseSuggestions", page, filterStatus, debouncedSearch],
    queryFn: () =>
      getExerciseSuggestions(page, limit, filterStatus, debouncedSearch).then(
        (res) => res.data,
      ),
    keepPreviousData: true,
  });
  const suggestions = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, adminNote }) =>
      updateSuggestionStatus(id, status, adminNote),
    onSuccess: () => {
      toast.success(" Cập nhật trạng thái thành công");
      queryClient.invalidateQueries(["exerciseSuggestions"]);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi cập nhật"),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteSuggestion,
    onSuccess: () => {
      toast.success(" Xóa góp ý thành công");
      queryClient.invalidateQueries(["exerciseSuggestions"]);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const handleStatusChange = (id, status) => {
    if (
      !window.confirm(
        `Đánh dấu là "${status === "approved" ? "Đã duyệt" : "Từ chối"}"?`,
      )
    )
      return;
    updateStatusMutation.mutate({ id, status, adminNote: "" });
  };
  const handleDelete = (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa góp ý này?")) return;
    deleteMutation.mutate(id);
  };

  const statusColors = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
  };
  const statusLabels = {
    pending: "Chờ xử lý",
    approved: "Đã duyệt",
    rejected: "Từ chối",
  };

  return (
    <div className="min-h-screen bg-gray-50/40 p-4 md:p-6">
      <ToastContainer position="top-right" autoClose={3000} theme="light" />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-indigo-600" />
          Quản lý góp ý bài tập
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Các đề xuất bài tập mới từ khách hàng
        </p>
      </div>

      {/* Bộ lọc và tìm kiếm */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm theo tên bài tập..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
          <p className="text-gray-500">Đang tải danh sách góp ý...</p>
        </div>
      ) : (
        <>
          {/* Bảng dữ liệu - responsive */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">
                      Tên bài tập
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">
                      Nhóm cơ
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">
                      Mô tả
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">
                      Người gửi
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">
                      Ngày gửi
                    </th>
                    <th className="px-5 py-4 text-left text-sm font-semibold text-gray-700">
                      Trạng thái
                    </th>
                    <th className="px-5 py-4 text-center text-sm font-semibold text-gray-700 w-28">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suggestions.map((s) => (
                    <tr key={s._id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3 text-sm font-medium text-gray-800">
                        {s.name}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {s.muscleGroup || "—"}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 max-w-md break-words whitespace-pre-wrap">
                        {s.description || "—"}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {s.suggestedBy?.email || "Khách"}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[s.status]}`}
                        >
                          {statusLabels[s.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          {s.status === "pending" && (
                            <>
                              <button
                                onClick={() =>
                                  handleStatusChange(s._id, "approved")
                                }
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Duyệt"
                              >
                                <CheckCircle size={18} />
                              </button>
                              <button
                                onClick={() =>
                                  handleStatusChange(s._id, "rejected")
                                }
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Từ chối"
                              >
                                <XCircle size={18} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(s._id)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {suggestions.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-gray-400"
                      >
                        <FileWarning className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        Không có góp ý nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phân trang */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="inline-flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              >
                <ChevronLeft size={16} /> Trước
              </button>
              <span className="text-sm text-gray-600">
                Trang <strong className="text-indigo-600">{page}</strong> /{" "}
                {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
              >
                Sau <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExerciseSuggestionsManagement;
