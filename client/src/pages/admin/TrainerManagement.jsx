import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Users2,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  Upload,
  X,
  Dumbbell,
  Utensils,
  ChartLine,
  HeartPulse,
} from "lucide-react";
import {
  createTrainer,
  deleteTrainer,
  getAdminTrainers,
  getAdminTrainerById,
  updateTrainer,
  updateTrainerStatus,
  uploadTrainerImage,
} from "../../services/trainer.service";
import { useDebounce } from "../../hooks/useDebounce";
import Trainers from "../../sections/Trainers";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "");
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const getPreviewData = (form) => {
  const getUrl = (url) => (url && url.startsWith("/uploads/") ? `${API_ORIGIN}${url}` : url);
  return {
    ...form,
    image: getUrl(form.image),
    specialties: Array.isArray(form.specialties) ? form.specialties : [],
  };
};

const emptyForm = {
  slug: "",
  name: "",
  title: "",
  experience: "",
  bio: "",
  image: "",
  specialties: [],
  status: "draft",
  featured: false,
  sortOrder: 0,
};

const trainerToForm = (trainer) => ({
  slug: trainer.slug || "",
  name: trainer.name || "",
  title: trainer.title || "",
  experience: trainer.experience || "",
  bio: trainer.bio || "",
  image: trainer.image || "",
  specialties: Array.isArray(trainer.specialties) ? trainer.specialties.map(s => ({ ...s, _id: s._id || Math.random().toString(36).substr(2, 9) })) : [],
  status: trainer.status || "draft",
  featured: Boolean(trainer.featured),
  sortOrder: Number(trainer.sortOrder || 0),
});

const buildPayload = (form) => {
  const specialties = Array.isArray(form.specialties)
    ? form.specialties.map((spec) => ({
      icon: spec.icon || "dumbbell",
      label: spec.label || "",
    }))
    : [];

  return {
    slug: form.slug,
    name: form.name,
    title: form.title,
    experience: form.experience,
    bio: form.bio,
    image: form.image,
    specialties,
    status: form.status,
    featured: form.featured,
    sortOrder: Number(form.sortOrder || 0),
  };
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
      {label}
    </span>
    {children}
  </label>
);

const FormSectionTitle = ({ number, title, description }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
      {number}
    </p>
    <h3 className="mt-1 text-lg font-bold text-slate-800">{title}</h3>
    {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
  </div>
);

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        <p className="mt-2 text-slate-600 leading-relaxed">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-red-700 transition-colors"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

const TableSkeleton = () => (
  <div className="animate-pulse space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-4 border-b border-slate-100 py-4">
        <div className="h-16 w-16 rounded-xl bg-slate-200"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-slate-200"></div>
          <div className="h-3 w-1/4 rounded bg-slate-200"></div>
        </div>
        <div className="h-8 w-24 rounded-full bg-slate-200"></div>
        <div className="h-8 w-16 rounded-lg bg-slate-200"></div>
      </div>
    ))}
  </div>
);

const availableIcons = [
  { value: "dumbbell", label: "Tạ (Dumbbell)" },
  { value: "utensils", label: "Dinh dưỡng (Utensils)" },
  { value: "chart-line", label: "Biểu đồ (Chart)" },
  { value: "heart-pulse", label: "Sức khỏe (Heart)" },
];

export default function TrainerManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { data: listData, isLoading } = useQuery({
    queryKey: ["admin-trainers", page, statusFilter, debouncedSearch],
    queryFn: () => getAdminTrainers({ page, limit: 10, status: statusFilter, search: debouncedSearch }),
    keepPreviousData: true,
  });

  const { data: detailData, isFetching: isFetchingDetail } = useQuery({
    queryKey: ["admin-trainer-detail", selectedId],
    queryFn: () => getAdminTrainerById(selectedId),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (detailData?.data && selectedId) {
      setForm(trainerToForm(detailData.data));
    }
  }, [detailData, selectedId]);

  const mutationSave = useMutation({
    mutationFn: (payload) =>
      selectedId ? updateTrainer(selectedId, payload) : createTrainer(payload),
    onSuccess: () => {
      toast.success(selectedId ? "Cập nhật thành công!" : "Tạo HLV thành công!");
      queryClient.invalidateQueries(["admin-trainers"]);
      handleCloseModal();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra khi lưu");
    },
  });

  const mutationDelete = useMutation({
    mutationFn: deleteTrainer,
    onSuccess: () => {
      toast.success("Xóa HLV thành công!");
      queryClient.invalidateQueries(["admin-trainers"]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Không thể xóa HLV");
    },
  });

  const mutationStatus = useMutation({
    mutationFn: ({ id, status }) => updateTrainerStatus(id, { status }),
    onSuccess: () => {
      toast.success("Cập nhật trạng thái thành công!");
      queryClient.invalidateQueries(["admin-trainers"]);
    },
  });

  const mutationUpload = useMutation({
    mutationFn: uploadTrainerImage,
    onSuccess: (data) => {
      setForm((prev) => ({ ...prev, image: data.data.url }));
      toast.success("Tải ảnh lên thành công");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Lỗi tải ảnh");
    },
  });

  const handleOpenModal = (id = null) => {
    setSelectedId(id);
    if (!id) setForm(emptyForm);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedId(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error("Ảnh không được vượt quá 8MB");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      mutationUpload.mutate(formData);
    }
  };

  const handleSave = () => {
    if (!form.name) {
      toast.error("Tên HLV là bắt buộc");
      return;
    }
    mutationSave.mutate(buildPayload(form));
  };

  const addSpecialty = () => {
    setForm((prev) => ({
      ...prev,
      specialties: [
        ...prev.specialties,
        { _id: Math.random().toString(36).substr(2, 9), icon: "dumbbell", label: "" },
      ],
    }));
  };

  const updateSpecialty = (id, field, value) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.map((spec) =>
        spec._id === id ? { ...spec, [field]: value } : spec
      ),
    }));
  };

  const removeSpecialty = (id) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((spec) => spec._id !== id),
    }));
  };

  const trainersList = useMemo(() => listData?.data || [], [listData]);
  const pagination = useMemo(
    () => ({
      totalPages: listData?.totalPages || 1,
      currentPage: listData?.currentPage || 1,
    }),
    [listData],
  );

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Users2 className="w-8 h-8 text-primary" />
            Đội ngũ HLV
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Quản lý thông tin và hình ảnh các Huấn luyện viên
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-primary-dark hover:-translate-y-0.5 transition-all"
        >
          <Plus size={18} />
          Thêm HLV
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Tìm kiếm HLV..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm font-medium shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[160px]"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="published">Đã xuất bản</option>
          <option value="draft">Bản nháp</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6"><TableSkeleton /></div>
          ) : trainersList.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Chưa có HLV nào.
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4">HLV</th>
                  <th className="px-6 py-4">Chức danh</th>
                  <th className="px-6 py-4 text-center">Featured</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trainersList.map((trainer) => (
                  <tr key={trainer._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-white shadow-sm">
                          {trainer.image ? (
                            <img
                              src={trainer.image}
                              alt={trainer.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-400">
                              <Users2 size={24} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-base">
                            {trainer.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate">
                            /{trainer.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium max-w-[200px] truncate">
                      {trainer.title || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {trainer.featured ? (
                        <Star className="inline-block text-amber-400 w-5 h-5 fill-amber-400" />
                      ) : (
                        <Star className="inline-block text-slate-300 w-5 h-5" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          mutationStatus.mutate({
                            id: trainer._id,
                            status: trainer.status === "published" ? "draft" : "published",
                          })
                        }
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold transition-all hover:scale-105 ${trainer.status === "published"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          }`}
                      >
                        {trainer.status === "published" ? "Published" : "Draft"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(trainer._id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                          title="Sửa"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              id: trainer._id,
                              name: trainer.name,
                            })
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Phân trang */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} /> Trước
            </button>
            <span className="text-sm font-medium text-slate-500">
              Trang {pagination.currentPage} / {pagination.totalPages}
            </span>
            <button
              disabled={page === pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50 transition-colors"
            >
              Sau <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Modal Cập nhật */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center bg-slate-900/40 p-4 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div
            className="w-full max-w-4xl rounded-2xl bg-slate-50 shadow-2xl mt-10 mb-20 relative flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 rounded-t-2xl sticky top-0 z-10">
              <h2 className="text-xl font-extrabold text-slate-800">
                {selectedId ? "Chỉnh sửa HLV" : "Thêm HLV mới"}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <Eye size={18} /> Preview
                </button>
                <button
                  onClick={handleCloseModal}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
              {isFetchingDetail ? (
                <div className="py-20 text-center text-slate-500 font-medium flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  Đang tải dữ liệu...
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Row 1: Ảnh đại diện & Thông tin chung */}
                  <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
                    {/* Cột trái: Ảnh */}
                    <div className="space-y-4">
                      <FormSectionTitle number="01" title="Hình ảnh" />
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <Field label="Ảnh đại diện">
                          <div className="mt-2 group relative h-[350px] w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-primary hover:bg-orange-50/50">
                            {form.image ? (
                              <>
                                <img
                                  src={form.image}
                                  alt="Preview"
                                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                  <span className="rounded-full bg-white/20 backdrop-blur-md p-3 text-white">
                                    <Upload size={24} />
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center text-slate-400">
                                <Upload size={32} className="mb-3 text-slate-300" />
                                <span className="text-sm font-medium">
                                  Click tải ảnh lên
                                </span>
                                <span className="text-xs mt-1">Tỷ lệ 3:4, max 8MB</span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFileChange}
                              className="absolute inset-0 cursor-pointer opacity-0"
                            />
                          </div>
                        </Field>
                        {mutationUpload.isLoading && (
                          <p className="mt-2 text-center text-sm font-medium text-primary animate-pulse">
                            Đang tải lên...
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cột phải: Thông tin */}
                    <div className="space-y-4">
                      <FormSectionTitle
                        number="02"
                        title="Thông tin cơ bản"
                      />
                      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
                        <Field label="Tên HLV *">
                          <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
                            placeholder="VD: Hoàng Thiện"
                          />
                        </Field>
                        <Field label="Slug (Tùy chọn - Tự động tạo nếu để trống)">
                          <input
                            type="text"
                            name="slug"
                            value={form.slug}
                            onChange={handleChange}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
                            placeholder="hoang-thien"
                          />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                          <Field label="Chức danh">
                            <input
                              type="text"
                              name="title"
                              value={form.title}
                              onChange={handleChange}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
                              placeholder="VD: Chuyên gia huấn luyện"
                            />
                          </Field>
                          <Field label="Kinh nghiệm">
                            <input
                              type="text"
                              name="experience"
                              value={form.experience}
                              onChange={handleChange}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
                              placeholder="VD: 4+ năm kinh nghiệm"
                            />
                          </Field>
                        </div>

                        <Field label="Giới thiệu (Bio)">
                          <textarea
                            name="bio"
                            value={form.bio}
                            onChange={handleChange}
                            rows={4}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary resize-y"
                            placeholder="Giới thiệu chi tiết..."
                          />
                        </Field>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                          <Field label="Trạng thái">
                            <select
                              name="status"
                              value={form.status}
                              onChange={handleChange}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm font-bold shadow-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                            >
                              <option value="draft">Bản nháp</option>
                              <option value="published">Đã xuất bản</option>
                            </select>
                          </Field>
                          <Field label="Thứ tự hiển thị">
                            <input
                              type="number"
                              name="sortOrder"
                              value={form.sortOrder}
                              onChange={handleChange}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-medium outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
                            />
                          </Field>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer pt-2">
                          <div className="relative flex items-center">
                            <input
                              type="checkbox"
                              name="featured"
                              checked={form.featured}
                              onChange={handleChange}
                              className="peer sr-only"
                            />
                            <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-primary"></div>
                            <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                          </div>
                          <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                            <Star size={16} className={form.featured ? "fill-amber-400 text-amber-400" : "text-slate-400"} />
                            Đánh dấu nổi bật
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Chuyên môn */}
                  <div className="space-y-4">
                    <FormSectionTitle
                      number="03"
                      title="Chuyên môn (Specialties)"
                      description="Các mảng huấn luyện chính của HLV"
                    />
                    <div className="rounded-xl border border-slate-200 bg-white p-6">
                      <div className="space-y-3">
                        {form.specialties.map((spec, index) => (
                          <div key={spec._id} className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 group">
                            <div className="w-10 h-10 shrink-0 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-primary shadow-sm">
                              {spec.icon === "dumbbell" && <Dumbbell size={20} />}
                              {spec.icon === "utensils" && <Utensils size={20} />}
                              {spec.icon === "chart-line" && <ChartLine size={20} />}
                              {spec.icon === "heart-pulse" && <HeartPulse size={20} />}
                            </div>
                            <div className="flex-1 grid grid-cols-[150px_1fr] gap-3">
                              <select
                                value={spec.icon}
                                onChange={(e) => updateSpecialty(spec._id, "icon", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              >
                                {availableIcons.map(icon => (
                                  <option key={icon.value} value={icon.value}>{icon.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={spec.label}
                                onChange={(e) => updateSpecialty(spec._id, "label", e.target.value)}
                                placeholder="Tên chuyên môn..."
                                className="w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              />
                            </div>
                            <button
                              onClick={() => removeSpecialty(spec._id)}
                              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={addSpecialty}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-bold text-slate-500 hover:border-primary hover:text-primary transition-colors bg-slate-50 hover:bg-orange-50/30"
                      >
                        <Plus size={18} />
                        Thêm Chuyên môn
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 rounded-b-2xl sticky bottom-0 z-10">
              <button
                onClick={handleCloseModal}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                disabled={mutationSave.isLoading || isFetchingDetail}
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary-dark hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {mutationSave.isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Save size={18} />
                )}
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm relative z-10">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Eye size={20} className="text-primary" />
              Preview Giao diện HLV
            </h2>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto w-full relative">
            {/* Sử dụng component Trainers truyền dữ liệu mock */}
            <div className="py-12 bg-white">
              <Trainers previewData={[getPreviewData(form)]} />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => mutationDelete.mutate(deleteConfirm?.id)}
        title="Xóa HLV"
        message={`Bạn có chắc chắn muốn xóa HLV "${deleteConfirm?.name}"?`}
      />
    </div>
  );
}
