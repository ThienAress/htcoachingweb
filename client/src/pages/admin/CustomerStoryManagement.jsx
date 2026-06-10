import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  BookOpenText,
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
} from "lucide-react";
import {
  createCustomerStory,
  deleteCustomerStory,
  getAdminCustomerStories,
  getAdminCustomerStoryById,
  updateCustomerStory,
  updateCustomerStoryStatus,
  uploadCustomerStoryImage,
} from "../../services/customerStory.service";
import { getOrders } from "../../services/order.service";
import { getAdminTrainers } from "../../services/trainer.service";
import CustomerStoryDetail from "../CustomerStoryDetail";
import { useDebounce } from "../../hooks/useDebounce";

const getPreviewData = (form, API_ORIGIN) => {
  const getUrl = (url) => (url && url.startsWith("/uploads/") ? `${API_ORIGIN}${url}` : url);
  return {
    ...form,
    heroImage: getUrl(form.heroImage),
    beforeImg: getUrl(form.beforeImg),
    afterImg: getUrl(form.afterImg),
    milestones: Array.isArray(form.milestones)
      ? form.milestones.map((m) => ({
        ...m,
        beforeImg: getUrl(m.beforeImg),
        afterImg: getUrl(m.afterImg),
        bullets: Array.isArray(m.bullets)
          ? m.bullets
          : String(m.bullets || "").split("\n").filter(Boolean),
      }))
      : [],
  };
};

const emptyForm = {
  orderId: "",
  trainerId: "",
  slug: "",
  name: "",
  age: "",
  job: "",
  result: "",
  duration: "",
  packageName: "",
  goal: "",
  startWeight: "",
  endWeight: "",
  schedule: "",
  message: "",
  problem: "",
  solution: "",
  quote: "",
  beforeImg: "",
  afterImg: "",
  heroImage: "",
  milestones: [],
  status: "draft",
  featured: false,
  isContinuing: false,
  sortOrder: 0,
};

const toLines = (value) => (Array.isArray(value) ? value.join("\n") : "");

const storyToForm = (story) => ({
  orderId: story.orderId || "",
  trainerId: story.trainerId || "",
  slug: story.slug || "",
  name: story.name || "",
  age: story.age || "",
  job: story.job || "",
  result: story.result || "",
  duration: story.duration || "",
  packageName: story.packageName || "",
  goal: story.goal || "",
  startWeight: story.startWeight || "",
  endWeight: story.endWeight || "",
  schedule: story.schedule || "",
  message: story.message || "",
  problem: story.problem || "",
  solution: story.solution || "",
  quote: story.quote || "",
  beforeImg: story.beforeImg || "",
  afterImg: story.afterImg || "",
  heroImage: story.heroImage || "",
  milestones: Array.isArray(story.milestones) ? story.milestones.map(m => ({
    ...m,
    _id: m._id || Math.random().toString(36).substr(2, 9),
    bullets: toLines(m.bullets)
  })) : [],
  status: story.status || "draft",
  featured: Boolean(story.featured),
  isContinuing: Boolean(story.isContinuing),
  sortOrder: Number(story.sortOrder || 0),
});

const buildPayload = (form) => {
  const milestones = Array.isArray(form.milestones)
    ? form.milestones.map((milestone, index) => ({
      title: milestone.title || "",
      subtitle: milestone.subtitle || "",
      content: milestone.content || "",
      beforeImg: milestone.beforeImg || "",
      afterImg: milestone.afterImg || "",
      bullets: String(milestone.bullets || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      sortOrder: Number(milestone.sortOrder ?? index),
    }))
    : [];
  if (!Array.isArray(milestones)) {
    throw new Error("Milestones phải là một mảng JSON");
  }

  return {
    orderId: form.orderId,
    trainerId: form.trainerId,
    slug: form.slug,
    name: form.name,
    age: form.age,
    job: form.job,
    result: form.result,
    duration: form.duration,
    packageName: form.packageName,
    goal: form.goal,
    startWeight: form.startWeight,
    endWeight: form.endWeight,
    schedule: form.schedule,
    message: form.message,
    problem: form.problem,
    solution: form.solution,
    quote: form.quote,
    beforeImg: form.beforeImg,
    afterImg: form.afterImg,
    heroImage: form.heroImage,
    milestones,
    status: form.status,
    featured: form.featured,
    isContinuing: form.isContinuing,
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
    {description && (
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    )}
  </div>
);

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "");

const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const getPreviewImageUrl = (url) => {
  if (!url || !url.startsWith("/uploads/")) return url;
  return `${API_ORIGIN}${url}`;
};

const CustomerStoryManagement = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingStory, setEditingStory] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploadingField, setUploadingField] = useState("");
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, existingStoryId: null });
  const limit = 10;

  const queryKey = useMemo(
    () => ["admin-customer-stories", page, status, debouncedSearch],
    [page, status, debouncedSearch],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      getAdminCustomerStories({
        page,
        limit,
        status,
        search: debouncedSearch,
      }),
    keepPreviousData: true,
  });

  const { data: ordersData } = useQuery({
    queryKey: ["admin-orders-for-story"],
    queryFn: () => getOrders(1, 0), // Lấy tất cả orders
  });
  const allOrders = ordersData?.data?.data?.orders || [];

  const { data: trainersData } = useQuery({
    queryKey: ["admin-trainers-for-story"],
    queryFn: () => getAdminTrainers({ page: 1, limit: 100 }),
  });
  const allTrainers = trainersData?.data || [];

  const stories = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const invalidateStories = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-customer-stories"] });

  const closeModal = () => {
    setIsModalOpen(false);
    setIsPreviewMode(false);
    setEditingStory(null);
    setForm(emptyForm);
  };

  const openCreateModal = () => {
    setEditingStory(null);
    setForm(emptyForm);
    setIsPreviewMode(false);
    setIsModalOpen(true);
  };

  const openEditModal = (story) => {
    setEditingStory(story);
    setForm(storyToForm(story));
    setIsPreviewMode(false);
    setIsModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createCustomerStory,
    onSuccess: () => {
      toast.success("Tạo câu chuyện khách hàng thành công");
      invalidateStories();
      closeModal();
    },
    onError: async (err) => {
      if (err.response?.status === 409 && err.response?.data?.existingStoryId) {
        setConfirmModal({ isOpen: true, existingStoryId: err.response.data.existingStoryId });
      } else {
        toast.error(err.response?.data?.message || "Lỗi tạo câu chuyện");
      }
    },
  });

  const handleConfirmEdit = async () => {
    try {
      const res = await getAdminCustomerStoryById(confirmModal.existingStoryId);
      if (res.data) {
        openEditModal(res.data);
        setConfirmModal({ isOpen: false, existingStoryId: null });
      }
    } catch (error) {
      toast.error("Không thể tải thông tin câu chuyện cũ.");
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateCustomerStory(id, payload),
    onSuccess: () => {
      toast.success("Cập nhật câu chuyện khách hàng thành công");
      invalidateStories();
      closeModal();
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi cập nhật câu chuyện"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, payload }) => updateCustomerStoryStatus(id, payload),
    onSuccess: () => {
      toast.success("Cập nhật trạng thái thành công");
      invalidateStories();
      queryClient.invalidateQueries({ queryKey: ["public-customer-stories"] });
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi cập nhật trạng thái"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomerStory,
    onSuccess: () => {
      toast.success("Xóa câu chuyện khách hàng thành công");
      invalidateStories();
      queryClient.invalidateQueries({ queryKey: ["public-customer-stories"] });
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Lỗi xóa câu chuyện"),
  });

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleImageUpload = async (field, file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setUploadingField(field);

    try {
      const res = await uploadCustomerStoryImage(formData);
      const imageUrl = res.data?.data?.url;
      if (!imageUrl) {
        toast.error("Upload thành công nhưng không nhận được URL ảnh");
        return;
      }

      updateForm(field, imageUrl);
      toast.success("Upload ảnh thành công");
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi upload ảnh");
    } finally {
      setUploadingField("");
    }
  };

  const updateMilestone = (index, field, value) => {
    setForm((current) => ({
      ...current,
      milestones: current.milestones.map((milestone, milestoneIndex) =>
        milestoneIndex === index ? { ...milestone, [field]: value } : milestone,
      ),
    }));
  };

  const addMilestone = () => {
    setForm((current) => ({
      ...current,
      milestones: [
        ...current.milestones,
        {
          _id: Math.random().toString(36).substr(2, 9),
          title: "",
          subtitle: "",
          content: "",
          beforeImg: "",
          afterImg: "",
          bullets: [],
          sortOrder: current.milestones.length,
        },
      ],
    }));
  };

  const removeMilestone = (index) => {
    setForm((current) => ({
      ...current,
      milestones: current.milestones.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const moveMilestone = (index, direction) => {
    setForm((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.milestones.length) {
        return current;
      }

      const nextMilestones = [...current.milestones];
      const movingId = nextMilestones[index]._id;

      [nextMilestones[index], nextMilestones[nextIndex]] = [
        nextMilestones[nextIndex],
        nextMilestones[index],
      ];

      setTimeout(() => {
        const el = document.getElementById(`milestone-${movingId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary", "transition-all");
          setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1000);
        }
      }, 50);

      return { ...current, milestones: nextMilestones };
    });
  };

  const updateMilestoneBullets = (index, value) => {
    updateMilestone(
      index,
      "bullets",
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  };

  const handleMilestoneImageUpload = async (index, field, file) => {
    if (!file) return;

    const uploadKey = `milestone-${index}-${field}`;
    const formData = new FormData();
    formData.append("file", file);
    setUploadingField(uploadKey);

    try {
      const res = await uploadCustomerStoryImage(formData);
      const imageUrl = res.data?.data?.url;
      if (!imageUrl) {
        toast.error("Upload thành công nhưng không nhận được URL ảnh");
        return;
      }

      updateMilestone(index, field, imageUrl);
      toast.success("Upload ảnh thành công");
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi upload ảnh");
    } finally {
      setUploadingField("");
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    try {
      const payload = buildPayload(form);

      // Validation
      if (!payload.name?.trim()) return toast.error("Vui lòng nhập Tên khách hàng");
      if (!payload.age || isNaN(Number(payload.age))) return toast.error("Vui lòng nhập Tuổi hợp lệ (phải là số)");
      if (!payload.job?.trim()) return toast.error("Vui lòng nhập Nghề nghiệp");
      if (!payload.goal?.trim()) return toast.error("Vui lòng nhập Mục tiêu");
      if (!payload.packageName?.trim()) return toast.error("Vui lòng nhập Gói tập");
      if (!payload.schedule?.trim()) return toast.error("Vui lòng nhập Lịch tập");
      if (!payload.startWeight || isNaN(Number(payload.startWeight))) return toast.error("Vui lòng nhập Cân nặng bắt đầu hợp lệ (phải là số)");
      if (!payload.endWeight || isNaN(Number(payload.endWeight))) return toast.error("Vui lòng nhập Cân nặng hiện tại hợp lệ (phải là số)");
      if (!payload.result?.trim()) return toast.error("Vui lòng nhập Kết quả");
      if (!payload.duration?.trim()) return toast.error("Vui lòng nhập Thời gian");

      // Chuyển kiểu dữ liệu chuẩn trước khi gửi
      payload.age = Number(payload.age);
      payload.startWeight = Number(payload.startWeight);
      payload.endWeight = Number(payload.endWeight);

      if (editingStory?._id) {
        updateMutation.mutate({ id: editingStory._id, payload });
        return;
      }
      createMutation.mutate(payload);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStatusToggle = (story) => {
    const nextStatus = story.status === "published" ? "draft" : "published";
    statusMutation.mutate({
      id: story._id,
      payload: {
        status: nextStatus,
        featured: story.featured,
      },
    });
  };

  const handleFeaturedToggle = (story) => {
    statusMutation.mutate({
      id: story._id,
      payload: {
        status: story.status,
        featured: !story.featured,
      },
    });
  };

  const handleDelete = (story) => {
    if (!window.confirm(`Xóa câu chuyện của ${story.name}?`)) return;
    deleteMutation.mutate(story._id);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const renderImageInput = (label, field) => (
    <Field label={label}>
      <div className="flex flex-col gap-2">
        <input
          className={inputClass}
          value={form[field]}
          onChange={(event) => updateForm(field, event.target.value)}
          placeholder="/uploads/customer-stories/example.webp"
        />
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary hover:text-primary">
          <Upload className="h-4 w-4" />
          {uploadingField === field ? "Đang upload..." : "Chọn ảnh"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={Boolean(uploadingField)}
            onChange={(event) => {
              handleImageUpload(field, event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {form[field] && (
          <img
            src={getPreviewImageUrl(form[field])}
            alt={label}
            className="h-28 w-full rounded-lg border border-slate-200 object-cover"
          />
        )}
      </div>
    </Field>
  );

  const renderMilestoneImageInput = (index, label, field) => {
    const milestone = form.milestones[index] || {};
    const uploadKey = `milestone-${index}-${field}`;

    return (
      <Field label={label}>
        <div className="flex flex-col gap-2">
          <input
            className={inputClass}
            value={milestone[field] || ""}
            onChange={(event) => updateMilestone(index, field, event.target.value)}
            placeholder="/uploads/customer-stories/example.webp"
          />
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary hover:text-primary">
            <Upload className="h-4 w-4" />
            {uploadingField === uploadKey ? "Đang upload..." : "Chọn ảnh"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={Boolean(uploadingField)}
              onChange={(event) => {
                handleMilestoneImageUpload(index, field, event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          {milestone[field] && (
            <img
              src={getPreviewImageUrl(milestone[field])}
              alt={label}
              className="h-28 w-full rounded-lg border border-slate-200 object-cover"
            />
          )}
        </div>
      </Field>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <ToastContainer position="top-right" autoClose={2500} />

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 md:text-3xl uppercase">
            <BookOpenText className="h-7 w-7 text-primary" />
            Quản lý câu chuyện khách hàng
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tạo, chỉnh sửa và publish case study hiển thị ngoài trang chủ.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          Thêm câu chuyện
        </button>
      </div>

      <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên, slug hoặc nghề nghiệp..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className={inputClass}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                  Khách hàng
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                  Kết quả
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">
                  Featured
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">
                    Đang tải danh sách...
                  </td>
                </tr>
              ) : stories.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">
                    Chưa có câu chuyện khách hàng nào.
                  </td>
                </tr>
              ) : (
                stories.map((story) => (
                  <tr key={story._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getPreviewImageUrl(story.beforeImg || story.heroImage)}
                          alt={story.name}
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-semibold text-slate-800">
                            {story.name}
                          </p>
                          <p className="text-xs text-slate-500">{story.slug}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {story.job || "Chưa có nghề nghiệp"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <p className="font-semibold text-primary">
                        {story.result || "Chưa nhập"}
                      </p>
                      <p>{story.duration || "Chưa nhập thời gian"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleStatusToggle(story)}
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${story.status === "published"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                          }`}
                      >
                        {story.status}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleFeaturedToggle(story)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${story.featured
                          ? "bg-primary/10 text-primary"
                          : "bg-slate-100 text-slate-500"
                          }`}
                      >
                        <Star className="h-3 w-3" />
                        {story.featured ? "Có" : "Không"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {story.status === "published" && (
                          <a
                            href={`/ket-qua-khach-hang/${story.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-primary hover:text-primary"
                            title="Xem trang public"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(story)}
                          className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-primary hover:text-primary"
                          title="Sửa"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(story)}
                          className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-red-500 hover:text-red-600"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(current - 1, 1))}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Trước
        </button>
        <p className="text-sm text-slate-500">
          Trang {page} / {totalPages}
        </p>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sau
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="my-8 sm:my-12 w-full max-w-5xl rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 uppercase">
                  {editingStory ? "Sửa câu chuyện" : "Thêm câu chuyện"}
                </h2>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPreviewMode(false)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${!isPreviewMode
                      ? "bg-primary text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    📝 Form Nhập Liệu
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewMode(true)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${isPreviewMode
                      ? "bg-black text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                  >
                    👁️ Xem Trước (Live Preview)
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 self-start"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className={`grid max-h-[72vh] gap-5 overflow-y-auto p-5 lg:grid-cols-2 ${isPreviewMode ? 'hidden' : ''}`}>
              <div className="space-y-4">
                <FormSectionTitle
                  number="01"
                  title="Thông tin chung"
                  description="Nhóm thông tin này tương ứng với sidebar bên trái của trang chi tiết."
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Chọn khách hàng">
                    <select
                      className={inputClass}
                      value={form.orderId || ""}
                      onChange={async (e) => {
                        const selectedId = e.target.value;
                        if (!selectedId) {
                          updateForm("orderId", "");
                          return;
                        }
                        const order = allOrders.find(o => o._id === selectedId);
                        if (order) {
                          setForm(prev => ({
                            ...prev,
                            orderId: order._id,
                            name: order.name || prev.name,
                            packageName: order.package || prev.packageName,
                            schedule: order.schedule || prev.schedule,
                          }));

                          // Tự động kiểm tra khách hàng đã có câu chuyện chưa ngay lập tức
                          if (!editingStory) {
                            try {
                              const searchRes = await getAdminCustomerStories({ search: order.name, limit: 5 });
                              const existingStory = searchRes.data.find(
                                (s) => s.name?.toLowerCase() === order.name?.toLowerCase() || s.orderId === order._id
                              );
                              if (existingStory) {
                                setConfirmModal({ isOpen: true, existingStoryId: existingStory._id });
                              }
                            } catch (error) {
                              console.error("Lỗi kiểm tra khách hàng trùng:", error);
                            }
                          }
                        }
                      }}
                    >
                      <option value="">-- Vui lòng chọn khách hàng --</option>
                      {allOrders.map(order => (
                        <option key={order._id} value={order._id}>
                          {order.name} - {order.package}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Chọn Huấn luyện viên">
                    <select
                      className={inputClass}
                      value={form.trainerId || ""}
                      onChange={(e) => updateForm("trainerId", e.target.value)}
                    >
                      <option value="">-- Không chọn (Chung) --</option>
                      {allTrainers.map((trainer) => (
                        <option key={trainer._id} value={trainer._id}>
                          {trainer.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Tên khách hàng">
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    required
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tuổi">
                    <input
                      className={inputClass}
                      value={form.age}
                      onChange={(event) => updateForm("age", event.target.value)}
                    />
                  </Field>
                  <Field label="Nghề nghiệp">
                    <input
                      className={inputClass}
                      value={form.job}
                      onChange={(event) => updateForm("job", event.target.value)}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Mục tiêu">
                      <textarea
                        className={inputClass}
                        rows="3"
                        value={form.goal}
                        onChange={(event) => updateForm("goal", event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Gói tập">
                    <input
                      className={inputClass}
                      value={form.packageName}
                      onChange={(event) =>
                        updateForm("packageName", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Lịch tập">
                    <input
                      className={inputClass}
                      value={form.schedule}
                      onChange={(event) =>
                        updateForm("schedule", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Cân nặng ban đầu">
                    <input
                      className={inputClass}
                      value={form.startWeight}
                      onChange={(event) =>
                        updateForm("startWeight", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Cân nặng hiện tại">
                    <input
                      className={inputClass}
                      value={form.endWeight}
                      onChange={(event) =>
                        updateForm("endWeight", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Kết quả ở trang chủ">
                    <input
                      className={inputClass}
                      value={form.result}
                      onChange={(event) =>
                        updateForm("result", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Thời gian đạt được kết quả">
                    <input
                      className={inputClass}
                      value={form.duration}
                      onChange={(event) =>
                        updateForm("duration", event.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-4">
                <FormSectionTitle
                  number="02"
                  title="Hero và ảnh chính"
                  description="Hero dùng cho đầu trang; before/after dùng cho block ảnh chính."
                />
                {renderImageInput("Hero image (Ảnh nền)", "heroImage")}
                <div className="grid gap-3 sm:grid-cols-2">
                  {renderImageInput("Ảnh Before của khách hàng", "beforeImg")}
                  {renderImageInput("Ảnh After của khách hàng", "afterImg")}
                </div>
                <FormSectionTitle
                  number="03"
                  title="Câu chuyện và giải pháp"
                  description="Nội dung này tương ứng các block vấn đề ban đầu, giải pháp và quote."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Vấn đề ban đầu của khách hàng">
                    <textarea
                      className={inputClass}
                      rows="4"
                      value={form.problem}
                      onChange={(event) =>
                        updateForm("problem", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Giải pháp của Huấn Luyện Viên">
                    <textarea
                      className={inputClass}
                      rows="4"
                      value={form.solution}
                      onChange={(event) =>
                        updateForm("solution", event.target.value)
                      }
                    />
                  </Field>
                </div>
                <Field label="Cảm nhận của khách hàng">
                  <textarea
                    className={inputClass}
                    rows="3"
                    value={form.quote}
                    onChange={(event) => updateForm("quote", event.target.value)}
                  />
                </Field>
              </div>

              <div className="space-y-4 lg:col-span-2">
                <FormSectionTitle
                  number="04"
                  title="Timeline hành trình"
                  description="Mỗi giai đoạn sẽ hiển thị theo thứ tự trong phần timeline của trang chi tiết."
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        Timeline hành trình
                      </h3>
                      <p className="text-sm text-slate-500">
                        Thêm từng giai đoạn, nội dung, bullet và ảnh before/after.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addMilestone}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm giai đoạn
                    </button>
                  </div>

                  {form.milestones.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      Chưa có giai đoạn nào. Bấm “Thêm giai đoạn” để bắt đầu.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {form.milestones.map((milestone, index) => (
                        <div
                          key={milestone._id || index}
                          id={`milestone-${milestone._id}`}
                          className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-300"
                        >
                          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-bold text-slate-800">
                              {milestone.title ? milestone.title : `Giai đoạn ${index + 1}`}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => moveMilestone(index, -1)}
                                disabled={index === 0}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Lên
                              </button>
                              <button
                                type="button"
                                onClick={() => moveMilestone(index, 1)}
                                disabled={index === form.milestones.length - 1}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Xuống
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMilestone(index)}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <Field label="Tiêu đề">
                              <input
                                className={inputClass}
                                value={milestone.title || ""}
                                onChange={(event) =>
                                  updateMilestone(index, "title", event.target.value)
                                }
                                placeholder="Tuần 1-4"
                              />
                            </Field>
                            <Field label={`Giai đoạn ${index + 1}`}>
                              <input
                                className={inputClass}
                                value={milestone.subtitle || ""}
                                onChange={(event) =>
                                  updateMilestone(
                                    index,
                                    "subtitle",
                                    event.target.value,
                                  )
                                }
                                placeholder="Ổn định form, thích nghi tập luyện..."
                              />
                            </Field>
                            <div className="md:col-span-2">
                              <Field label="Nội dung">
                                <textarea
                                  className={inputClass}
                                  rows="4"
                                  value={milestone.content || ""}
                                  onChange={(event) =>
                                    updateMilestone(
                                      index,
                                      "content",
                                      event.target.value,
                                    )
                                  }
                                />
                              </Field>
                            </div>
                            <div className="md:col-span-2">
                              <Field label="Kết quả đạt được ở giai đoạn này (mỗi dòng 1 ý)">
                                <textarea
                                  className={inputClass}
                                  rows="5"
                                  value={milestone.bullets || ""}
                                  onChange={(event) =>
                                    updateMilestone(index, "bullets", event.target.value)
                                  }
                                />
                              </Field>
                            </div>
                            {renderMilestoneImageInput(
                              index,
                              "Ảnh Before của khách hàng",
                              "beforeImg",
                            )}
                            {renderMilestoneImageInput(
                              index,
                              "Ảnh After của khách hàng",
                              "afterImg",
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <FormSectionTitle
                  number="06"
                  title="Hiển thị và publish"
                  description="Published cho phép xem ngoài public; Featured quyết định story có lên trang chủ hay không."
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Trạng thái">
                    <select
                      className={inputClass}
                      value={form.status}
                      onChange={(event) =>
                        updateForm("status", event.target.value)
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </Field>
                  <Field label="Thứ tự">
                    <input
                      className={inputClass}
                      type="number"
                      value={form.sortOrder}
                      onChange={(event) =>
                        updateForm("sortOrder", event.target.value)
                      }
                    />
                  </Field>
                  <label className="flex items-end gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(event) =>
                        updateForm("featured", event.target.checked)
                      }
                    />
                    Featured ngoài trang chủ
                  </label>
                  <label className="flex items-end gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isContinuing}
                      onChange={(event) =>
                        updateForm("isContinuing", event.target.checked)
                      }
                    />
                    Khách hàng này vẫn đang tiếp tục tập luyện
                  </label>
                </div>
              </div>
            </div>

            {isPreviewMode && (
              <div className="max-h-[72vh] overflow-y-auto bg-white border-y border-slate-100">
                <div className="pointer-events-none pb-10">
                  <CustomerStoryDetail previewData={getPreviewData(form, API_ORIGIN)} />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-800">Khách hàng đã tồn tại</h3>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Hệ thống phát hiện khách hàng này đã có một câu chuyện trước đó. Bạn có muốn chuyển sang trang chỉnh sửa câu chuyện của khách hàng này để cập nhật thêm không?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmModal({ isOpen: false, existingStoryId: null });
                  setForm(emptyForm);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmEdit}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition"
              >
                Đồng ý chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerStoryManagement;
