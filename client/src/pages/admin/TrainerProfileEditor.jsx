import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  Save,
  Plus,
  Trash2,
  Upload,
  X,
  Dumbbell,
  Utensils,
  ChartLine,
  HeartPulse,
} from "lucide-react";
import {
  getAdminTrainerById,
  updateTrainer,
  uploadTrainerImage,
} from "../../services/trainer.service";
import TrainerProfile from "../TrainerProfile";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "");
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const availableIcons = [
  { value: "dumbbell", label: "Tạ (Dumbbell)" },
  { value: "utensils", label: "Dinh dưỡng (Utensils)" },
  { value: "chart-line", label: "Biểu đồ (Chart)" },
  { value: "heart-pulse", label: "Sức khỏe (Heart)" },
];

const getPreviewData = (form, basicInfo) => {
  const getUrl = (url) => (url && url.startsWith("/uploads/") ? `${API_ORIGIN}${url}` : url);
  const images = Array.isArray(form.images) ? form.images.map(getUrl) : [];
  return {
    ...basicInfo, // Name, slug, title, experience etc.
    ...form,
    images,
    specialties: Array.isArray(form.specialties) ? form.specialties : [],
  };
};

const emptyProfileForm = {
  motto: "",
  trainingStyle: "",
  achievements: [],
  images: [],
  specialties: [],
  headline: "",
  philosophy: "",
  videoIntro: "",
  stats: [],
  certifications: [],
  faqs: [],
  socialLinks: { facebook: "", instagram: "", tiktok: "", zalo: "" },
};

const trainerToProfileForm = (trainer) => {
  let images = [];
  if (Array.isArray(trainer.images) && trainer.images.length > 0) {
    images = trainer.images;
  } else if (trainer.image) {
    images = [trainer.image];
  }
  return {
    motto: trainer.motto || "",
    trainingStyle: trainer.trainingStyle || "",
    achievements: Array.isArray(trainer.achievements) ? trainer.achievements.map(a => ({ _id: Math.random().toString(36).substr(2, 9), value: a })) : [],
    images,
    specialties: Array.isArray(trainer.specialties) ? trainer.specialties.map(s => ({ ...s, _id: s._id || Math.random().toString(36).substr(2, 9) })) : [],
    headline: trainer.headline || "",
    philosophy: trainer.philosophy || "",
    videoIntro: trainer.videoIntro || "",
    stats: Array.isArray(trainer.stats) ? trainer.stats.map(s => ({ ...s, _id: s._id || Math.random().toString(36).substr(2, 9) })) : [],
    certifications: Array.isArray(trainer.certifications) ? trainer.certifications.map(c => ({ _id: Math.random().toString(36).substr(2, 9), value: c })) : [],
    faqs: Array.isArray(trainer.faqs) ? trainer.faqs.map(f => ({ ...f, _id: f._id || Math.random().toString(36).substr(2, 9) })) : [],
    socialLinks: {
      facebook: trainer.socialLinks?.facebook || "",
      instagram: trainer.socialLinks?.instagram || "",
      tiktok: trainer.socialLinks?.tiktok || "",
      zalo: trainer.socialLinks?.zalo || "",
    },
  };
};

const buildPayload = (form) => {
  const specialties = Array.isArray(form.specialties)
    ? form.specialties.map((spec) => ({
      icon: spec.icon || "dumbbell",
      label: spec.label || "",
    }))
    : [];
    
  const stats = form.stats.map(s => ({ label: s.label, value: s.value }));
  const certifications = form.certifications.map(c => c.value).filter(Boolean);
  const faqs = form.faqs.map(f => ({ question: f.question, answer: f.answer }));
  const achievements = Array.isArray(form.achievements) ? form.achievements.map(a => a.value).filter(Boolean) : [];

  return {
    motto: form.motto,
    trainingStyle: form.trainingStyle,
    achievements,
    images: Array.isArray(form.images) ? form.images.filter(Boolean) : [],
    specialties,
    headline: form.headline,
    philosophy: form.philosophy,
    videoIntro: form.videoIntro,
    stats,
    certifications,
    faqs,
    socialLinks: form.socialLinks,
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

export default function TrainerProfileEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyProfileForm);
  const [basicInfo, setBasicInfo] = useState({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: detailData, isFetching: isFetchingDetail } = useQuery({
    queryKey: ["admin-trainer-detail", id],
    queryFn: () => getAdminTrainerById(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (detailData?.data && id) {
      setForm(trainerToProfileForm(detailData.data));
      setBasicInfo(detailData.data);
    }
  }, [detailData, id]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateTrainer(id, data),
    onSuccess: () => {
      toast.success("Cập nhật Profile thành công!");
      queryClient.invalidateQueries(["admin-trainers"]);
      queryClient.invalidateQueries(["admin-trainer-detail", id]);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi cập nhật Profile"),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadTrainerImage,
    onSuccess: (res) => {
      toast.success("Tải ảnh lên thành công!");
      return res.url;
    },
    onError: () => toast.error("Lỗi khi tải ảnh lên"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = buildPayload(form);
    updateMutation.mutate({ id, data: payload });
  };

  const handleImageUpload = async (e, index) => {
    const file = e.target.files[0];
    if (file) {
      const url = await uploadMutation.mutateAsync(file);
      setForm(prev => {
        const newImages = [...prev.images];
        newImages[index] = url;
        return { ...prev, images: newImages };
      });
    }
  };

  const handleAddImage = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (form.images.length >= 3) {
        toast.error("Tối đa chỉ được tải lên 3 ảnh!");
        return;
      }
      const url = await uploadMutation.mutateAsync(file);
      setForm(prev => ({
        ...prev,
        images: [...prev.images, url]
      }));
    }
  };

  const removeImage = (index) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const getImageUrl = (url) => {
    if (!url) return "https://placehold.co/400x400/1e293b/94a3b8?text=Image";
    if (url.startsWith("http") || url.startsWith("data:")) return url;
    return `${API_ORIGIN}${url}`;
  };

  if (isFetchingDetail && !basicInfo._id) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* HEADER */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/trainers"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black uppercase text-slate-800">
              Cài Đặt Profile: <span className="text-primary">{basicInfo.name}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý hình ảnh và thông tin chi tiết hiển thị trên trang Profile cá nhân.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Eye size={18} />
            Xem Preview
          </button>
          <button
            type="submit"
            form="profile-form"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-primary/40 disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              <Save size={18} />
            )}
            Lưu Thay Đổi
          </button>
        </div>
      </div>

      <form id="profile-form" onSubmit={handleSubmit} className="space-y-8">
        
        {/* GALLERY SECTION */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <FormSectionTitle number="01" title="Thư viện ảnh (Gallery)" description="Hiển thị ở trang Profile, tối đa 3 ảnh. Ảnh đầu tiên (Ảnh đại diện) sẽ được sử dụng làm ảnh chính." />
          <div className="mt-6 flex flex-wrap gap-6">
            {form.images.map((imgUrl, index) => (
              <div key={index} className="relative h-40 w-32 shrink-0 overflow-hidden rounded-2xl bg-slate-100 shadow-inner group">
                <img src={getImageUrl(imgUrl)} alt="Preview" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="cursor-pointer rounded-lg bg-white/20 p-2 text-white hover:bg-white/40 transition-colors backdrop-blur-sm">
                    <Upload size={16} />
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, index)} className="hidden" />
                  </label>
                  {index > 0 && (
                    <button type="button" onClick={() => removeImage(index)} className="rounded-lg bg-red-500/80 p-2 text-white hover:bg-red-600 transition-colors backdrop-blur-sm">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {index === 0 && (
                  <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-md">Ảnh chính</div>
                )}
              </div>
            ))}
            
            {form.images.length < 3 && (
              <label className="flex h-40 w-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                <Plus className="mb-2 text-slate-400" size={24} />
                <span className="text-xs font-semibold text-slate-500 text-center px-2">Thêm ảnh</span>
                <input type="file" accept="image/*" onChange={handleAddImage} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* HERO INFO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <FormSectionTitle number="02" title="Châm ngôn & Headline" description="Dòng chữ nổi bật hiển thị ở đầu trang Profile." />
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field label="Châm ngôn (Motto)">
              <input
                type="text"
                value={form.motto}
                onChange={(e) => setForm({ ...form, motto: e.target.value })}
                placeholder="VD: Không đau đớn, không thành công"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="Headline">
              <input
                type="text"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                placeholder="VD: Chuyên gia kiến tạo vóc dáng"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Phong cách huấn luyện">
                <textarea
                  rows={2}
                  value={form.trainingStyle}
                  onChange={(e) => setForm({ ...form, trainingStyle: e.target.value })}
                  placeholder="Mô tả phong cách huấn luyện..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Triết lý huấn luyện (Philosophy)">
                <textarea
                  rows={3}
                  value={form.philosophy}
                  onChange={(e) => setForm({ ...form, philosophy: e.target.value })}
                  placeholder="Mô tả triết lý..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* ACHIEVEMENTS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <FormSectionTitle number="03" title="Thành tích nổi bật" description="Các thành tựu cá nhân hoặc bằng cấp." />
          <div className="mt-6 space-y-3">
            {form.achievements.map((item, index) => (
              <div key={item._id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => {
                    const newArr = [...form.achievements];
                    newArr[index].value = e.target.value;
                    setForm({ ...form, achievements: newArr });
                  }}
                  placeholder="Nhập thành tích..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, achievements: form.achievements.filter((_, i) => i !== index) });
                  }}
                  className="rounded-xl bg-red-50 p-2.5 text-red-500 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm({
                ...form,
                achievements: [...form.achievements, { _id: Math.random().toString(), value: "" }]
              })}
              className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Plus size={16} /> Thêm thành tích
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <FormSectionTitle number="04" title="Chỉ số (Stats)" description="Các chỉ số ấn tượng (VD: 500+ Khách hàng, 5 Năm Kinh nghiệm)." />
          <div className="mt-6 space-y-3">
            {form.stats.map((stat, index) => (
              <div key={stat._id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={stat.value}
                  onChange={(e) => {
                    const newStats = [...form.stats];
                    newStats[index].value = e.target.value;
                    setForm({ ...form, stats: newStats });
                  }}
                  placeholder="VD: 500+"
                  className="w-1/3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  value={stat.label}
                  onChange={(e) => {
                    const newStats = [...form.stats];
                    newStats[index].label = e.target.value;
                    setForm({ ...form, stats: newStats });
                  }}
                  placeholder="VD: Khách hàng thay đổi"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, stats: form.stats.filter((_, i) => i !== index) })}
                  className="rounded-xl bg-red-50 p-2.5 text-red-500 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm({ ...form, stats: [...form.stats, { _id: Math.random().toString(), label: "", value: "" }] })}
              className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Plus size={16} /> Thêm chỉ số
            </button>
          </div>
        </div>

        {/* SOCIAL LINKS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <FormSectionTitle number="05" title="Mạng xã hội (Social Links)" description="Liên kết trang cá nhân hiển thị trên Profile." />
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field label="Facebook">
              <input
                type="url"
                value={form.socialLinks.facebook}
                onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, facebook: e.target.value } })}
                placeholder="https://facebook.com/..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="Instagram">
              <input
                type="url"
                value={form.socialLinks.instagram}
                onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, instagram: e.target.value } })}
                placeholder="https://instagram.com/..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="TikTok">
              <input
                type="url"
                value={form.socialLinks.tiktok}
                onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, tiktok: e.target.value } })}
                placeholder="https://tiktok.com/@..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="Zalo (Số điện thoại hoặc Link)">
              <input
                type="text"
                value={form.socialLinks.zalo}
                onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, zalo: e.target.value } })}
                placeholder="VD: 0901234567 hoặc https://zalo.me/..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
          </div>
        </div>

        {/* VIDEO INTRO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <FormSectionTitle number="06" title="Video giới thiệu" description="Link YouTube hoặc URL video trực tiếp. Nếu để trống sẽ không hiển thị trên Profile." />
          <div className="mt-6">
            <Field label="Video URL">
              <input
                type="url"
                value={form.videoIntro}
                onChange={(e) => setForm({ ...form, videoIntro: e.target.value })}
                placeholder="https://youtube.com/watch?v=... hoặc link video trực tiếp"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            {form.videoIntro && (
              <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video">
                {form.videoIntro.includes("youtube.com") || form.videoIntro.includes("youtu.be") ? (
                  <iframe
                    src={form.videoIntro.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                    className="w-full h-full"
                    allowFullScreen
                    title="Video Preview"
                  />
                ) : (
                  <video src={form.videoIntro} controls className="w-full h-full object-contain" />
                )}
              </div>
            )}
          </div>
        </div>

      </form>

      {/* PREVIEW MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden">
          {/* Top Bar */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-slate-900 px-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Chế độ xem trước</h2>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20 transition-colors"
            >
              <X size={16} /> Đóng Preview
            </button>
          </div>
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto bg-[#1a1a1a]">
            {/* Truyền toàn bộ form hiện tại vào TrainerProfile dưới dạng previewData */}
            <TrainerProfile previewData={getPreviewData(form, basicInfo)} />
          </div>
        </div>
      )}
    </div>
  );
}
