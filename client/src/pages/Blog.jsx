import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Eye, ChevronRight, Flame, Dumbbell, CheckCircle2 } from "lucide-react";
import { getPublicBlogPosts } from "../services/blog.service";
import SEO from "../components/SEO";
import Header from "../sections/Header/Header";
import Footer from "../sections/Footer/Footer";
import ChatIcons from "../components/ChatIcons";


const CATEGORIES = [
  { value: "", label: "Tất cả" },
  { value: "kien-thuc-nen", label: "Kiến thức nền" },
  { value: "giao-an-opt", label: "Giáo án OPT" },
  { value: "danh-gia-f1", label: "Đánh giá F1" },
  { value: "dinh-duong", label: "Dinh dưỡng" },
];

const CATEGORY_LABELS = {
  "kien-thuc-nen": "Kiến thức nền",
  "giao-an-opt": "Giáo án OPT",
  "danh-gia-f1": "Đánh giá F1",
  "dinh-duong": "Dinh dưỡng",
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
};

const BlogCard = ({ post, featured = false }) => (
  <Link
    to={`/blog/${post.slug}`}
    className={`group flex flex-col bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl border border-gray-100 ${
      featured ? "md:flex-row md:col-span-2" : ""
    }`}
  >
    <div className={`relative overflow-hidden bg-gray-100 ${
      featured ? "aspect-[16/9] md:aspect-auto md:w-1/2" : "aspect-[16/9]"
    }`}>
      {post.coverImage ? (
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
          <BookOpen className="w-16 h-16 text-slate-600" />
        </div>
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <span className="absolute top-4 left-4 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full backdrop-blur-sm">
        {CATEGORY_LABELS[post.category] || post.category}
      </span>
    </div>

    <div className={`flex flex-col flex-1 p-5 ${featured ? "md:p-8 md:justify-center" : ""}`}>
      {/* Date + Read time */}
      <div className="flex items-center gap-3 text-xs text-gray mb-3">
        <span>{formatDate(post.publishedAt || post.createdAt)}</span>
        <span className="w-1 h-1 rounded-full bg-gray" />
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {post.readTime || 1} phút đọc
        </span>
      </div>

      <h2 className={`font-black text-dark leading-snug group-hover:text-primary transition-colors duration-300 line-clamp-2 ${
        featured ? "text-xl md:text-2xl" : "text-base"
      }`}>
        {post.title}
      </h2>

      {post.excerpt && (
        <p className={`mt-2 text-sm text-gray leading-relaxed ${featured ? "line-clamp-3" : "line-clamp-2"}`}>
          {post.excerpt}
        </p>
      )}

      <div className="mt-auto pt-4 flex items-center justify-between">
        {post.author && (
          <div className="flex items-center gap-2">
            {post.author.image ? (
              <img src={post.author.image} alt={post.author.name} className="w-7 h-7 rounded-full object-cover border border-primary/30" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{post.author.name?.[0]}</span>
              </div>
            )}
            <span className="text-xs font-semibold text-dark">{post.author.name}</span>
          </div>
        )}
        <span className="flex items-center gap-1 text-xs text-gray">
          <Eye className="w-3 h-3" /> {post.views || 0}
        </span>
      </div>
    </div>
  </Link>
);

const SidebarCard = ({ post }) => (
  <Link to={`/blog/${post.slug}`} className="group flex gap-3 items-start py-3 border-b border-gray-100 last:border-0">
    <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
      {post.coverImage ? (
        <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
          <BookOpen className="w-4 h-4 text-slate-600" />
        </div>
      )}
    </div>
    <div className="min-w-0">
      <h4 className="text-sm font-bold text-dark leading-snug group-hover:text-primary transition line-clamp-2">
        {post.title}
      </h4>
      <p className="mt-1 text-xs text-gray flex items-center gap-2">
        <span>{formatDate(post.publishedAt)}</span>
        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{post.views || 0}</span>
      </p>
    </div>
  </Link>
);

const Blog = () => {
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const { data: response, isLoading } = useQuery({
    queryKey: ["public-blog-posts", category, page],
    queryFn: () => getPublicBlogPosts({ category: category || undefined, page, limit: 12 }),
  });

  // Fetch popular posts for sidebar
  const { data: popularRes } = useQuery({
    queryKey: ["public-blog-posts-popular"],
    queryFn: () => getPublicBlogPosts({ limit: 5 }),
  });

  const posts = response?.data || [];
  const pagination = response?.pagination || { total: 0, page: 1, totalPages: 1 };
  const popularPosts = popularRes?.data || [];

  const featuredPost = posts[0];
  const restPosts = posts.slice(1);

  return (
    <div className="blog-content">
      <SEO
        title="Blog - Kiến thức Fitness & Sức khỏe"
        description="Chia sẻ kiến thức tập luyện, dinh dưỡng, giáo án OPT và đánh giá thể lực từ đội ngũ HLV chuyên nghiệp tại HTCOACHING."
        canonical="/blog"
      />
      <Header />

      {/* ===== HERO SECTION — dark bg giải quyết navbar trắng ===== */}
      <section className="relative bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 pt-32 pb-16 overflow-hidden">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        {/* Gradient orb */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />

        <div className="container-custom relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-5 border border-white/10">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-white/80 tracking-wide uppercase">Blog HTCOACHING</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white uppercase leading-[1.1]">
            Kiến thức <span className="text-primary">Fitness</span>
          </h1>
          <div className="w-16 h-1 bg-primary mx-auto mt-5 rounded-full" />
          <p className="text-white/60 mt-5 max-w-xl mx-auto text-lg">
            Chia sẻ từ đội ngũ HLV — giúp bạn tập đúng, ăn đúng, đạt kết quả nhanh hơn
          </p>
        </div>
      </section>

      {/* ===== CATEGORY TABS ===== */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="container-custom">
          <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => { setCategory(cat.value); setPage(1); }}
                className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                  category === cat.value
                    ? "bg-slate-900 text-white shadow-lg"
                    : "text-gray hover:bg-gray-100 hover:text-dark"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="bg-gray-50 py-10">
        <div className="container-custom">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse border border-gray-100">
                  <div className="aspect-[16/9] bg-gray-200" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-100 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-bold text-dark">Chưa có bài viết nào</p>
              <p className="text-sm text-gray mt-1">Hãy quay lại sau nhé!</p>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
              {/* Left — Posts */}
              <div className="space-y-6">
                {/* Featured Post */}
                {featuredPost && page === 1 && (
                  <BlogCard post={featuredPost} featured />
                )}

                {/* Grid Posts */}
                <div className="grid gap-6 sm:grid-cols-2">
                  {restPosts.map((post) => (
                    <BlogCard key={post._id} post={post} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center gap-2 pt-4">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                          p === page
                            ? "bg-slate-900 text-white shadow-lg"
                            : "bg-white text-gray border border-gray-200 hover:border-slate-900 hover:text-dark"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right — Sidebar */}
              <aside className="hidden lg:block space-y-6">
                {/* Popular Posts */}
                {popularPosts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-dark mb-4">
                      Bài viết nổi bật
                    </h3>
                    <div>
                      {popularPosts.map((post, i) => (
                        <SidebarCard key={post._id} post={post} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Tools — chuyển xuống dưới Footer */}
              </aside>
            </div>
          )}
        </div>
      </main>

      {/* Công cụ hỗ trợ — thay vị trí Contact */}
      <section className="bg-gray-50 border-t border-gray-100 py-12">
        <div className="container-custom">
          <h2 className="text-xl font-bold text-dark uppercase tracking-wider mb-6">Công cụ hỗ trợ</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link to="/tdee-calculator" className="group bg-white border border-gray-100 p-6 rounded-2xl hover:-translate-y-1 hover:border-primary hover:shadow-lg transition">
              <Flame className="w-[27px] h-[27px] text-primary mb-3" />
              <h3 className="text-[48px] font-black text-dark group-hover:text-primary transition leading-tight">Tính TDEE</h3>
              <p className="text-sm text-gray mt-2">Tính calo cần nạp mỗi ngày</p>
            </Link>
            <Link to="/exercises" className="group bg-white border border-gray-100 p-6 rounded-2xl hover:-translate-y-1 hover:border-primary hover:shadow-lg transition">
              <Dumbbell className="w-[27px] h-[27px] text-primary mb-3" />
              <h3 className="text-[48px] font-black text-dark group-hover:text-primary transition leading-tight">Thư viện bài tập</h3>
              <p className="text-sm text-gray mt-2">500+ bài tập chi tiết có hướng dẫn</p>
            </Link>
            <Link to="/ket-qua-khach-hang" className="group bg-white border border-gray-100 p-6 rounded-2xl hover:-translate-y-1 hover:border-primary hover:shadow-lg transition">
              <CheckCircle2 className="w-[27px] h-[27px] text-primary mb-3" />
              <h3 className="text-[48px] font-black text-dark group-hover:text-primary transition leading-tight">Kết quả KH</h3>
              <p className="text-sm text-gray mt-2">Hành trình lột xác thực tế</p>
            </Link>
          </div>
        </div>
      </section>
      <ChatIcons />
      <Footer />
    </div>
  );
};

export default Blog;
