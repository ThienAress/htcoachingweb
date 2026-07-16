import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ChefHat,
  Flame,
  Calendar,
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import { getRecipes, getRecipeCategories, getRecipeAreas } from "../../services/recipe.service";
import { getFlagEmoji, getPageNumbers } from "./constants";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import ChatIcons from "../../components/ChatIcons";
import ScrollToTop from "../../components/ScrollToTop";
import SEO from "../../components/SEO";
import RecipeCard from "./RecipeCard";
import { useDebounce } from "../../hooks/useDebounce";
import CountryCombobox from "./CountryCombobox";

const RecipeExplorer = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(search, 500);

  const category = searchParams.get("category") || "";
  const area = searchParams.get("area") || "";
  const page = parseInt(searchParams.get("page")) || 1;

  const updateParams = (updates) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val) params.set(key, val);
      else params.delete(key);
    });
    if (updates.category !== undefined || updates.area !== undefined || updates.search !== undefined) {
      params.delete("page");
    }
    setSearchParams(params);
  };

  // Queries
  const { data: recipesData, isLoading } = useQuery({
    queryKey: ["recipes", { search: searchParams.get("search"), category, area, page }],
    queryFn: () =>
      getRecipes({
        search: searchParams.get("search") || "",
        category,
        area,
        page,
        limit: 12,
      }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["recipe-categories"],
    queryFn: getRecipeCategories,
    staleTime: 5 * 60 * 1000,
  });

  const { data: areasData } = useQuery({
    queryKey: ["recipe-areas"],
    queryFn: getRecipeAreas,
    staleTime: 5 * 60 * 1000,
  });

  const recipes = recipesData?.data || [];
  const pagination = recipesData?.pagination || {};
  const categories = categoriesData?.data || [];
  const areas = areasData?.data || [];

  const handleSearch = (e) => {
    e.preventDefault();
    updateParams({ search: search.trim() || null });
  };

  useEffect(() => {
    // Only update if it's different from current param
    if (debouncedSearch.trim() !== (searchParams.get("search") || "")) {
      updateParams({ search: debouncedSearch.trim() || null });
    }
  }, [debouncedSearch]);

  const clearFilters = () => {
    setSearch("");
    setSearchParams({});
  };

  const hasActiveFilters = category || area || searchParams.get("search");
  const pageNumbers = getPageNumbers(page, pagination.totalPages || 1);

  return (
    <>
      <SEO
        title="Công Thức Nấu Ăn"
        description="Khám phá hàng trăm công thức nấu ăn từ Việt Nam và thế giới. Nguyên liệu chi tiết, hướng dẫn từng bước — hoàn toàn miễn phí tại HTCOACHING."
        canonical="/cong-thuc-nau-an"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": "Công Thức Nấu Ăn - HTCOACHING",
          "description":
            "Khám phá hàng trăm công thức nấu ăn từ Việt Nam và thế giới.",
          "url": "https://htcoachingweb.io.vn/cong-thuc-nau-an",
          "provider": {
            "@type": "Organization",
            "name": "HTCOACHING",
            "url": "https://htcoachingweb.io.vn",
          },
        }}
      />
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-black text-white pt-28 pb-16">
        <div className="container-custom">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
              <ChefHat className="text-primary w-6 h-6" />
              <span className="font-semibold text-primary tracking-wide">
                CÔNG THỨC NẤU ĂN
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-normal">
              Khám Phá <span className="text-primary">Món Ngon</span>
            </h1>
            <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full" />
            <p className="text-zinc-400 mt-4 max-w-xl mx-auto">
              Công thức nấu ăn từ Việt Nam và thế giới — nguyên liệu chi tiết,
              hướng dẫn từng bước
            </p>
          </div>

          {/* Search + Filters — cùng 1 hàng */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_200px] gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm món ăn..."
                  className="w-full pl-12 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
              {/* Category */}
              <select
                value={category}
                onChange={(e) => updateParams({ category: e.target.value || null })}
                className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="">Phân loại</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {/* Area */}
              <CountryCombobox 
                value={area}
                onChange={(val) => updateParams({ area: val || null })}
                areas={areas}
              />
            </div>

            {/* Active filters indicator */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" /> Xóa bộ lọc
              </button>
            )}
          </form>

          {/* Results info */}
          {pagination.total !== undefined && (
            <p className="text-sm text-zinc-500 mb-6">
              {pagination.total === 0
                ? "Không tìm thấy công thức nào"
                : `Hiển thị ${recipes.length} / ${pagination.total} công thức`}
            </p>
          )}

          {/* Recipe Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-zinc-800/50 rounded-2xl border border-zinc-700 overflow-hidden animate-pulse"
                >
                  <div className="h-48 bg-zinc-700" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 bg-zinc-700 rounded w-3/4" />
                    <div className="h-4 bg-zinc-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recipes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe._id} recipe={recipe} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <ChefHat className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg">
                Chưa có công thức nào phù hợp
              </p>
              <button
                onClick={clearFilters}
                className="mt-4 text-primary hover:underline"
              >
                Xóa bộ lọc và thử lại
              </button>
            </div>
          )}

          {/* Smart Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-1.5 mt-10">
              <button
                onClick={() => updateParams({ page: page > 1 ? String(page - 1) : null })}
                disabled={page <= 1}
                className="w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {pageNumbers.map((p, idx) =>
                p === "..." ? (
                  <span key={`dots-${idx}`} className="w-8 text-center text-zinc-500">
                    ···
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => updateParams({ page: p === 1 ? null : String(p) })}
                    className={`w-10 h-10 rounded-lg font-semibold text-sm transition-all ${
                      p === page
                        ? "bg-primary text-white shadow-lg shadow-primary/30"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

              <button
                onClick={() =>
                  updateParams({
                    page: page < pagination.totalPages ? String(page + 1) : String(pagination.totalPages),
                  })
                }
                disabled={page >= pagination.totalPages}
                className="w-10 h-10 rounded-lg flex items-center justify-center bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Internal Linking — SEO Hub */}
      <section className="bg-zinc-900 py-12 border-t border-zinc-800">
        <div className="container-custom">
          <h2 className="text-center text-2xl font-bold text-white uppercase mb-2">
            Công cụ <span className="text-primary">hỗ trợ</span> dinh dưỡng
          </h2>
          <p className="text-center text-sm text-zinc-400 mb-8">
            Kết hợp công thức nấu ăn với dinh dưỡng khoa học
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              to="/tdee-calculator"
              className="group border border-zinc-700 bg-zinc-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Flame className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                Tính TDEE & Macro
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Xác định lượng calo và macro cần nạp mỗi ngày phù hợp mục tiêu.
              </p>
            </Link>
            <Link
              to="/exercises"
              className="group border border-zinc-700 bg-zinc-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Dumbbell className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                Hệ thống bài tập
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Tạo lịch tập cá nhân hóa với hệ thống bài tập chuyên nghiệp.
              </p>
            </Link>
            <Link
              to="/ket-qua-khach-hang"
              className="group border border-zinc-700 bg-zinc-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Calendar className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                Kết quả khách hàng
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Xem hành trình thay đổi vóc dáng thực tế từ các học viên.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <ScrollToTop />
      <ChatIcons />
      <Footer />
    </>
  );
};

export default RecipeExplorer;
