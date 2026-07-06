import { useState, useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen, Calendar, Clock, Eye,
  Flame, Dumbbell, CheckCircle2, ChevronRight,
  Phone, MessageCircle, ArrowRight,
} from "lucide-react";
import DOMPurify from "dompurify";
import { getPublicBlogPostBySlug, getPublicBlogPosts } from "../services/blog.service";
import SEO from "../components/SEO";
import Header from "../sections/Header/Header";
import Footer from "../sections/Footer/Footer";
import ChatIcons from "../components/ChatIcons";
import ScrollToTop from "../components/ScrollToTop";

const CATEGORY_LABELS = {
  "kien-thuc-nen": "Kiến thức nền",
  "giao-an-opt": "Giáo án OPT",
  "danh-gia-f1": "Đánh giá F1",
  "dinh-duong": "Dinh dưỡng",
};

const slugifyText = (text) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Loại bỏ HTML tags, chỉ giữ text thuần
const stripTags = (html) => html.replace(/<[^>]*>/g, "");

// Parse TOC từ HTML content (h2, h3) — hỗ trợ heading có nested tags (bold, italic...)
const extractTOC = (html) => {
  if (!html) return [];
  const toc = [];
  const regex = /<h([23])([^>]*)>([\s\S]*?)<\/h[23]>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = stripTags(match[3]).trim();
    if (text) toc.push({ id: slugifyText(text), text, level });
  }
  return toc;
};

// Inject id vào heading tags trong HTML để TOC anchor hoạt động
const injectHeadingIds = (html) => {
  if (!html) return "";
  return html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h([23])>/gi, (full, level, attrs, inner) => {
    const text = stripTags(inner).trim();
    if (!text) return full;
    const id = slugifyText(text);
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "long", year: "numeric",
  });
};

const SidebarPostCard = ({ post }) => (
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
    <div className="min-w-0 flex-1">
      <h4 className="text-xs font-bold text-dark leading-snug group-hover:text-primary transition line-clamp-2">
        {post.title}
      </h4>
      <p className="mt-1 text-[10px] text-gray flex items-center gap-1">
        <Clock className="w-3 h-3" /> {post.readTime || 1} phút đọc
      </p>
    </div>
  </Link>
);

const RelatedCard = ({ post }) => (
  <Link
    to={`/blog/${post.slug}`}
    className="group flex gap-4 items-start p-4 rounded-xl bg-white border border-gray-100 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/30"
  >
    <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
      {post.coverImage ? (
        <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
          <BookOpen className="w-5 h-5 text-slate-600" />
        </div>
      )}
    </div>
    <div className="min-w-0 flex-1">
      <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
        {CATEGORY_LABELS[post.category] || post.category}
      </span>
      <h3 className="mt-1 text-sm font-bold text-dark group-hover:text-primary transition line-clamp-2 leading-snug">
        {post.title}
      </h3>
      <p className="mt-1 text-xs text-gray flex items-center gap-1">
        <Clock className="w-3 h-3" /> {post.readTime || 1} phút đọc
      </p>
    </div>
  </Link>
);

const BlogDetail = () => {
  const { slug } = useParams();

  const { data: postResponse, isLoading } = useQuery({
    queryKey: ["public-blog-post", slug],
    queryFn: () => getPublicBlogPostBySlug(slug),
    retry: false,
  });

  const { data: allPostsRes } = useQuery({
    queryKey: ["public-blog-posts-all"],
    queryFn: () => getPublicBlogPosts({ limit: 20 }),
  });

  const post = postResponse?.data;
  const toc = useMemo(() => extractTOC(post?.content), [post?.content]);
  const allPosts = allPostsRes?.data || [];

  // Bài viết liên quan = cùng category
  const relatedPosts = useMemo(() => {
    if (!post) return [];
    return allPosts
      .filter((p) => p.slug !== post.slug && p.category === post.category)
      .slice(0, 4);
  }, [post, allPosts]);

  // Bài viết khác = khác category
  const otherPosts = useMemo(() => {
    if (!post) return [];
    return allPosts
      .filter((p) => p.slug !== post.slug && p.category !== post.category)
      .slice(0, 5);
  }, [post, allPosts]);

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="bg-slate-900 pt-32 pb-20">
          <div className="container-custom max-w-4xl animate-pulse">
            <div className="h-4 bg-white/10 rounded w-1/4 mb-6" />
            <div className="h-10 bg-white/10 rounded w-3/4 mb-4" />
            <div className="h-6 bg-white/5 rounded w-1/2" />
          </div>
        </div>
        <div className="container-custom max-w-4xl py-12 animate-pulse space-y-4">
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
          <div className="h-4 bg-gray-100 rounded w-4/6" />
        </div>
      </>
    );
  }

  if (!post) return <Navigate to="/blog" replace />;

  const articleSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "headline": post.metaTitle || post.title,
        "image": post.coverImage ? [post.coverImage] : [],
        "author": post.author ? {
          "@type": "Person",
          "name": post.author.name,
          "url": `https://htcoachingweb.io.vn/huan-luyen-vien/${post.author.slug}`,
        } : { "@type": "Organization", "name": "HTCOACHING" },
        "publisher": {
          "@type": "Organization",
          "name": "HTCOACHING",
          "logo": { "@type": "ImageObject", "url": "https://htcoachingweb.io.vn/og-image.png" },
        },
        "description": post.metaDescription || post.excerpt || "",
        ...(post.publishedAt && { datePublished: new Date(post.publishedAt).toISOString().split("T")[0] }),
        ...(post.updatedAt && { dateModified: new Date(post.updatedAt).toISOString().split("T")[0] }),
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Trang chủ", "item": "https://htcoachingweb.io.vn/" },
          { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://htcoachingweb.io.vn/blog" },
          { "@type": "ListItem", "position": 3, "name": post.title },
        ],
      },
    ],
  };

  return (
    <div className="blog-content">
      <SEO
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt || `Đọc bài viết ${post.title} từ HTCOACHING`}
        canonical={`/blog/${post.slug}`}
        image={post.coverImage}
        type="article"
        jsonLd={articleSchema}
      />
      <Header />

      {/* ===== HERO — Dark bg + Cover image ===== */}
      <section className="relative bg-slate-900 pt-28 pb-16 overflow-hidden">
        {post.coverImage && (
          <div className="absolute inset-0">
            <img src={post.coverImage} alt="" className="w-full h-full object-cover opacity-20 blur-sm" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/90 to-slate-900/70" />
          </div>
        )}
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary/15 rounded-full blur-[100px]" />

        <div className="container-custom relative z-10 max-w-4xl">
          <nav className="flex items-center gap-2 text-sm text-white/50 mb-8">
            <Link to="/" className="hover:text-white transition">Trang chủ</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to="/blog" className="hover:text-white transition">Blog</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/70 truncate max-w-[200px]">{post.title}</span>
          </nav>

          <span className="inline-block bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-5">
            {CATEGORY_LABELS[post.category] || post.category}
          </span>

          <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-black text-white leading-[1.15]">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mt-6 text-sm text-white/50">
            {post.author && (
              <Link to={`/huan-luyen-vien/${post.author.slug}`} className="flex items-center gap-2 hover:text-white transition">
                {post.author.image ? (
                  <img src={post.author.image} alt={post.author.name} className="w-8 h-8 rounded-full object-cover border-2 border-primary/50" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{post.author.name?.[0]}</span>
                  </div>
                )}
                <span className="font-semibold text-white/80">{post.author.name}</span>
              </Link>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(post.publishedAt || post.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {post.readTime || 1} phút đọc
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> {post.views || 0} lượt xem
            </span>
          </div>
        </div>
      </section>

      {/* Cover image full-width — Vấn đề 6 */}
      {post.coverImage && (
        <div className="container-custom max-w-6xl -mt-8 relative z-10 mb-8">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full rounded-2xl shadow-2xl object-cover max-h-[480px]"
          />
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <main className="bg-gray-50 py-12">
        <div className="container-custom">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] max-w-6xl mx-auto">
            {/* Article */}
            <article className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10 -mt-16 relative z-10">
              {post.coverImage && (
                <div className="rounded-xl overflow-hidden mb-8 -mx-2 sm:-mx-4">
                  <img src={post.coverImage} alt={post.title} className="w-full object-cover max-h-[400px]" />
                </div>
              )}

              {/* Mobile TOC */}
              {toc.length > 0 && (
                <details className="lg:hidden bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8">
                  <summary className="font-bold text-dark cursor-pointer text-sm">📖 Mục lục bài viết</summary>
                  <nav className="mt-3 space-y-1.5">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={`block text-sm text-gray hover:text-primary transition ${item.level === 3 ? "pl-4 text-xs" : "font-medium"}`}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </details>
              )}

              {/* Content — HTML render với DOMPurify (Tầng 2 bảo mật) */}
              <div
                className="prose prose-lg max-w-none
                  prose-headings:font-black prose-headings:text-dark prose-headings:tracking-tight
                  prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-100
                  prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
                  prose-p:text-gray prose-p:leading-[1.85] prose-p:text-[15px]
                  prose-a:text-primary prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-dark prose-strong:font-bold
                  prose-img:rounded-xl prose-img:shadow-md
                  prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-xl prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:not-italic prose-blockquote:text-dark/80
                  prose-li:text-gray prose-li:text-[15px] prose-li:leading-[1.85]
                  prose-ul:space-y-1
                  prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                "
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(injectHeadingIds(post.content)) }}
              />

              {/* Tags */}
              {post.tags?.length > 0 && (
                <div className="mt-10 pt-6 border-t border-gray-100 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="bg-gray-100 text-gray text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition cursor-default">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* ===== AUTHOR ADVISOR BOX (Vấn đề 4) ===== */}
              {post.author && (
                <div className="mt-10 pt-8 border-t-2 border-primary/20">
                  {/* Tư vấn bởi */}
                  <div className="flex items-center gap-4 mb-5">
                    {post.author.image && (
                      <img
                        src={post.author.image}
                        alt={post.author.name}
                        className="w-16 h-16 rounded-full object-cover shrink-0 border-2 border-primary ring-2 ring-primary/20"
                      />
                    )}
                    <div>
                      <p className="text-xs font-bold uppercase text-primary tracking-widest">Bài viết được tư vấn bởi</p>
                      <Link
                        to={`/huan-luyen-vien/${post.author.slug}`}
                        className="text-xl font-black text-dark hover:text-primary transition"
                      >
                        PT {post.author.name}
                      </Link>
                    </div>
                  </div>

                  {/* Kinh nghiệm & Quan điểm */}
                  <div className="space-y-3 mb-6">
                    {post.author.experience && (
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-dark text-sm shrink-0">• Kinh nghiệm:</span>
                        <p className="text-sm text-gray leading-relaxed">{post.author.experience}</p>
                      </div>
                    )}
                    {post.author.philosophy && (
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-dark text-sm shrink-0">• Quan điểm:</span>
                        <p className="text-sm text-gray leading-relaxed italic">"{post.author.philosophy}"</p>
                      </div>
                    )}
                  </div>

                  {/* CTA: Liên hệ */}
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 mb-5">
                    <p className="text-white font-black text-lg uppercase">
                      Đăng ký tập thử với PT {post.author.name}
                    </p>
                    <p className="text-white/60 text-sm mt-1">
                      Đánh giá thể lực & tư vấn lộ trình tập luyện miễn phí.
                    </p>
                    <Link
                      to="/#contact"
                      className="mt-4 inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-primary-dark transition"
                    >
                      Liên hệ ngay <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Thông tin liên hệ — dùng socialLinks từ trainer model */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                    <p className="text-sm font-bold text-dark mb-3">Thông tin liên hệ:</p>
                    <div className="space-y-2 text-sm text-gray">
                      <Link
                        to={`/huan-luyen-vien/${post.author.slug}`}
                        className="flex items-center gap-2 hover:text-primary transition"
                      >
                        <BookOpen className="w-4 h-4 text-primary" />
                        Xem profile HLV {post.author.name}
                      </Link>
                      {post.author.socialLinks?.zalo && (
                        <a href={`https://zalo.me/${post.author.socialLinks.zalo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary transition">
                          <Phone className="w-4 h-4 text-primary" />
                          Zalo: {post.author.socialLinks.zalo}
                        </a>
                      )}
                      {post.author.socialLinks?.facebook && (
                        <a href={post.author.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary transition">
                          <MessageCircle className="w-4 h-4 text-primary" />
                          Facebook
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </article>

            {/* Sidebar — luôn hiển thị dù có TOC hay không */}
            <aside className="hidden lg:block">
              <div className="sticky top-20 space-y-6">
                {/* Khối 1: MỤC LỤC (chỉ hiển khi có heading) */}
                {toc.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold tracking-wider text-dark mb-4">
                      MỤC LỤC
                    </h3>
                    <nav className="space-y-1.5">
                      {toc.map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className={`block text-sm transition-all leading-relaxed rounded-lg px-2.5 py-1.5 ${
                            item.level === 3
                              ? "pl-5 text-xs text-gray hover:text-primary hover:bg-primary/5"
                              : "font-semibold text-gray hover:text-primary hover:bg-primary/5"
                          }`}
                        >
                          {item.text}
                        </a>
                      ))}
                    </nav>
                  </div>
                )}

                {/* Khối 2: BÀI VIẾT KHÁC */}
                {otherPosts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold tracking-wider text-dark mb-3">
                      BÀI VIẾT KHÁC
                    </h3>
                    <div>
                      {otherPosts.map((p) => (
                        <SidebarPostCard key={p._id} post={p} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Khối 3: Bạn cần tư vấn? */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-lg">
                  <p className="font-bold text-sm">Bạn cần tư vấn?</p>
                  <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                    Liên hệ HLV để được tư vấn lộ trình phù hợp.
                  </p>
                  <Link
                    to="/#contact"
                    className="mt-3 inline-flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 transition"
                  >
                    Liên hệ ngay <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </aside>
          </div>

          {/* Bài viết liên quan (cùng category) — Vấn đề 2 */}
          {relatedPosts.length > 0 && (
            <section className="max-w-6xl mx-auto mt-12">
              <h2 className="text-2xl font-black text-dark uppercase mb-6">
                Bài viết <span className="text-primary">liên quan</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {relatedPosts.map((p) => (
                  <RelatedCard key={p._id} post={p} />
                ))}
              </div>
            </section>
          )}

          {/* Khám phá thêm — Internal Links */}
          <section className="max-w-6xl mx-auto mt-12 bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-center text-2xl font-black text-dark uppercase mb-2">
              Khám phá <span className="text-primary">thêm</span>
            </h2>
            <p className="text-center text-sm text-gray mb-8">
              Bắt đầu hành trình thay đổi vóc dáng ngay hôm nay
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link to="/tdee-calculator" className="group border border-gray-100 bg-gray-50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:bg-white">
                <Flame className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-bold text-dark group-hover:text-primary transition">Tính TDEE & Macro</h3>
                <p className="mt-2 text-sm text-gray leading-relaxed">Xác định lượng calo cần nạp mỗi ngày.</p>
              </Link>
              <Link to="/exercises" className="group border border-gray-100 bg-gray-50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:bg-white">
                <Dumbbell className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-bold text-dark group-hover:text-primary transition">Thư viện bài tập</h3>
                <p className="mt-2 text-sm text-gray leading-relaxed">Tạo lịch tập cá nhân hóa và xuất PDF.</p>
              </Link>
              <Link to="/ket-qua-khach-hang" className="group border border-gray-100 bg-gray-50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg hover:bg-white">
                <CheckCircle2 className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-bold text-dark group-hover:text-primary transition">Kết quả khách hàng</h3>
                <p className="mt-2 text-sm text-gray leading-relaxed">Xem hành trình thay đổi vóc dáng từ học viên.</p>
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* Vấn đề 3: Bỏ Contact */}
      <ScrollToTop />
      <ChatIcons />
      <Footer />
    </div>
  );
};

export default BlogDetail;
