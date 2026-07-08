import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, User, ChevronLeft, ChevronRight, Award, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useDebounce } from "../../hooks/useDebounce";
import { getAllSubscribers, deleteSubscription } from "../../services/trainerSubscription.service";

const planIconMap = {
  "Tiêu chuẩn": "🔥",
  "Chuyên nghiệp": "💎",
  "Cao cấp": "👑",
};

const planColorMap = {
  "Tiêu chuẩn": "bg-orange-100 text-orange-700",
  "Chuyên nghiệp": "bg-purple-100 text-purple-700",
  "Cao cấp": "bg-yellow-100 text-yellow-700",
};

const TrainerSubscriberManagement = () => {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearchTerm = useDebounce(searchInput, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const {
    data: subsData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["subscribers", currentPage, debouncedSearchTerm],
    queryFn: () =>
      getAllSubscribers(currentPage, limit, debouncedSearchTerm).then(
        (res) => res.data
      ),
    keepPreviousData: true,
  });

  const subscribers = subsData?.data || [];
  const pagination = subsData?.pagination || { total: 0, totalPages: 0 };

  const deleteMutation = useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => {
      toast.success("Xóa gói thành công");
      queryClient.invalidateQueries({ queryKey: ["subscribers"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const handleDelete = (id, name) => {
    if (!window.confirm(`Xóa gói của "${name}"?`)) return;
    deleteMutation.mutate(id);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("vi-VN");
  };

  if (isError) {
    return (
      <div className="p-6 text-center text-red-500">
        Lỗi tải dữ liệu: {error.message}
      </div>
    );
  }

  return (
    <phantom-ui loading={isLoading || undefined}>
      <div className="space-y-4 md:space-y-6 h-full">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
          <h1 className="text-fluid-xl font-bold text-slate-800">
            QUẢN LÝ HUẤN LUYỆN VIÊN
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Danh sách người dùng đã mua gói dịch vụ huấn luyện viên.
        </p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-fluid-sm"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Tên
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Email
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Gói dịch vụ
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Hết hạn
                  </th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => (
                  <tr
                    key={sub._id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        {sub.userId?.avatar ? (
                          <img
                            src={sub.userId.avatar}
                            alt=""
                            className="w-7 h-7 rounded-full"
                          />
                        ) : (
                          <User className="w-5 h-5 text-slate-400" />
                        )}
                        {sub.userId?.name || "—"}
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                      {sub.userId?.email || "—"}
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${planColorMap[sub.planTitle] || "bg-gray-100 text-gray-700"
                          }`}
                      >
                        {planIconMap[sub.planTitle] || ""} {sub.planTitle}
                      </span>
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-slate-500 text-xs">
                      {formatDate(sub.endDate)}
                    </td>
                    <td className="px-3 md:px-4 py-2 md:py-3">
                      <button
                        onClick={() => handleDelete(sub._id, sub.userId?.name)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {subscribers.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 md:px-4 py-6 md:py-8 text-center text-slate-500"
                    >
                      Không có huấn luyện viên nào đang sử dụng dịch vụ.
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
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600">
              Trang {currentPage} / {pagination.totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={currentPage === pagination.totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </phantom-ui>
  );
};

export default TrainerSubscriberManagement;
