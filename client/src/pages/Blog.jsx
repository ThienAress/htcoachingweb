import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Eye, ChevronRight, ChevronDown, Flame, Dumbbell, CheckCircle2 } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { getPublicBlogPosts } from "../services/blog.service";
import SEO from "../components/SEO";
import Header from "../sections/Header/Header";
import Footer from "../sections/Footer/Footer";
import ChatIcons from "../components/ChatIcons";
import ScrollToTop from "../components/ScrollToTop";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { translateData } from "../utils/localDataTranslator";

const CATEGORIES = [
  { value: "", key: "categories.all" },
  { value: "tap-luyen", key: "categories.tap-luyen" },
  { value: "dinh-duong", key: "categories.dinh-duong" },
  { value: "hieu-co-the", key: "categories.hieu-co-the" },
  { value: "tu-duy-loi-song", key: "categories.tu-duy-loi-song" },
];

const SUB_CATEGORIES = {
  "tap-luyen": [
    { value: "form-ky-thuat", key: "sub_categories.form-ky-thuat" },
    { value: "giao-an-mau", key: "sub_categories.giao-an-mau" },
    { value: "sua-loi-sai", key: "sub_categories.sua-loi-sai" },
    { value: "theo-muc-tieu", key: "sub_categories.theo-muc-tieu" },
  ],
  "dinh-duong": [
    { value: "macro-calo", key: "sub_categories.macro-calo" },
    { value: "thuc-pham-cho", key: "sub_categories.thuc-pham-cho" },
    { value: "goi-y-thuc-don", key: "sub_categories.goi-y-thuc-don" },
    { value: "thuc-pham-bo-sung", key: "sub_categories.thuc-pham-bo-sung" },
  ],
  "hieu-co-the": [
    { value: "voc-dang-tu-the", key: "sub_categories.voc-dang-tu-the" },
    { value: "dot-mo-xay-co", key: "sub_categories.dot-mo-xay-co" },
    { value: "phuc-hoi-chan-thuong", key: "sub_categories.phuc-hoi-chan-thuong" },
  ],
  "tu-duy-loi-song": [
    { value: "phuong-phap-coaching", key: "sub_categories.phuong-phap-coaching" },
    { value: "cau-chuyen-thanh-cong", key: "sub_categories.cau-chuyen-thanh-cong" },
    { value: "tu-duy-ky-luat", key: "sub_categories.tu-duy-ky-luat" },
  ],
};

const getSubCategoryLabel = (t, category, subValue) => {
  if (!category || !subValue) return "";
  return t(`sub_categories.${subValue}`, { defaultValue: subValue });
};

const getCategoryLabel = (t, catValue) => {
  if (!catValue) return "";
  return t(`categories.${catValue}`, { defaultValue: catValue });
};

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
};

const BlogCard = ({ post, featured = false }) => {
  const { t } = useTranslation("blog");
  const beforeSrc = post.coverImage;

  return (
    <Link
      to={`/blog/${post.slug}`}
      className={`group flex flex-col bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl border border-gray-100 ${
        featured ? "md:flex-row md:col-span-2" : ""
      }`}
    >
      <div className={`relative overflow-hidden bg-gray-100 ${
        featured ? "aspect-[16/9] md:aspect-auto md:w-1/2" : "aspect-[16/9]"
      }`}>
        {beforeSrc ? (
          <img
            src={beforeSrc}
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
          {getCategoryLabel(t, post.category)}
          {post.subCategory && ` / ${getSubCategoryLabel(t, post.category, post.subCategory)}`}
        </span>
      </div>

      <div className={`flex flex-col flex-1 p-5 ${featured ? "md:p-8 md:justify-center" : ""}`}>
        {/* Date + Read time */}
        <div className="flex items-center gap-3 text-xs text-gray mb-3">
          <span>{formatDate(post.publishedAt || post.createdAt)}</span>
          <span className="w-1 h-1 rounded-full bg-gray" />
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {t("card.read_time", { count: post.readTime || 1 })}
          </span>
        </div>

        <h2 className={`font-black text-dark leading-snug group-hover:text-primary transition-colors duration-300 line-clamp-2 ${
          featured ? "text-fluid-xl" : "text-base"
        }`}>
          {post.title}
        </h2>

        {post.excerpt && (
          <div className={`mt-2 text-sm text-gray leading-relaxed ${featured ? "line-clamp-3" : "line-clamp-2"}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.excerpt}</ReactMarkdown>
          </div>
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
};

const SidebarCard = ({ post }) => {
  // eslint-disable-next-line no-unused-vars
  const { t } = useTranslation("blog");
  return (
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
};

const Blog = () => {
  const { t, i18n } = useTranslation("blog");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [page, setPage] = useState(1);

  const { data: response, isLoading } = useQuery({
    queryKey: ["public-blog-posts", category, subCategory, page, i18n.language],
    queryFn: ({ signal }) =>
      getPublicBlogPosts({
        category: category || undefined,
        subCategory: subCategory || undefined,
        page,
        limit: 12,
        lang: i18n.language,
      }, signal),
  });

  // Fetch popular posts for sidebar
  const { data: popularRes } = useQuery({
    queryKey: ["public-blog-posts-popular", i18n.language],
    queryFn: ({ signal }) =>
      getPublicBlogPosts(
        { limit: 5, lang: i18n.language, sort: "popular" },
        signal,
      ),
    staleTime: 60 * 1000,
  });

  const postsRaw = response?.data || [];
  const posts = translateData(postsRaw, "blog", i18n.language);
  const pagination = response?.pagination || { total: 0, page: 1, totalPages: 1 };
  const popularPostsRaw = popularRes?.data || [];
  const popularPosts = translateData(popularPostsRaw, "blog", i18n.language);

  const featuredPost = posts[0];
  const restPosts = posts.slice(1);

  return (
    <div className="blog-content">
      <SEO
        title={t("seo.title")}
        description={t("seo.description")}
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
            <span className="text-sm font-bold text-white/80 tracking-wide uppercase">{t("header.tag")}</span>
          </div>
          <h1 className="text-fluid-6xl font-black text-white uppercase leading-[1.1]">
            <Trans t={t} i18nKey="header.title">Kiến thức <span className="text-primary">Fitness</span></Trans>
          </h1>
          <div className="w-16 h-1 bg-primary mx-auto mt-5 rounded-full" />
          <p className="text-white/60 mt-5 max-w-xl mx-auto text-lg">
            {t("header.subtitle")}
          </p>
        </div>
      </section>

      {/* ===== CATEGORY TABS ===== */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-lg border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] md:overflow-visible">
        <div className="container-custom md:overflow-visible">
          <div className="flex items-center gap-1 overflow-x-auto md:overflow-visible py-2.5 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const hasSubs = cat.value && SUB_CATEGORIES[cat.value];
              return (
                <div key={cat.value} className="relative group py-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setCategory(cat.value);
                      setSubCategory("");
                      setPage(1);
                    }}
                    className={`px-5 py-2 rounded-full text-fluid-xs font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-1.5 ${
                      category === cat.value && !subCategory
                        ? "bg-slate-900 text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] scale-102"
                        : category === cat.value && subCategory
                        ? "bg-slate-200 text-slate-800 font-bold"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span>{t(cat.key)}</span>
                    {hasSubs && (
                      <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:rotate-180 transition-transform duration-300" />
                    )}
                  </button>

                  {/* Dropdown menu con mượt mà khi hover */}
                  {hasSubs && (
                    <div className="absolute left-0 mt-2 w-56 rounded-xl border border-slate-100 bg-white p-2 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50">
                      <div className="flex flex-col gap-0.5">
                        {(SUB_CATEGORIES[cat.value] || []).map((sub) => (
                          <button
                            key={sub.value}
                            onClick={() => {
                              setCategory(cat.value);
                              setSubCategory(sub.value);
                              setPage(1);
                            }}
                            className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                              category === cat.value && subCategory === sub.value
                                ? "bg-primary/10 text-primary"
                               : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            {t(sub.key)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Sub-category filter bar */}
      {subCategory && (
        <div className="bg-slate-50 border-b border-slate-100 py-2 animate-fadeIn">
          <div className="container-custom flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>{t("filters.filtering")}</span>
              <span className="bg-slate-900 text-white px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider">
                {getCategoryLabel(t, category)}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider">
                {getSubCategoryLabel(t, category, subCategory)}
              </span>
            </div>
            <button
              onClick={() => {
                setSubCategory("");
                setPage(1);
              }}
              className="text-xs font-bold text-slate-400 hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-100"
            >
              {t("filters.cancel_filter")}
            </button>
          </div>
        </div>
      )}

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
              <p className="text-lg font-bold text-dark">{t("card.no_posts_title")}</p>
              <p className="text-sm text-gray mt-1">{t("card.no_posts_desc")}</p>
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
                      {t("sidebar.featured")}
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

      {/* Công cụ hỗ trợ — thiết kế mới Premium & Dynamic */}
      <section className="bg-gray-50 border-t border-gray-100 py-16">
        <div className="container-custom">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-display font-bold text-slate-800 uppercase tracking-tight mb-2">
              <Trans t={t} i18nKey="detail.explore_more.title">Công cụ <span className="text-primary">hỗ trợ</span></Trans>
            </h2>
            <p className="text-sm text-slate-500">
              {t("detail.explore_more.subtitle")}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {/* Card 1 */}
            <Link to="/tdee-calculator" className="group relative bg-white/80 backdrop-blur-md border border-slate-100 p-6 sm:p-8 rounded-[1.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:-translate-y-1.5 hover:border-primary/20 hover:shadow-[0_20px_40px_rgba(255,85,0,0.06)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-primary-light transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    <Flame className="w-6 h-6" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                </div>
                <h3 className="text-fluid-xl font-bold text-slate-800 group-hover:text-primary transition duration-300 mt-6 tracking-tight">{t("detail.explore_more.tdee")}</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{t("detail.explore_more.tdee_desc")}</p>
              </div>
            </Link>

            {/* Card 2 */}
            <Link to="/exercises" className="group relative bg-white/80 backdrop-blur-md border border-slate-100 p-6 sm:p-8 rounded-[1.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:-translate-y-1.5 hover:border-primary/20 hover:shadow-[0_20px_40px_rgba(255,85,0,0.06)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-primary-light transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    <Dumbbell className="w-6 h-6" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                </div>
                <h3 className="text-fluid-xl font-bold text-slate-800 group-hover:text-primary transition duration-300 mt-6 tracking-tight">{t("detail.explore_more.exercises")}</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{t("detail.explore_more.exercises_desc")}</p>
              </div>
            </Link>

            {/* Card 3 */}
            <Link to="/ket-qua-khach-hang" className="group relative bg-white/80 backdrop-blur-md border border-slate-100 p-6 sm:p-8 rounded-[1.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:-translate-y-1.5 hover:border-primary/20 hover:shadow-[0_20px_40px_rgba(255,85,0,0.06)] transition-all duration-300 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-primary-light transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                </div>
                <h3 className="text-fluid-xl font-bold text-slate-800 group-hover:text-primary transition duration-300 mt-6 tracking-tight">{t("detail.explore_more.results")}</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{t("detail.explore_more.results_desc")}</p>
              </div>
            </Link>
          </div>
        </div>
      </section>
      <ScrollToTop />
      <ChatIcons />
      <Footer />
    </div>
  );
};

export default Blog;
