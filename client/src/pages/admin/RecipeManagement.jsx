import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useDebounce } from "../../hooks/useDebounce";
import { toast } from "react-toastify";
import {
  Utensils,
  Search,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  Globe2,
  Tag,
  ChefHat,
  Cpu,
  Edit2,
} from "lucide-react";
import {
  getAdminRecipes,
  updateRecipe,
  deleteRecipe,
} from "../../services/recipe.service";
import RecipeEditModal from "./RecipeEditModal";

const RecipeManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [page, setPage] = useState(1);
  const [filterPublished, setFilterPublished] = useState("");
  const [editingRecipe, setEditingRecipe] = useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["adminRecipes", page, debouncedSearch, filterPublished],
    queryFn: ({ signal }) =>
      getAdminRecipes({
        page,
        limit: 10,
        search: debouncedSearch,
        isPublished: filterPublished,
      }, signal),
    placeholderData: keepPreviousData,
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }) =>
      updateRecipe(id, { isPublished: !isPublished }),
    onSuccess: () => {
      toast.success("Cập nhật trạng thái thành công");
      queryClient.invalidateQueries({ queryKey: ["adminRecipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.message || "Lỗi khi cập nhật trạng thái"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      toast.success("Xóa công thức thành công");
      queryClient.invalidateQueries({ queryKey: ["adminRecipes"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Lỗi khi xóa công thức");
    },
  });

  const handleTogglePublish = (recipe) => {
    const action = recipe.isPublished ? "ẩn" : "hiển thị công khai";
    if (!window.confirm(`Bạn có chắc muốn ${action} công thức "${recipe.name}"?`)) return;
    togglePublishMutation.mutate({
      id: recipe._id,
      isPublished: recipe.isPublished,
    });
  };

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa công thức này? Hành động này không thể hoàn tác.")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
            <Utensils size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Công thức nấu ăn</h1>
            <p className="text-sm text-gray-500 mt-1">
              Quản lý danh sách các món ăn, duyệt bài từ AI sinh ra
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditingRecipe({})}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition"
        >
          <Plus size={18} />
          Thêm công thức
        </button>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Tìm kiếm công thức..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
          </div>
          <select
            aria-label="Lọc theo trạng thái"
            className="w-full sm:w-48 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-700 bg-white"
            value={filterPublished}
            onChange={(e) => {
              setFilterPublished(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đã duyệt (Public)</option>
            <option value="false">Chưa duyệt (Draft)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Món ăn
                </th>
                <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Phân loại
                </th>
                <th className="text-center py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nguồn
                </th>
                <th className="text-center py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="text-right py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                      <p className="text-sm">Đang tải dữ liệu...</p>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan="5" className="py-10 text-center text-red-500">
                    Lỗi: {error.message}
                  </td>
                </tr>
              ) : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-10 text-center text-gray-500">
                    Không tìm thấy công thức nào.
                  </td>
                </tr>
              ) : (
                data?.data.map((recipe) => (
                  <tr
                    key={recipe._id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200">
                          {recipe.thumbnail ? (
                            <img
                              src={recipe.thumbnail}
                              alt={recipe.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Utensils className="text-gray-400" size={20} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 line-clamp-1">
                            {recipe.name}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Globe2 size={12} /> {recipe.area || "Chưa rõ"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={12} /> {recipe.prepTime || "--"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        <Tag size={12} />
                        {recipe.category || "Chưa phân loại"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      {recipe.source === "ai" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          <Cpu size={14} /> AI
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
                          <ChefHat size={14} /> Thủ công
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleTogglePublish(recipe)}
                        disabled={togglePublishMutation.isPending}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
                          recipe.isPublished
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {recipe.isPublished ? (
                          <>
                            <Eye size={14} /> Public
                          </>
                        ) : (
                          <>
                            <EyeOff size={14} /> Draft
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingRecipe(recipe)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(recipe._id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Xóa"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Trang {data.pagination.page} / {data.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Trước
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {editingRecipe && (
        <RecipeEditModal
          recipe={editingRecipe}
          onClose={() => setEditingRecipe(null)}
        />
      )}
    </div>
  );
};

export default RecipeManagement;
