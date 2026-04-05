import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Upload,
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileWarning,
} from "lucide-react";
import {
  getExercises,
  createExercise,
  createManyExercises,
  updateExercise,
  deleteExercise,
} from "../../services/exercise.service";

const ExerciseManagement = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    muscleGroup: "",
    description: "",
    videoUrl: "",
    imageUrl: "",
  });
  const [batchText, setBatchText] = useState("");
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: exercisesResponse, isLoading } = useQuery({
    queryKey: ["exercises", page, debouncedSearch],
    queryFn: () => getExercises(page, limit, debouncedSearch),
    keepPreviousData: true,
  });

  const exercises = exercisesResponse?.data || [];
  const totalPages = exercisesResponse?.pagination?.totalPages || 1;

  const createMutation = useMutation({
    mutationFn: createExercise,
    onSuccess: () => {
      toast.success(" Thêm bài tập thành công");
      resetModal();
      queryClient.invalidateQueries(["exercises"]);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi khi thêm"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateExercise(id, data),
    onSuccess: () => {
      toast.success(" Cập nhật thành công");
      resetModal();
      queryClient.invalidateQueries(["exercises"]);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi cập nhật"),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteExercise,
    onSuccess: () => {
      toast.success(" Xóa thành công");
      queryClient.invalidateQueries(["exercises"]);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });
  const batchMutation = useMutation({
    mutationFn: createManyExercises,
    onSuccess: (res) => {
      toast.success(res.data.message || "Thêm hàng loạt thành công");
      setBatchText("");
      setShowBatchModal(false);
      queryClient.invalidateQueries(["exercises"]);
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi thêm hàng loạt"),
  });

  const resetModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      name: "",
      muscleGroup: "",
      description: "",
      videoUrl: "",
      imageUrl: "",
    });
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) updateMutation.mutate({ id: editingId, data: formData });
    else createMutation.mutate(formData);
  };
  const handleEdit = (ex) => {
    setFormData({
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      description: ex.description || "",
      videoUrl: ex.videoUrl || "",
      imageUrl: ex.imageUrl || "",
    });
    setEditingId(ex._id);
    setShowModal(true);
  };
  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bài tập này?"))
      deleteMutation.mutate(id);
  };

  const handleBatchSubmit = () => {
    const lines = batchText.split("\n").filter((line) => line.trim());
    const exercisesBatch = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const firstComma = trimmed.indexOf(",");
      if (firstComma === -1) {
        toast.warning(
          `Dòng không hợp lệ (thiếu tên và nhóm cơ): ${trimmed.substring(0, 30)}...`,
        );
        continue;
      }
      const name = trimmed.substring(0, firstComma).trim();
      const afterFirst = trimmed.substring(firstComma + 1);
      const secondComma = afterFirst.indexOf(",");
      let muscleGroup = "",
        description = "";
      if (secondComma === -1) {
        muscleGroup = afterFirst.trim();
        description = "";
      } else {
        muscleGroup = afterFirst.substring(0, secondComma).trim();
        description = afterFirst.substring(secondComma + 1).trim();
      }
      if (!name || !muscleGroup) {
        toast.warning(`Thiếu tên hoặc nhóm cơ: ${trimmed.substring(0, 50)}`);
        continue;
      }
      exercisesBatch.push({ name, muscleGroup, description });
    }
    if (exercisesBatch.length === 0) {
      toast.warning(
        "Vui lòng nhập ít nhất một dòng hợp lệ: Tên, Nhóm cơ, Mô tả (không bắt buộc)",
      );
      return;
    }
    batchMutation.mutate(exercisesBatch);
  };

  const muscleGroups = [
    "Ngực",
    "Lưng",
    "Chân",
    "Vai",
    "Bụng",
    "Core",
    "Tay trước",
    "Tay sau",
    "Mông",
    "Đùi trong",
    "Mông + Chân",
    "Bắp chân",
  ];

  return (
    <div className="min-h-screen bg-gray-50/40 p-4 md:p-6">
      <ToastContainer position="top-right" autoClose={3000} theme="light" />

      {/* Header + actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Dumbbell className="w-7 h-7 text-indigo-600" />
            Quản lý bài tập
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Danh sách các bài tập thể dục
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBatchModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Upload size={18} /> Thêm nhiều
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Plus size={18} /> Thêm bài tập
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm bài tập theo tên..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
          <p className="text-gray-500">Đang tải danh sách bài tập...</p>
        </div>
      ) : (
        <>
          {/* Table container - responsive */}
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
                    <th className="px-5 py-4 text-center text-sm font-semibold text-gray-700 w-24">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {exercises.map((ex) => (
                    <tr key={ex._id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3 text-sm font-medium text-gray-800">
                        {ex.name}
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                          {ex.muscleGroup}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 max-w-md break-words whitespace-pre-wrap">
                        {ex.description || "—"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEdit(ex)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Sửa"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(ex._id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {exercises.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-12 text-center text-gray-400"
                      >
                        <FileWarning className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        Không tìm thấy bài tập nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
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

      {/* Modal thêm/sửa bài tập */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={resetModal}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {editingId ? (
                  <>
                    <Edit size={20} className="text-indigo-600" /> Sửa bài tập
                  </>
                ) : (
                  <>
                    <Plus size={20} className="text-indigo-600" /> Thêm bài tập
                    mới
                  </>
                )}
              </h2>
              <button
                onClick={resetModal}
                className="p-1 rounded-full hover:bg-gray-100 transition"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên bài tập *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Bench Press"
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nhóm cơ *
                </label>
                <select
                  className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
                  value={formData.muscleGroup}
                  onChange={(e) =>
                    setFormData({ ...formData, muscleGroup: e.target.value })
                  }
                  required
                >
                  <option value="">Chọn nhóm cơ</option>
                  {muscleGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  placeholder="Mô tả chi tiết kỹ thuật, lợi ích..."
                  rows={3}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL video (không bắt buộc)
                </label>
                <input
                  type="text"
                  placeholder="https://youtube.com/..."
                  className="w-full p-2.5 border border-gray-300 rounded-xl"
                  value={formData.videoUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, videoUrl: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL ảnh (không bắt buộc)
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/image.jpg"
                  className="w-full p-2.5 border border-gray-300 rounded-xl"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, imageUrl: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition flex items-center gap-2"
                >
                  {editingId ? "Cập nhật" : "Thêm mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal thêm nhiều bài tập */}
      {showBatchModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBatchModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Upload size={20} className="text-emerald-600" /> Thêm nhiều bài
                tập
              </h2>
              <button
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-blue-50 rounded-xl text-sm text-blue-800 border border-blue-100">
              <p className="font-medium mb-1">📌 Hướng dẫn định dạng:</p>
              <p>
                Mỗi dòng:{" "}
                <strong>Tên bài tập, Nhóm cơ, Mô tả (không bắt buộc)</strong>
              </p>
              <p className="text-xs mt-1 text-blue-700">
                Ví dụ: Bench Press, Ngực, Tập ngực với tạ đòn
                <br />
                Pull Up, Lưng, Kéo xà với tay rộng
              </p>
            </div>
            <textarea
              rows={10}
              className="w-full p-3 border border-gray-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500"
              placeholder="Bench Press, Ngực, Tập ngực cơ bản với tạ đòn&#10;Pull Up, Lưng, Kéo xà tay rộng&#10;Squat, Chân, Squat với thanh tạ"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleBatchSubmit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm flex items-center gap-2"
              >
                <Upload size={16} /> Thêm hàng loạt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseManagement;
