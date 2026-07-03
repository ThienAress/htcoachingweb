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
  const getUrls = (arr) => (Array.isArray(arr) ? arr.map(getUrl).filter(Boolean) : []);
  return {
    ...form,
    heroImage: getUrl(form.heroImage),
    beforeImg: getUrls(form.beforeImg),
    afterImg: getUrls(form.afterImg),
    milestones: Array.isArray(form.milestones)
      ? form.milestones.map((m) => ({
        ...m,
        beforeImg: getUrls(m.beforeImg),
        afterImg: getUrls(m.afterImg),
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
  beforeImg: [],
  afterImg: [],
  heroImage: "",
  heroPosition: 50,
  milestones: [],
  status: "draft",
  featured: false,
  isContinuing: false,
  sortOrder: 0,
};

const toLines = (value) => (Array.isArray(value) ? value.join("\n") : "");

const extractId = (value) => {
  if (!value) return "";
  if (typeof value === "object" && value._id) return value._id;
  return String(value);
};

const storyToForm = (story) => ({
  orderId: extractId(story.orderId),
  trainerId: extractId(story.trainerId),
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
  beforeImg: Array.isArray(story.beforeImg) ? story.beforeImg : (story.beforeImg ? [story.beforeImg] : []),
  afterImg: Array.isArray(story.afterImg) ? story.afterImg : (story.afterImg ? [story.afterImg] : []),
  heroImage: story.heroImage || "",
  heroPosition: Number(story.heroPosition) || 50,
  milestones: Array.isArray(story.milestones) ? story.milestones.map(m => ({
    ...m,
    _id: m._id || Math.random().toString(36).substr(2, 9),
    beforeImg: Array.isArray(m.beforeImg) ? m.beforeImg : (m.beforeImg ? [m.beforeImg] : []),
    afterImg: Array.isArray(m.afterImg) ? m.afterImg : (m.afterImg ? [m.afterImg] : []),
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
      beforeImg: Array.isArray(milestone.beforeImg) ? milestone.beforeImg.filter(Boolean) : [],
      afterImg: Array.isArray(milestone.afterImg) ? milestone.afterImg.filter(Boolean) : [],
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
    beforeImg: Array.isArray(form.beforeImg) ? form.beforeImg.filter(Boolean) : [],
    afterImg: Array.isArray(form.afterImg) ? form.afterImg.filter(Boolean) : [],
    heroImage: form.heroImage,
    heroPosition: Number(form.heroPosition) || 50,
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
          beforeImg: [],
          afterImg: [],
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
      if (!payload.goal?.trim()) return toast.error("Vui lòng nhập Mục tiêu");
      if (!payload.packageName?.trim()) return toast.error("Vui lòng nhập Gói tập");
      if (!payload.startWeight?.trim()) return toast.error("Vui lòng nhập Cân nặng bắt đầu");

      // Chuyển kiểu dữ liệu chuẩn trước khi gửi
      payload.age = Number(payload.age);

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

  const renderImageArrayInput = (label, field) => {
    const images = Array.isArray(form[field]) ? form[field] : [];
    return (
      <Field label={`${label} (tối đa 3 ảnh)`}>
        <div className="flex flex-col gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <input
                className={`${inputClass} flex-1`}
                value={url}
                onChange={(event) => {
                  const next = [...images];
                  next[idx] = event.target.value;
                  updateForm(field, next);
                }}
                placeholder="URL ảnh"
              />
              <button
                type="button"
                onClick={() => updateForm(field, images.filter((_, i) => i !== idx))}
                className="shrink-0 rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                title="Xóa ảnh"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {images.length < 3 && (
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary hover:text-primary">
              <Upload className="h-4 w-4" />
              {uploadingField === field ? "Đang upload..." : `Thêm ảnh (${images.length}/3)`}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                disabled={Boolean(uploadingField)}
                onChange={async (event) => {
                  const files = Array.from(event.target.files || []);
                  event.target.value = "";
                  if (!files.length) return;
                  const slots = 3 - images.length;
                  const toUpload = files.slice(0, slots);
                  if (files.length > slots) toast.error(`Chỉ còn ${slots} chỗ trống, đã bỏ ${files.length - slots} ảnh thừa`);
                  setUploadingField(field);
                  const uploaded = [];
                  for (const file of toUpload) {
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await uploadCustomerStoryImage(fd);
                      const imageUrl = res.data?.data?.url;
                      if (imageUrl) uploaded.push(imageUrl);
                    } catch (err) {
                      toast.error(`Lỗi upload ${file.name}: ${err.response?.data?.message || "Lỗi không xác định"}`);
                    }
                  }
                  if (uploaded.length) {
                    updateForm(field, [...images, ...uploaded]);
                    toast.success(`Upload thành công ${uploaded.length} ảnh`);
                  }
                  setUploadingField("");
                }}
              />
            </label>
          )}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, idx) => (
                <img
                  key={idx}
                  src={getPreviewImageUrl(url)}
                  alt={`${label} ${idx + 1}`}
                  className="h-24 w-full rounded-lg border border-slate-200 object-cover"
                />
              ))}
            </div>
          )}
        </div>
      </Field>
    );
  };

  const renderMilestoneImageArrayInput = (index, label, field) => {
    const milestone = form.milestones[index] || {};
    const images = Array.isArray(milestone[field]) ? milestone[field] : [];
    const uploadKey = `milestone-${index}-${field}`;

    return (
      <Field label={`${label} (tối đa 3 ảnh)`}>
        <div className="flex flex-col gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <input
                className={`${inputClass} flex-1`}
                value={url}
                onChange={(event) => {
                  const next = [...images];
                  next[idx] = event.target.value;
                  updateMilestone(index, field, next);
                }}
                placeholder="URL ảnh"
              />
              <button
                type="button"
                onClick={() => updateMilestone(index, field, images.filter((_, i) => i !== idx))}
                className="shrink-0 rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                title="Xóa ảnh"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {images.length < 3 && (
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary hover:text-primary">
              <Upload className="h-4 w-4" />
              {uploadingField === uploadKey ? "Đang upload..." : `Thêm ảnh (${images.length}/3)`}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                disabled={Boolean(uploadingField)}
                onChange={async (event) => {
                  const files = Array.from(event.target.files || []);
                  event.target.value = "";
                  if (!files.length) return;
                  const slots = 3 - images.length;
                  const toUpload = files.slice(0, slots);
                  if (files.length > slots) toast.error(`Chỉ còn ${slots} chỗ trống, đã bỏ ${files.length - slots} ảnh thừa`);
                  setUploadingField(uploadKey);
                  const uploaded = [];
                  for (const file of toUpload) {
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await uploadCustomerStoryImage(fd);
                      const imageUrl = res.data?.data?.url;
                      if (imageUrl) uploaded.push(imageUrl);
                    } catch (err) {
                      toast.error(`Lỗi upload ${file.name}: ${err.response?.data?.message || "Lỗi không xác định"}`);
                    }
                  }
                  if (uploaded.length) {
                    updateMilestone(index, field, [...images, ...uploaded]);
                    toast.success(`Upload thành công ${uploaded.length} ảnh`);
                  }
                  setUploadingField("");
                }}
              />
            </label>
          )}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, idx) => (
                <img
                  key={idx}
                  src={getPreviewImageUrl(url)}
                  alt={`${label} ${idx + 1}`}
                  className="h-24 w-full rounded-lg border border-slate-200 object-cover"
                />
              ))}
            </div>
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
                          src={getPreviewImageUrl((Array.isArray(story.beforeImg) ? story.beforeImg[0] : story.beforeImg) || story.heroImage)}
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
                {form.heroImage && (
                  <Field label="Kéo ảnh để chọn vị trí hiển thị">
                    <div
                      className="group relative h-44 w-full cursor-grab overflow-hidden rounded-lg border border-slate-200 bg-slate-100 active:cursor-grabbing"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const container = e.currentTarget;
                        const startY = e.clientY;
                        const startPos = Number(form.heroPosition) || 50;
                        const onMove = (moveEvent) => {
                          const delta = moveEvent.clientY - startY;
                          const pct = Math.max(0, Math.min(100, startPos + (delta / container.offsetHeight) * 100));
                          updateForm("heroPosition", Math.round(pct));
                        };
                        const onUp = () => {
                          document.removeEventListener("mousemove", onMove);
                          document.removeEventListener("mouseup", onUp);
                        };
                        document.addEventListener("mousemove", onMove);
                        document.addEventListener("mouseup", onUp);
                      }}
                      onTouchStart={(e) => {
                        const container = e.currentTarget;
                        const startY = e.touches[0].clientY;
                        const startPos = Number(form.heroPosition) || 50;
                        const onMove = (moveEvent) => {
                          const delta = moveEvent.touches[0].clientY - startY;
                          const pct = Math.max(0, Math.min(100, startPos + (delta / container.offsetHeight) * 100));
                          updateForm("heroPosition", Math.round(pct));
                        };
                        const onEnd = () => {
                          container.removeEventListener("touchmove", onMove);
                          container.removeEventListener("touchend", onEnd);
                        };
                        container.addEventListener("touchmove", onMove, { passive: true });
                        container.addEventListener("touchend", onEnd);
                      }}
                    >
                      <img
                        src={getPreviewImageUrl(form.heroImage)}
                        alt="Hero preview"
                        className="pointer-events-none absolute inset-x-0 h-[200%] w-full object-cover"
                        style={{ top: `${-((Number(form.heroPosition) || 50) / 100) * 100}%` }}
                        draggable={false}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                        <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                          ↕ Kéo để điều chỉnh vị trí
                        </span>
                      </div>
                      <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {form.heroPosition ?? 50}%
                      </span>
                    </div>
                  </Field>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {renderImageArrayInput("Ảnh Before", "beforeImg")}
                  {renderImageArrayInput("Ảnh After", "afterImg")}
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
                            {renderMilestoneImageArrayInput(
                              index,
                              "Ảnh Before",
                              "beforeImg",
                            )}
                            {renderMilestoneImageArrayInput(
                              index,
                              "Ảnh After",
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
