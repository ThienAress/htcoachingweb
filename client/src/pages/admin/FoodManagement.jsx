import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Edit,
  Trash,
  Apple,
  X,
  Save,
  Upload,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  getFoods,
  createFood,
  updateFood,
  deleteFood,
  createManyFoods,
} from "../../services/food.service";

const FoodManagement = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [formData, setFormData] = useState({
    label: "",
    protein: "",
    carb: "",
    fat: "",
    calories: "",
  });
  const [batchJson, setBatchJson] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const limit = 10;

  // Fetch foods
  const {
    data: foodsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["foods", currentPage, searchTerm],
    queryFn: () =>
      getFoods(currentPage, limit, searchTerm).then((res) => res.data),
    keepPreviousData: true,
  });

  const foods = foodsData?.data || [];
  const pagination = foodsData?.pagination || { total: 0, totalPages: 0 };

  // Mutations
  const createMutation = useMutation({
    mutationFn: createFood,
    onSuccess: () => {
      toast.success("Thêm thực phẩm thành công");
      queryClient.invalidateQueries({ queryKey: ["foods"] });
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi thêm"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateFood(id, data),
    onSuccess: () => {
      toast.success("Cập nhật thành công");
      queryClient.invalidateQueries({ queryKey: ["foods"] });
      closeModal();
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi cập nhật"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFood,
    onSuccess: () => {
      toast.success("Xóa thực phẩm thành công");
      queryClient.invalidateQueries({ queryKey: ["foods"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const batchMutation = useMutation({
    mutationFn: createManyFoods,
    onSuccess: (res) => {
      setBatchResult(res.data.data);
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ["foods"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi import"),
  });

  const openCreateModal = () => {
    setEditingFood(null);
    setFormData({ label: "", protein: "", carb: "", fat: "", calories: "" });
    setShowModal(true);
  };

  const openEditModal = (food) => {
    setEditingFood(food);
    setFormData({
      label: food.label,
      protein: food.protein,
      carb: food.carb,
      fat: food.fat,
      calories: food.calories || "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFood(null);
    setFormData({ label: "", protein: "", carb: "", fat: "", calories: "" });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      label: formData.label.trim(),
      protein: parseFloat(formData.protein),
      carb: parseFloat(formData.carb),
      fat: parseFloat(formData.fat),
      calories: formData.calories ? parseFloat(formData.calories) : undefined,
    };
    if (editingFood) {
      updateMutation.mutate({ id: editingFood._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id, label) => {
    if (window.confirm(`Xóa thực phẩm "${label}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleBatchSubmit = () => {
    try {
      let foods = JSON.parse(batchJson);
      if (!Array.isArray(foods)) throw new Error("Phải là mảng");
      foods.forEach((item, idx) => {
        if (
          !item.label ||
          item.protein === undefined ||
          item.carb === undefined ||
          item.fat === undefined
        ) {
          throw new Error(
            `Item ${idx + 1} thiếu trường bắt buộc (label, protein, carb, fat)`,
          );
        }
      });
      batchMutation.mutate(foods);
    } catch (err) {
      toast.error("JSON không hợp lệ: " + err.message);
    }
  };

  const closeBatchModal = () => {
    setShowBatchModal(false);
    setBatchJson("");
    setBatchResult(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/3"></div>
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
        Lỗi tải dữ liệu: {error?.message}
        <button
          onClick={() => refetch()}
          className="ml-4 px-3 py-1 bg-indigo-600 text-white rounded"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 h-full">
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Apple className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
            Quản lý thực phẩm
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Danh sách thực phẩm dùng để tính dinh dưỡng và gợi ý thực đơn
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm md:text-base"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm thực phẩm</span>
          </button>
          <button
            onClick={() => setShowBatchModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm md:text-base"
          >
            <Upload className="w-4 h-4" />
            <span>Import nhiều</span>
          </button>
        </div>
      </div>

      {/* Tìm kiếm */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm kiếm theo tên thực phẩm..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm md:text-base"
        />
      </div>

      {/* Bảng thực phẩm */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Tên thực phẩm
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Protein (g)
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Carb (g)
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Fat (g)
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Calories
                </th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold text-slate-600">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {foods.map((food) => (
                <tr
                  key={food._id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-slate-700">
                    {food.label}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {food.protein}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {food.carb}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {food.fat}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-slate-600">
                    {food.calories}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(food)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="Sửa"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(food._id, food.label)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Xóa"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {foods.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 md:px-4 py-6 md:py-8 text-center text-slate-500"
                  >
                    Không tìm thấy thực phẩm nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân trang */}
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

      {/* Modal thêm/sửa đơn lẻ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                <Apple className="w-5 h-5 text-indigo-600" />
                {editingFood ? "Cập nhật thực phẩm" : "Thêm thực phẩm mới"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tên thực phẩm *
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Protein (g) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.protein}
                    onChange={(e) =>
                      setFormData({ ...formData, protein: e.target.value })
                    }
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Carb (g) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.carb}
                    onChange={(e) =>
                      setFormData({ ...formData, carb: e.target.value })
                    }
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fat (g) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.fat}
                    onChange={(e) =>
                      setFormData({ ...formData, fat: e.target.value })
                    }
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.calories}
                    onChange={(e) =>
                      setFormData({ ...formData, calories: e.target.value })
                    }
                    placeholder="Để trống để tự tính"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    "Đang lưu..."
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Lưu
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal import batch JSON */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-green-600" />
                Nhập nhiều thực phẩm (JSON)
              </h2>
              <button
                onClick={closeBatchModal}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Dán mảng JSON theo mẫu (có thể copy từ Excel/Google Sheet).
                Calories là tùy chọn, sẽ tự tính nếu không có.
              </p>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                {`[
  { "label": "Ức gà", "protein": 31, "carb": 0, "fat": 3.6 },
  { "label": "Cơm trắng", "protein": 2.7, "carb": 28, "fat": 0.3 },
  { "label": "Bơ", "protein": 2, "carb": 8.5, "fat": 15, "calories": 160 }
]`}
              </pre>
              <textarea
                rows={12}
                value={batchJson}
                onChange={(e) => setBatchJson(e.target.value)}
                placeholder="Dán JSON array vào đây..."
                className="w-full border border-slate-200 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-indigo-500"
              />
              {batchResult && (
                <div className="bg-slate-100 p-3 rounded text-sm">
                  <p>✅ Thành công: {batchResult.success.length}</p>
                  <p>❌ Thất bại: {batchResult.failed.length}</p>
                  {batchResult.failed.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-red-600">
                        Xem chi tiết lỗi
                      </summary>
                      <pre className="text-xs mt-2 overflow-auto max-h-40">
                        {JSON.stringify(batchResult.failed, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 md:px-6 py-3 md:py-4 flex justify-end gap-3">
              <button
                onClick={closeBatchModal}
                className="px-3 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                onClick={handleBatchSubmit}
                disabled={batchMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {batchMutation.isPending ? "Đang xử lý..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FoodManagement;
