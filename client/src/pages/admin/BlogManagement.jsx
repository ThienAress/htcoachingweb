import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen, Plus, Edit, Trash2, Search, Save, X,
  Eye, Upload, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import {
  getAdminBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  uploadBlogImage,
} from "../../services/blog.service";
import { getAdminTrainers } from "../../services/trainer.service";
import { useDebounce } from "../../hooks/useDebounce";
import TipTapEditor from "../../components/TipTapEditor";

const CATEGORIES = [
  { value: "tap-luyen", label: "Tập Luyện" },
  { value: "dinh-duong", label: "Dinh Dưỡng" },
  { value: "hieu-co-the", label: "Hiểu Về Cơ Thể" },
  { value: "tu-duy-loi-song", label: "Tư Duy & Lối Sống" },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const SUB_CATEGORIES = {
  "tap-luyen": [
    { value: "form-ky-thuat", label: "Kỹ thuật & Form tập" },
    { value: "giao-an-mau", label: "Chương trình tập mẫu" },
    { value: "sua-loi-sai", label: "Sửa lỗi sai thường gặp" },
    { value: "theo-muc-tieu", label: "Tập theo mục tiêu" },
  ],
  "dinh-duong": [
    { value: "macro-calo", label: "Hiểu về Macro & Calo" },
    { value: "thuc-pham-cho", label: "Thực phẩm & Đi chợ" },
    { value: "goi-y-thuc-don", label: "Gợi ý Thực đơn" },
    { value: "thuc-pham-bo-sung", label: "Thực phẩm bổ sung" },
  ],
  "hieu-co-the": [
    { value: "voc-dang-tu-the", label: "Giải mã Vóc dáng & Tư thế" },
    { value: "dot-mo-xay-co", label: "Cơ chế Đốt mỡ & Xây cơ" },
    { value: "phuc-hoi-chan-thuong", label: "Phục hồi & Chấn thương" },
  ],
  "tu-duy-loi-song": [
    { value: "phuong-phap-coaching", label: "Phương pháp của chúng tôi" },
    { value: "cau-chuyen-thanh-cong", label: "Câu chuyện thay đổi (Success Stories)" },
    { value: "tu-duy-ky-luat", label: "Tư duy kỷ luật (Mindset)" },
  ],
};

const getSubCategoryLabel = (category, subValue) => {
  if (!category || !subValue) return "";
  const list = SUB_CATEGORIES[category] || [];
  const found = list.find((s) => s.value === subValue);
  return found ? found.label : subValue;
};

const emptyForm = {
  title: "", slug: "", content: "", excerpt: "",
  category: "tap-luyen", subCategory: "", tags: "", coverImage: "",
  author: "", metaTitle: "", metaDescription: "",
  focusKeyword: "", status: "draft", featured: false,
};

const postToForm = (post) => ({
  title: post.title || "", slug: post.slug || "",
  content: post.content || "", excerpt: post.excerpt || "",
  category: post.category || "tap-luyen",
  subCategory: post.subCategory || "",
  tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
  coverImage: post.coverImage || "",
  author: post.author?._id || post.author || "",
  metaTitle: post.metaTitle || "", metaDescription: post.metaDescription || "",
  focusKeyword: post.focusKeyword || "",
  status: post.status || "draft", featured: Boolean(post.featured),
});

const buildPayload = (form) => ({
  ...form,
  tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
  author: form.author || null,
});

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
      {label}
      {hint && <span className="ml-1 font-normal normal-case text-slate-400">({hint})</span>}
    </span>
    {children}
  </label>
);

const hasMarkdown = (text) => {
  if (!text) return false;
  return /[*_#`\[\]\n]/.test(text);
};

// ==================== MAIN COMPONENT ====================
const BlogManagement = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [mode, setMode] = useState("list"); // "list" | "editor" | "preview"
  const [editingPost, setEditingPost] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [excerptMode, setExcerptMode] = useState("plain");
  const limit = 10;

  const queryKey = useMemo(
    () => ["admin-blog-posts", page, statusFilter, categoryFilter, debouncedSearch],
    [page, statusFilter, categoryFilter, debouncedSearch],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      getAdminBlogPosts({
        page, limit,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        search: debouncedSearch || undefined,
      }),
    keepPreviousData: true,
  });

  const { data: trainersData } = useQuery({
    queryKey: ["admin-trainers-for-blog"],
    queryFn: () => getAdminTrainers({ page: 1, limit: 100 }),
  });
  const allTrainers = trainersData?.data || [];

  const posts = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-blog-posts"] });

  const goList = () => { setMode("list"); setEditingPost(null); setForm(emptyForm); setExcerptMode("plain"); };

  const openCreate = () => { setEditingPost(null); setForm(emptyForm); setExcerptMode("plain"); setMode("editor"); };

  const openEdit = async (post) => {
    try {
      const { getAdminBlogPostById } = await import("../../services/blog.service");
      const res = await getAdminBlogPostById(post._id);
      const postData = res.data;
      setEditingPost(postData);
      setForm(postToForm(postData));
      setExcerptMode(hasMarkdown(postData.excerpt) ? "markdown" : "plain");
    } catch {
      setEditingPost(post);
      setForm(postToForm(post));
      setExcerptMode(hasMarkdown(post.excerpt) ? "markdown" : "plain");
    }
    setMode("editor");
  };

  const updateForm = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const createMut = useMutation({
    mutationFn: createBlogPost,
    onSuccess: () => { toast.success("Tạo bài viết thành công"); invalidate(); goList(); },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi tạo bài viết"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => updateBlogPost(id, payload),
    onSuccess: () => { toast.success("Cập nhật thành công"); invalidate(); goList(); },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi cập nhật"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteBlogPost,
    onSuccess: () => { toast.success("Xóa thành công"); invalidate(); },
    onError: (err) => toast.error(err.response?.data?.message || "Lỗi xóa"),
  });

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!form.title.trim()) return toast.error("Vui lòng nhập tiêu đề");
    if (!form.content.trim()) return toast.error("Vui lòng nhập nội dung");
    const payload = buildPayload(form);
    if (editingPost?._id) {
      updateMut.mutate({ id: editingPost._id, payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleDelete = (post) => {
    if (!window.confirm(`Xóa bài viết "${post.title}"?`)) return;
    deleteMut.mutate(post._id);
  };

  const handleCoverUpload = async (file) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const res = await uploadBlogImage(file);
      updateForm("coverImage", res.data?.url);
      toast.success("Upload ảnh bìa thành công");
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi upload ảnh");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleImageUpload = async (file) => {
    const res = await uploadBlogImage(file);
    return res.data?.url;
  };

  const isSubmitting = createMut.isPending || updateMut.isPending;

  // ==================== PREVIEW MODE ====================
  if (mode === "preview") {
    return (
      <div className="min-h-screen bg-white">
        <ToastContainer position="top-right" autoClose={2500} />
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3">
          <button onClick={() => setMode("editor")} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary transition">
            <ChevronLeft className="w-4 h-4" /> Quay lại chỉnh sửa
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Xem trước</span>
          <button onClick={handleSubmit} disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition">
            <Save className="w-4 h-4" /> {isSubmitting ? "Đang lưu..." : editingPost ? "Cập nhật" : "Xuất bản"}
          </button>
        </div>
        <div className="max-w-3xl mx-auto py-10 px-4">
          <span className="bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            {CATEGORY_MAP[form.category] || form.category}
            {form.subCategory && ` / ${getSubCategoryLabel(form.category, form.subCategory)}`}
          </span>
          <h1 className="mt-4 text-fluid-4xl font-black text-slate-900 leading-tight">
            {form.title || "Tiêu đề bài viết"}
          </h1>
          {form.coverImage && !form.content?.includes(form.coverImage) && (
            <img src={form.coverImage} alt="" className="mt-6 w-full rounded-2xl object-cover max-h-[400px]" />
          )}
          <div
            className="mt-8 prose prose-lg max-w-none
              prose-headings:font-black prose-headings:text-slate-900 prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-100
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-slate-600 prose-p:leading-[1.85] prose-p:text-[15px]
              prose-a:text-primary prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
              prose-strong:text-slate-900 prose-strong:font-bold
              prose-img:rounded-xl prose-img:shadow-md prose-img:mx-auto prose-img:!mb-3 [&_img+p]:!mt-2
              prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-xl prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:not-italic prose-blockquote:text-slate-800
              prose-li:text-slate-600 prose-li:text-[15px] prose-li:leading-[1.85]
              prose-ul:space-y-1
              prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.content || "<p><em>Chưa có nội dung...</em></p>") }}
          />
          {form.tags && (
            <div className="mt-6 flex flex-wrap gap-2">
              {form.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                <span key={tag} className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-full">#{tag}</span>
              ))}
            </div>
          )}
          {/* Author preview — Vấn đề 5 */}
          {(() => {
            const author = allTrainers.find((t) => t._id === form.author);
            if (!author) return null;
            return (
              <div className="mt-10 border-t border-slate-200 pt-8">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Bài viết được tư vấn bởi</p>
                <div className="flex items-center gap-4">
                  {author.avatar ? (
                    <img src={author.avatar} alt={author.name} className="w-14 h-14 rounded-full object-cover border-2 border-primary/30" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">{author.name?.[0]}</span>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-900">PT {author.name}</p>
                    {author.experience && <p className="text-xs text-slate-500 mt-0.5">• Kinh nghiệm: {author.experience}</p>}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ==================== EDITOR MODE (Full-page 2 cột) ====================
  if (mode === "editor") {
    return (
      <div className="min-h-screen bg-slate-50">
        <ToastContainer position="top-right" autoClose={2500} />
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
          <button onClick={goList} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary transition">
            <ChevronLeft className="w-4 h-4" /> Quay lại
          </button>
          <h2 className="text-sm font-bold text-slate-800">
            {editingPost ? "Chỉnh sửa bài viết" : "Viết bài mới"}
          </h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMode("preview")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition">
              <Eye className="w-4 h-4" /> Xem trước
            </button>
            <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition">
              <Save className="w-4 h-4" /> {isSubmitting ? "Đang lưu..." : editingPost ? "Cập nhật" : "Tạo bài viết"}
            </button>
          </div>
        </div>

        {/* 2-column layout */}
        <div className="max-w-[1400px] mx-auto p-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* LEFT — Content */}
          <div className="space-y-5">
            {/* Title & Slug */}
            <div className="space-y-2">
              <input
                className="w-full text-3xl font-black text-slate-900 placeholder:text-slate-300 outline-none bg-transparent py-2 border-b-2 border-slate-100 focus:border-primary transition"
                value={form.title}
                onChange={(e) => {
                  updateForm("title", e.target.value);
                  // Auto-fill SEO nếu chưa điền (Vấn đề 4)
                  if (!form.metaTitle) updateForm("metaTitle", e.target.value.slice(0, 70));
                  // Auto-fill Focus Keyword — lấy 3 từ đầu (Vấn đề 1)
                  if (!form.focusKeyword) {
                    const kw = e.target.value.split(/[\s–—\-,]+/).filter(Boolean).slice(0, 3).join(" ").toLowerCase();
                    updateForm("focusKeyword", kw);
                  }
                }}
                placeholder="Tiêu đề bài viết..."
              />
              <div className="flex items-center gap-1.5 text-[13px] bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all w-full lg:w-3/4">
                <span className="font-bold text-slate-400 select-none">/</span>
                <input
                  className="flex-1 bg-transparent outline-none text-slate-600 font-medium placeholder:text-slate-400"
                  value={form.slug}
                  onChange={(e) => updateForm("slug", e.target.value)}
                  placeholder="duong-dan-tinh-bai-viet (để trống hệ thống sẽ tự tạo từ tiêu đề)"
                />
              </div>
            </div>

            {/* Excerpt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold uppercase text-slate-500">Mô tả ngắn</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 cursor-pointer text-xs text-slate-600 font-semibold">
                    <input
                      type="radio"
                      name="excerptMode"
                      checked={excerptMode === "plain"}
                      onChange={() => setExcerptMode("plain")}
                      className="h-3.5 w-3.5 text-primary focus:ring-primary"
                    />
                    Viết thường
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-xs text-slate-600 font-semibold">
                    <input
                      type="radio"
                      name="excerptMode"
                      checked={excerptMode === "markdown"}
                      onChange={() => setExcerptMode("markdown")}
                      className="h-3.5 w-3.5 text-primary focus:ring-primary"
                    />
                    Kiểu Markdown
                  </label>
                </div>
              </div>
              <textarea
                className={`${inputClass} h-16 resize-none`}
                value={form.excerpt}
                onChange={(e) => {
                  updateForm("excerpt", e.target.value);
                  // Auto-fill SEO description nếu chưa điền (Vấn đề 4)
                  if (!form.metaDescription) updateForm("metaDescription", e.target.value.slice(0, 160));
                }}
                placeholder={excerptMode === "plain" ? "Mô tả ngắn — hiển thị trên card blog..." : "Nhập mô tả ngắn bằng Markdown (VD: **chữ đậm**, *nghiêng*...)"}
              />
              {excerptMode === "markdown" && (
                <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 tracking-wider">Xem trước mô tả ngắn (Markdown):</p>
                  <div className="prose prose-sm max-w-none text-slate-700 text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.excerpt || "*Chưa có nội dung...*"}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* TipTap WYSIWYG Editor */}
            <TipTapEditor
              content={form.content}
              coverImage={form.coverImage}
              onChange={(html) => updateForm("content", html)}
              onImageUpload={handleImageUpload}
            />
          </div>

          {/* RIGHT — Settings */}
          <div className="space-y-4">
            {/* Card: Trạng thái + Xuất bản */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Trạng thái</p>
              <select className={inputClass} value={form.status} onChange={(e) => updateForm("status", e.target.value)}>
                <option value="draft">Bản nháp</option>
                <option value="published">Xuất bản</option>
              </select>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={(e) => updateForm("featured", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                <span className="text-sm font-semibold text-slate-700">Bài nổi bật</span>
              </label>
            </div>

            {/* Card: Danh mục + Tác giả */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Phân loại</p>
              <Field label="Chủ đề">
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    updateForm("category", newCat);
                    const subs = SUB_CATEGORIES[newCat] || [];
                    updateForm("subCategory", subs[0]?.value || "");
                  }}
                >
                  {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </Field>
              <Field label="Danh mục con">
                <select
                  className={inputClass}
                  value={form.subCategory}
                  onChange={(e) => updateForm("subCategory", e.target.value)}
                >
                  <option value="">— Không chọn —</option>
                  {(SUB_CATEGORIES[form.category] || []).map((sub) => (
                    <option key={sub.value} value={sub.value}>{sub.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tác giả">
                <select className={inputClass} value={form.author} onChange={(e) => updateForm("author", e.target.value)}>
                  <option value="">— Không chọn —</option>
                  {allTrainers.map((t) => (<option key={t._id} value={t._id}>{t.name}</option>))}
                </select>
              </Field>
            </div>

            {/* Card: Ảnh bìa */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Ảnh bìa</p>
              <div className="flex gap-2">
                <input className={`${inputClass} flex-1 text-xs`} value={form.coverImage} onChange={(e) => updateForm("coverImage", e.target.value)} placeholder="URL ảnh bìa..." />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary transition shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingCover ? "..." : "Upload"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingCover} onChange={(e) => { handleCoverUpload(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
              {form.coverImage && (
                <img src={form.coverImage} alt="Cover" className="h-36 w-full rounded-lg border border-slate-200 object-cover" />
              )}
            </div>

            {/* Card: Tags */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tags</p>
              <input className={inputClass} value={form.tags} onChange={(e) => updateForm("tags", e.target.value)} placeholder="giảm mỡ, tăng cơ, squat..." />
              {form.tags && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                    <span key={tag} className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">#{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Card: SEO (Accordion) */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button type="button" onClick={() => setSeoOpen(!seoOpen)} className="w-full flex items-center justify-between p-4 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-primary transition">
                <span>SEO</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${seoOpen ? "rotate-180" : ""}`} />
              </button>
              {seoOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                  <Field label="Meta Title" hint="max 70">
                    <input className={inputClass} maxLength={70} value={form.metaTitle} onChange={(e) => updateForm("metaTitle", e.target.value)} placeholder="Tiêu đề SEO..." />
                  </Field>
                  <Field label="Meta Description" hint="max 160">
                    <textarea className={`${inputClass} h-16 resize-none`} maxLength={200} value={form.metaDescription} onChange={(e) => updateForm("metaDescription", e.target.value)} placeholder="Mô tả SEO..." />
                  </Field>
                  <Field label="Focus Keyword">
                    <input className={inputClass} value={form.focusKeyword} onChange={(e) => updateForm("focusKeyword", e.target.value)} placeholder="VD: đánh giá thể lực f1" />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== LIST MODE ====================
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <ToastContainer position="top-right" autoClose={2500} />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-fluid-2xl font-bold text-slate-800 uppercase">
            <BookOpen className="h-7 w-7 text-primary" /> Quản lý Blog
          </h1>
          <p className="mt-1 text-sm text-slate-500">Tạo, chỉnh sửa và xuất bản bài viết.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark">
          <Plus className="h-4 w-4" /> Viết bài mới
        </button>
      </div>

      {/* Filters */}
      <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo tiêu đề..." className={`${inputClass} pl-9`} />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={inputClass}>
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Bản nháp</option>
          <option value="published">Đã xuất bản</option>
        </select>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className={inputClass}>
          <option value="">Tất cả chủ đề</option>
          {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Bài viết</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Chủ đề</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500">Lượt xem</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">Đang tải...</td></tr>
              ) : posts.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">Chưa có bài viết nào</td></tr>
              ) : (
                posts.map((post) => (
                  <tr key={post._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {post.coverImage ? (
                          <img src={post.coverImage} alt="" className="h-10 w-14 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="h-10 w-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{post.title}</p>
                          <p className="text-xs text-slate-400 truncate">/{post.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full w-fit">
                          {CATEGORY_MAP[post.category] || post.category}
                        </span>
                        {post.subCategory && (
                          <span className="text-[10px] text-slate-400 pl-2">
                            ↳ {getSubCategoryLabel(post.category, post.subCategory)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${post.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {post.status === "published" ? "Đã xuất bản" : "Bản nháp"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{post.views || 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(post)} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition" title="Chỉnh sửa">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(post)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 transition" title="Xóa">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 p-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-slate-600">Trang {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 p-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default BlogManagement;
