import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  Save,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  getAdminTrainerById,
  updateTrainer,
  uploadTrainerImage,
  uploadTrainerVideo,
} from "../../services/trainer.service";
import TrainerProfile from "../TrainerProfile";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "");
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const getPreviewData = (form, basicInfo) => {
  const getUrl = (url) => (url && url.startsWith("/uploads/") ? `${API_ORIGIN}${url}` : url);
  const images = Array.isArray(form.images) ? form.images.map(getUrl) : [];
  
  // Map form state arrays to payload format for preview
  const achievements = Array.isArray(form.achievements) ? form.achievements.map(a => typeof a === 'object' ? a.value : a).filter(Boolean) : [];
  const stats = Array.isArray(form.stats) ? form.stats.map(s => ({ label: s.label, value: s.value })) : [];

  return {
    ...basicInfo,
    ...form,
    images,
    achievements,
    stats,
    specialties: Array.isArray(form.specialties) ? form.specialties : [],
    methodologies: Array.isArray(form.methodologies) ? form.methodologies : [],
    faqs: Array.isArray(form.faqs) ? form.faqs : [],
    socialLinks: form.socialLinks,
  };
};

const emptyProfileForm = {
  motto: "",
  trainingStyle: "",
  achievements: [],
  images: [],
  specialties: [],
  headline: "",
  videoIntro: "",
  stats: [],
  certifications: [],
  faqs: [],
  methodologies: [],
  socialLinks: { facebook: "", instagram: "", tiktok: "", zalo: "", lemon8: "", threads: "" },
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
    videoIntro: trainer.videoIntro || "",
    stats: Array.isArray(trainer.stats) ? trainer.stats.map(s => ({ _id: s._id || Math.random().toString(36).substr(2, 9), value: `${s.value} ${s.label}`.trim() })) : [],
    certifications: Array.isArray(trainer.certifications) ? trainer.certifications.map(c => ({ _id: Math.random().toString(36).substr(2, 9), value: c })) : [],
    faqs: Array.isArray(trainer.faqs) ? trainer.faqs.map(f => ({ ...f, _id: f._id || Math.random().toString(36).substr(2, 9) })) : [],
    methodologies: Array.isArray(trainer.methodologies) ? trainer.methodologies.map(m => ({ ...m, _id: m._id || Math.random().toString(36).substr(2, 9) })) : [],
    socialLinks: {
      facebook: trainer.socialLinks?.facebook || "",
      instagram: trainer.socialLinks?.instagram || "",
      tiktok: trainer.socialLinks?.tiktok || "",
      zalo: trainer.socialLinks?.zalo || "",
      lemon8: trainer.socialLinks?.lemon8 || "",
      threads: trainer.socialLinks?.threads || "",
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
    
  const stats = form.stats.map(s => {
    const str = s.value.trim();
    const firstSpace = str.indexOf(' ');
    if (firstSpace === -1) {
      return { label: " ", value: str || " " };
    }
    return {
      value: str.substring(0, firstSpace),
      label: str.substring(firstSpace + 1) || " "
    };
  });

  const certifications = form.certifications.map(c => c.value).filter(Boolean);
  const faqs = form.faqs.map(f => ({ question: f.question, answer: f.answer })).filter(f => f.question && f.answer);
  const methodologies = form.methodologies.map(m => ({ title: m.title, description: m.description })).filter(m => m.title && m.description);
  const achievements = Array.isArray(form.achievements) ? form.achievements.map(a => a.value).filter(Boolean) : [];

  return {
    motto: form.motto,
    trainingStyle: form.trainingStyle,
    achievements,
    images: Array.isArray(form.images) ? form.images.filter(Boolean) : [],
    specialties,
    videoIntro: form.videoIntro,
    stats,
    certifications,
    faqs,
    methodologies,
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

export default function SetupProfileModal({ trainers, initialTrainerId, onClose }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(initialTrainerId || (trainers?.length > 0 ? trainers[0]._id : null));
  const [form, setForm] = useState(emptyProfileForm);
  const [basicInfo, setBasicInfo] = useState({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUploadingMultiple, setIsUploadingMultiple] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const { data: detailData, isFetching: isFetchingDetail } = useQuery({
    queryKey: ["admin-trainer-detail", selectedId],
    queryFn: () => getAdminTrainerById(selectedId),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (detailData?.data && selectedId) {
      setForm(trainerToProfileForm(detailData.data));
      setBasicInfo(detailData.data);
    } else if (!selectedId) {
      setForm(emptyProfileForm);
      setBasicInfo({});
    }
  }, [detailData, selectedId]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateTrainer(id, data),
    onSuccess: () => {
      toast.success("Cập nhật Profile thành công!");
      queryClient.invalidateQueries(["admin-trainers"]);
      queryClient.invalidateQueries(["admin-trainer-detail", selectedId]);
    },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi khi cập nhật Profile"),
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
    },
    onError: () => toast.error("Lỗi khi tải ảnh lên"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedId) return toast.error("Vui lòng chọn HLV cần cài đặt");
    const payload = buildPayload(form);
    updateMutation.mutate({ id: selectedId, data: payload });
  };

  const handleImageUpload = async (e, index) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadMutation.mutateAsync(formData);
      const url = res.data?.data?.url || res.data?.url;
      if (url) {
        setForm(prev => {
          const newImages = [...prev.images];
          newImages[index] = url;
          return { ...prev, images: newImages };
        });
      }
    }
    e.target.value = "";
  };

  const handleAddImage = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (form.images.length + files.length > 3) {
      toast.error("Tối đa chỉ được tải lên 3 ảnh tổng cộng!");
      return;
    }

    setIsUploadingMultiple(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await uploadMutation.mutateAsync(formData);
        return res.data?.data?.url || res.data?.url;
      });

      const results = await Promise.all(uploadPromises);
      const validUrls = results.filter(Boolean);

      if (validUrls.length > 0) {
        setForm(prev => ({
          ...prev,
          images: [...prev.images, ...validUrls]
        }));
      }
    } catch {
      // Individual upload errors are surfaced by the upload controls.
    } finally {
      setIsUploadingMultiple(false);
      e.target.value = "";
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

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        className="my-8 sm:my-12 w-full max-w-5xl rounded-3xl bg-white shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-xl font-black text-slate-800 uppercase">
                Thiết Lập Profile Chi Tiết
              </h2>
              {trainers && trainers.length > 0 && (
                <select
                  value={selectedId || ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="" disabled>Chọn Huấn luyện viên...</option>
                  {trainers.map((t) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-2">
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
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 self-start md:self-center"
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
          ) : !selectedId ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <p className="font-medium">Vui lòng chọn một Huấn luyện viên ở trên để cài đặt Profile.</p>
            </div>
          ) : (
            <form id="setup-profile-form" onSubmit={handleSubmit} className="space-y-8">
              
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
                    <label className={`flex h-40 w-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-colors ${isUploadingMultiple ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-100'}`}>
                      {isUploadingMultiple ? (
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2"></div>
                      ) : (
                        <Plus className="mb-2 text-slate-400" size={24} />
                      )}
                      <span className="text-xs font-semibold text-slate-500 text-center px-2">
                        {isUploadingMultiple ? "Đang tải..." : "Thêm ảnh"}
                      </span>
                      <input type="file" accept="image/*" multiple onChange={handleAddImage} className="hidden" disabled={isUploadingMultiple} />
                    </label>
                  )}
                </div>
              </div>

              {/* HERO INFO */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <FormSectionTitle number="02" title="Châm ngôn & Triết lý" description="Dòng chữ nổi bật hiển thị ở đầu trang Profile." />
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Châm ngôn (Motto)">
                      <input
                        type="text"
                        value={form.motto}
                        onChange={(e) => setForm({ ...form, motto: e.target.value })}
                        placeholder="VD: Không đau đớn, không thành công"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </Field>
                  </div>
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
                        required
                        value={stat.value}
                        onChange={(e) => {
                          const newStats = [...form.stats];
                          newStats[index].value = e.target.value;
                          setForm({ ...form, stats: newStats });
                        }}
                        placeholder="VD: 500+ Khách hàng"
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
                    onClick={() => setForm({ ...form, stats: [...form.stats, { _id: Math.random().toString(), value: "" }] })}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Plus size={16} /> Thêm chỉ số
                  </button>
                </div>
              </div>

              {/* VIDEO INTRO */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <FormSectionTitle number="05" title="Video giới thiệu" description="Upload file video hoặc dán link YouTube. Nếu để trống sẽ không hiển thị trên Profile." />
                <div className="mt-6 space-y-4">
                  {/* Upload hoặc nhập URL */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors ${isUploadingVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                      {isUploadingVideo ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                      ) : (
                        <Upload size={16} />
                      )}
                      {isUploadingVideo ? 'Đang tải lên...' : 'Upload Video'}
                      <input
                        type="file"
                        accept="video/mp4,video/mov,video/webm,video/avi"
                        className="hidden"
                        disabled={isUploadingVideo}
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (file.size > 100 * 1024 * 1024) {
                            toast.error('File video tối đa 100MB');
                            return;
                          }
                          setIsUploadingVideo(true);
                          try {
                            const formData = new FormData();
                            formData.append('file', file);
                            const res = await uploadTrainerVideo(formData);
                            const url = res.data?.data?.url || res.data?.url;
                            if (url) {
                              setForm(prev => ({ ...prev, videoIntro: url }));
                              toast.success('Upload video thành công!');
                            }
                          } catch (err) {
                            toast.error(err.response?.data?.message || 'Lỗi khi upload video');
                          } finally {
                            setIsUploadingVideo(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                    <span className="text-xs text-slate-400 self-center">hoặc</span>
                    <input
                      type="url"
                      value={form.videoIntro}
                      onChange={(e) => setForm({ ...form, videoIntro: e.target.value })}
                      placeholder="Dán link YouTube hoặc URL video..."
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {form.videoIntro && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, videoIntro: '' })}
                        className="rounded-xl bg-red-50 p-2.5 text-red-500 hover:bg-red-100 transition-colors self-start"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  {/* Preview */}
                  {form.videoIntro && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video">
                      {form.videoIntro.includes('youtube.com') || form.videoIntro.includes('youtu.be') ? (
                        <iframe
                          src={form.videoIntro.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
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

              {/* METHODOLOGIES */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <FormSectionTitle number="06" title="Phương pháp huấn luyện" description="Các trụ cột/phương pháp bạn áp dụng cho học viên." />
                <div className="mt-6 space-y-4">
                  {form.methodologies.map((item, index) => (
                    <div key={item._id} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 pt-8">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, methodologies: form.methodologies.filter((_, i) => i !== index) })}
                        className="absolute right-3 top-3 text-red-500 hover:text-red-600 transition-colors bg-white rounded-lg p-1.5 shadow-sm border border-slate-200"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="space-y-3">
                        <input
                          type="text"
                          required
                          value={item.title}
                          onChange={(e) => {
                            const newArr = [...form.methodologies];
                            newArr[index].title = e.target.value;
                            setForm({ ...form, methodologies: newArr });
                          }}
                          placeholder="Tiêu đề phương pháp (VD: Dinh dưỡng linh hoạt)"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <textarea
                          required
                          rows={2}
                          value={item.description}
                          onChange={(e) => {
                            const newArr = [...form.methodologies];
                            newArr[index].description = e.target.value;
                            setForm({ ...form, methodologies: newArr });
                          }}
                          placeholder="Mô tả ngắn gọn về phương pháp này..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, methodologies: [...form.methodologies, { _id: Math.random().toString(), title: "", description: "" }] })}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Plus size={16} /> Thêm phương pháp
                  </button>
                </div>
              </div>

              {/* FAQS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <FormSectionTitle number="07" title="Câu hỏi thường gặp (FAQ)" description="Giải đáp nhanh các thắc mắc phổ biến của học viên." />
                <div className="mt-6 space-y-4">
                  {form.faqs.map((item, index) => (
                    <div key={item._id} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 pt-8">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, faqs: form.faqs.filter((_, i) => i !== index) })}
                        className="absolute right-3 top-3 text-red-500 hover:text-red-600 transition-colors bg-white rounded-lg p-1.5 shadow-sm border border-slate-200"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="space-y-3">
                        <input
                          type="text"
                          required
                          value={item.question}
                          onChange={(e) => {
                            const newArr = [...form.faqs];
                            newArr[index].question = e.target.value;
                            setForm({ ...form, faqs: newArr });
                          }}
                          placeholder="Câu hỏi (VD: Tôi bận đi làm có tập được không?)"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <textarea
                          required
                          rows={2}
                          value={item.answer}
                          onChange={(e) => {
                            const newArr = [...form.faqs];
                            newArr[index].answer = e.target.value;
                            setForm({ ...form, faqs: newArr });
                          }}
                          placeholder="Câu trả lời của bạn..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, faqs: [...form.faqs, { _id: Math.random().toString(), question: "", answer: "" }] })}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Plus size={16} /> Thêm câu hỏi FAQ
                  </button>
                </div>
              </div>

              {/* SOCIAL LINKS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <FormSectionTitle number="08" title="Mạng xã hội (Social Links)" description="Thêm liên kết mạng xã hội hiển thị trên Profile." />
                <div className="mt-6 space-y-3">
                  {[
                    { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
                    { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
                    { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@..." },
                    { key: "zalo", label: "Zalo", placeholder: "0901234567 hoặc https://zalo.me/..." },
                    { key: "lemon8", label: "Lemon8", placeholder: "https://www.lemon8-app.com/@..." },
                    { key: "threads", label: "Threads", placeholder: "https://threads.net/@..." },
                  ].filter(item => form.socialLinks[item.key]).map(item => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span className="w-24 text-xs font-semibold uppercase text-slate-500 shrink-0">{item.label}</span>
                      <input
                        type={item.key === "zalo" ? "text" : "url"}
                        value={form.socialLinks[item.key]}
                        onChange={(e) => setForm({ ...form, socialLinks: { ...form.socialLinks, [item.key]: e.target.value } })}
                        placeholder={item.placeholder}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button type="button" onClick={() => setForm({ ...form, socialLinks: { ...form.socialLinks, [item.key]: "" } })} className="rounded-xl bg-red-50 p-2.5 text-red-500 hover:bg-red-100 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {[
                      { key: "facebook", label: "Facebook" },
                      { key: "instagram", label: "Instagram" },
                      { key: "tiktok", label: "TikTok" },
                      { key: "zalo", label: "Zalo" },
                      { key: "lemon8", label: "Lemon8" },
                      { key: "threads", label: "Threads" },
                    ].filter(item => !form.socialLinks[item.key]).map(item => (
                      <button key={item.key} type="button" onClick={() => setForm({ ...form, socialLinks: { ...form.socialLinks, [item.key]: " " } })} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                        <Plus size={14} /> {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>



            </form>
          )}
        </div>

        {/* PREVIEW TAB CONTENT */}
        {isPreviewOpen && (
          <div className="max-h-[75vh] overflow-y-auto bg-black border-t border-slate-200">
            <TrainerProfile previewData={getPreviewData(form, basicInfo)} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Đóng
          </button>
          {!isPreviewOpen && (
            <button
              type="submit"
              form="setup-profile-form"
              disabled={updateMutation.isPending || !selectedId}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5 hover:shadow-primary/40 disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <Save size={18} />
              )}
              Lưu Thay Đổi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
