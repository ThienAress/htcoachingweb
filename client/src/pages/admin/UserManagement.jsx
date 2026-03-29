import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, User } from "lucide-react";
import { toast } from "react-toastify";
import { getUsers, deleteUser } from "../../services/user.service";

const UserManagement = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  const {
    data: usersData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["users", currentPage, searchTerm],
    queryFn: () =>
      getUsers(currentPage, limit, searchTerm).then((res) => res.data),
    keepPreviousData: true,
  });

  const users = usersData?.data || [];
  const pagination = usersData?.pagination || { total: 0, totalPages: 0 };

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      toast.success("Xóa người dùng thành công");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const handleDelete = (id, name) => {
    if (!window.confirm(`Xóa người dùng "${name}"?`)) return;
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/3 md:w-1/4"></div>
        <div className="h-10 bg-gray-200 rounded"></div>
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
        Lỗi tải dữ liệu: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 h-full">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">
          Quản lý người dùng
        </h2>
      </div>
      <p className="text-sm text-slate-500">
        Danh sách khách hàng đã đăng nhập qua Google.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm theo tên hoặc email..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm md:text-base"
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
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user._id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-slate-700">
                    {user.name}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {user.email}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <button
                      onClick={() => handleDelete(user._id, user.name)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 md:px-4 py-6 md:py-8 text-center text-slate-500"
                  >
                    Không tìm thấy người dùng nào.
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
            Trang {pagination.page} / {pagination.totalPages}
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
  );
};

export default UserManagement;
