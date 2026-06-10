import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, Link } from "react-router-dom";
import {
  Users2,
  ChevronLeft,
  ChevronRight,
  Edit,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  Upload,
  X,
  Eye,
  Settings,
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
import SetupProfileModal from "./SetupProfileModal";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "");
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const availableIcons = [
  { value: "dumbbell", label: "Tạ (Dumbbell)" },
  { value: "utensils", label: "Dinh dưỡng (Utensils)" },
  { value: "chart-line", label: "Biểu đồ (Chart)" },
  { value: "heart-pulse", label: "Sức khỏe (Heart)" },
];

const getPreviewData = (form) => {
  const getUrl = (url) => (url && url.startsWith("/uploads/") ? `${API_ORIGIN}${url}` : url);
  return {
    ...form,
    image: form.images?.[0] || getUrl(form.image),
    specialties: Array.isArray(form.specialties) ? form.specialties : [],
  };
};

const emptyForm = {
  slug: "",
  name: "",
  title: "",
  experience: "",
  bio: "",
  images: [],
  specialties: [],
  status: "draft",
  featured: false,
  isHeadCoach: false,
  sortOrder: 0,
};

const trainerToForm = (trainer) => {
  let images = [];
  if (Array.isArray(trainer.images) && trainer.images.length > 0) {
    images = trainer.images;
  } else if (trainer.image) {
    images = [trainer.image];
  }
  return {
    slug: trainer.slug || "",
    name: trainer.name || "",
    title: trainer.title || "",
    experience: trainer.experience || "",
    bio: trainer.bio || "",
    images,
    specialties: Array.isArray(trainer.specialties) ? trainer.specialties.map(s => ({ ...s, _id: s._id || Math.random().toString(36).substr(2, 9) })) : [],
    status: trainer.status || "draft",
    featured: Boolean(trainer.featured),
    isHeadCoach: Boolean(trainer.isHeadCoach),
    sortOrder: Number(trainer.sortOrder || 0),
  };
};

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
    images: Array.isArray(form.images) ? form.images.filter(Boolean) : [],
    specialties,
    status: form.status,
    featured: form.featured,
    isHeadCoach: form.isHeadCoach,
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

export default function TrainerManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState("");
  // Setup Profile Modal state
  const [isSetupProfileOpen, setIsSetupProfileOpen] = useState(false);
  const [setupProfileTrainerId, setSetupProfileTrainerId] = useState(null);
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

  const trainers = listData?.data || [];
  const totalPages = listData?.pagination?.totalPages || 1;

  const createMutation = useMutation({
    mutationFn: createTrainer,
    onSuccess: () => {
      toast.success("Thêm HLV thành công!");
      queryClient.invalidateQueries(["admin-trainers"]);
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi thêm HLV"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateTrainer(id, data),
    onSuccess: () => {
      toast.success("Cập nhật HLV thành công!");
      queryClient.invalidateQueries(["admin-trainers"]);
      queryClient.invalidateQueries(["admin-trainer-detail", selectedId]);
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi cập nhật HLV"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTrainer,
    onSuccess: () => {
      toast.success("Xóa HLV thành công!");
      queryClient.invalidateQueries(["admin-trainers"]);
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi xóa HLV"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateTrainerStatus(id, status),
    onSuccess: () => {
      toast.success("Cập nhật trạng thái thành công!");
      queryClient.invalidateQueries(["admin-trainers"]);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi cập nhật trạng thái"),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadTrainerImage,
    onSuccess: (res) => {
      const imageUrl = res.data?.data?.url || res.data?.url;
      if (!imageUrl) {
        toast.error("Upload thành công nhưng không nhận được URL ảnh");
        return;
      }
      toast.success("Tải ảnh lên thành công!");
      setForm((prev) => {
        const newImages = [...prev.images];
        newImages[0] = imageUrl;
        return { ...prev, images: newImages };
      });
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi tải ảnh lên"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = buildPayload(form);
    if (selectedId) {
      updateMutation.mutate({ id: selectedId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleOpenCreate = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (id) => {
    setSelectedId(id);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setDeleteConfirm(id);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      uploadMutation.mutate(formData);
    }
    // reset input
    e.target.value = "";
  };

  const getImageUrl = (url) => {
    if (!url) return "https://placehold.co/400x400/1e293b/94a3b8?text=Trainer";
    if (url.startsWith("http") || url.startsWith("data:")) return url;
    return `${API_ORIGIN}${url}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ToastContainer position="top-right" autoClose={2500} />
      
      {/* HEADER */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black uppercase text-slate-800">
            <Users2 className="text-primary" size={28} />
            Quản lý đội ngũ HLV
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý danh sách HLV hiển thị ngoài Trang Chủ.
          </p>
        </div>
        <div className="flex gap-2">
            <button
              onClick={() => {
                setSetupProfileTrainerId(null);
                setIsSetupProfileOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-800/30 transition-all hover:-translate-y-0.5 hover:shadow-slate-800/40"
            >
              <Settings size={18} />
              Thiết Lập Profile
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-primary/40"
            >
              <Plus size={18} />
              Thêm HLV Mới
            </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Tìm kiếm HLV..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:w-48"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="published">Đã xuất bản</option>
          <option value="draft">Bản nháp</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Huấn luyện viên</th>
                <th className="px-6 py-4">Chức danh / Kinh nghiệm</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Thứ tự</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8">
                    <TableSkeleton />
                  </td>
                </tr>
              ) : trainers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Users2 size={48} className="mb-4 text-slate-300" />
                      <p className="text-base font-medium">Không tìm thấy HLV nào</p>
                    </div>
                  </td>
                </tr>
              ) : (
                trainers.map((trainer) => (
                  <tr key={trainer._id} className="group transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img
                            src={getImageUrl(trainer.images?.[0] || trainer.image)}
                            alt={trainer.name}
                            className="h-16 w-16 rounded-xl object-cover shadow-sm"
                          />
                          {trainer.featured && (
                            <div className="absolute -right-2 -top-2 rounded-full bg-yellow-400 p-1 text-white shadow">
                              <Star size={12} className="fill-current" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{trainer.name}</div>
                          <div className="text-xs text-slate-500">/{trainer.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-700">{trainer.title || "Chưa có"}</div>
                      <div className="text-xs text-slate-500 mt-1">{trainer.experience || "Chưa có"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={trainer.status}
                        onChange={(e) =>
                          statusMutation.mutate({ id: trainer._id, status: e.target.value })
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider focus:outline-none ${
                          trainer.status === "published"
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <option value="published">Đã xuất bản</option>
                        <option value="draft">Bản nháp</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-slate-100 px-2 font-bold text-slate-600">
                        {trainer.sortOrder}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSetupProfileTrainerId(trainer._id);
                            setIsSetupProfileOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Cài đặt Profile chi tiết"
                        >
                          <Settings size={18} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(trainer._id)}
                          title="Sửa HLV"
                          className="rounded-lg bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(trainer._id)}
                          title="Xóa HLV"
                          className="rounded-lg bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
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

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              <ChevronLeft size={16} /> Trước
            </button>
            <span className="text-sm font-medium text-slate-500">
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              Sau <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Setup Profile Modal */}
      {isSetupProfileOpen && (
        <SetupProfileModal
          trainers={listData?.data || []}
          initialTrainerId={setupProfileTrainerId}
          onClose={() => {
            setIsSetupProfileOpen(false);
            setSetupProfileTrainerId(null);
          }}
        />
      )}

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            className="my-8 sm:my-12 w-full max-w-4xl rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase">
                  {selectedId ? "Chỉnh sửa HLV Trang Chủ" : "Thêm HLV Mới"}
                </h2>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${!isPreviewOpen
                      ? "bg-primary text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    📝 Form Nhập Liệu
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(true)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${isPreviewOpen
                      ? "bg-black text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    👁️ Xem Trước (Live Preview)
                  </button>
                </div>
              </div>
              <button
                onClick={() => { setIsModalOpen(false); setIsPreviewOpen(false); }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 self-start"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className={`max-h-[75vh] overflow-y-auto p-6 md:p-8 ${isPreviewOpen ? 'hidden' : ''}`}>
              {isFetchingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
              ) : (
                <form id="trainer-form" onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid gap-8 lg:grid-cols-2">
                    <div className="space-y-6">
                      <FormSectionTitle number="01" title="Thông tin cơ bản" description="Sử dụng để hiển thị trên Card." />
                      <Field label="Tên HLV *">
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="VD: Hoàng Thiện"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Chức danh">
                          <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="VD: Chuyên gia"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </Field>
                        <Field label="Kinh nghiệm">
                          <input
                            type="text"
                            value={form.experience}
                            onChange={(e) => setForm({ ...form, experience: e.target.value })}
                            placeholder="VD: 4+ năm kinh nghiệm"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </Field>
                      </div>

                      <div className="flex items-center gap-2 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                        <input
                          type="checkbox"
                          id="isHeadCoach"
                          checked={form.isHeadCoach}
                          onChange={(e) => setForm({ ...form, isHeadCoach: e.target.checked })}
                          className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                        />
                        <label htmlFor="isHeadCoach" className="font-bold text-slate-800 cursor-pointer">
                          Đây là Profile của Head Coach / Admin
                          <p className="text-xs font-normal text-slate-500 mt-0.5">Tự động hiển thị tất cả khách hàng chưa gán HLV lên Profile này.</p>
                        </label>
                      </div>
                      <Field label="Tiểu sử ngắn (Bio)">
                        <textarea
                          rows={4}
                          value={form.bio}
                          onChange={(e) => setForm({ ...form, bio: e.target.value })}
                          placeholder="Mô tả ngắn gọn về phong cách, triết lý..."
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                        />
                      </Field>

                      <FormSectionTitle number="02" title="Ảnh đại diện" description="Ảnh tỷ lệ 4:5 hiển thị trên Card HLV." />
                      <div className="flex items-start gap-6">
                        <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 shadow-inner">
                          {form.images?.[0] ? (
                            <img
                              src={getImageUrl(form.images[0])}
                              alt="Preview"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-slate-400">
                              <Users2 size={24} />
                            </div>
                          )}
                          {uploadMutation.isPending && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-6 hover:bg-slate-100 transition-colors">
                            <Upload className="mb-2 text-slate-400" size={20} />
                            <span className="text-sm font-semibold text-slate-600">
                              Tải ảnh mới lên
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFileChange}
                              className="hidden"
                              disabled={uploadMutation.isPending}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <FormSectionTitle number="03" title="Chuyên môn huấn luyện" description="Các mục liệt kê bên dưới tiểu sử." />
                      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
                        {form.specialties.map((spec, index) => (
                          <div key={spec._id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100">
                            <select
                              value={spec.icon}
                              onChange={(e) => {
                                const newArr = [...form.specialties];
                                newArr[index].icon = e.target.value;
                                setForm({ ...form, specialties: newArr });
                              }}
                              className="w-12 rounded-lg bg-white px-1 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-center"
                            >
                              <option value="dumbbell">🏋️</option>
                              <option value="utensils">🥗</option>
                              <option value="chart-line">📈</option>
                              <option value="heart-pulse">❤️</option>
                            </select>
                            <input
                              type="text"
                              value={spec.label}
                              onChange={(e) => {
                                const newArr = [...form.specialties];
                                newArr[index].label = e.target.value;
                                setForm({ ...form, specialties: newArr });
                              }}
                              placeholder="Nhập tên chuyên môn..."
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, specialties: form.specialties.filter((_, i) => i !== index) })}
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        {form.specialties.length < 5 && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, specialties: [...form.specialties, { _id: Math.random().toString(), icon: "dumbbell", label: "" }] })}
                            className="w-full rounded-lg border-2 border-dashed border-slate-200 py-2.5 text-sm font-bold text-slate-500 hover:border-primary hover:text-primary transition-colors hover:bg-slate-50 flex items-center justify-center gap-2 mt-2"
                          >
                            <Plus size={16} /> Thêm chuyên môn
                          </button>
                        )}
                      </div>

                      <FormSectionTitle number="04" title="Trạng thái & Hiển thị" />
                      <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-slate-200 bg-white p-5">
                        <Field label="Trạng thái">
                          <select
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="draft">Bản nháp</option>
                            <option value="published">Đã xuất bản</option>
                          </select>
                        </Field>
                        <Field label="Thứ tự hiển thị">
                          <input
                            type="number"
                            value={form.sortOrder}
                            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </Field>
                        <label className="col-span-2 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100">
                          <input
                            type="checkbox"
                            checked={form.featured}
                            onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                            className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-bold text-slate-700">HLV Nổi bật (Hiển thị đầu tiên)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* PREVIEW TAB CONTENT */}
            {isPreviewOpen && (
              <div className="max-h-[75vh] overflow-y-auto p-4 md:p-8 bg-[#1a1a1a]">
                <div className="mx-auto max-w-7xl">
                  <Trainers previewData={[getPreviewData(form)]} />
                </div>
              </div>
            )}



            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-b-2xl">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setIsPreviewOpen(false); }}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="trainer-form"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-primary/40 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <Save size={18} />
                )}
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteMutation.mutate(deleteConfirm)}
        title="Xác nhận xóa HLV"
        message="Bạn có chắc chắn muốn xóa Huấn luyện viên này? Hành động này không thể hoàn tác."
      />
    </div>
  );
}
