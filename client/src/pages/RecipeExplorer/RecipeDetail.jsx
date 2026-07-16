import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  ChefHat,
  Heart,
  Check,
  Copy,
  Youtube,
  Flame,
  Dumbbell,
  Calendar,
} from "lucide-react";
import { useState } from "react";

import { getRecipeBySlug, toggleBookmark } from "../../services/recipe.service";
import { useAuth } from "../../context/AuthContext";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import ChatIcons from "../../components/ChatIcons";
import ScrollToTop from "../../components/ScrollToTop";
import SEO from "../../components/SEO";
import { getFlagUrl } from "./constants";

const RecipeDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["recipe", slug],
    queryFn: () => getRecipeBySlug(slug),
    enabled: !!slug,
  });

  const bookmarkMutation = useMutation({
    mutationFn: (recipeId) => toggleBookmark(recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe-bookmarks"] });
    },
  });

  const recipe = data?.data;
  const displayArea = recipe?.area === "Vietnamese" ? "Việt Nam" : recipe?.area;

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-black text-white pt-28 pb-16">
          <div className="container-custom max-w-4xl animate-pulse space-y-6">
            <div className="h-8 w-48 bg-zinc-700 rounded" />
            <div className="h-72 bg-zinc-700 rounded-2xl" />
            <div className="h-10 w-3/4 bg-zinc-700 rounded" />
            <div className="grid md:grid-cols-3 gap-6">
              <div className="h-64 bg-zinc-700 rounded-xl" />
              <div className="md:col-span-2 h-64 bg-zinc-700 rounded-xl" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error || !recipe) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-black text-white pt-28 pb-16">
          <div className="container-custom text-center py-20">
            <ChefHat className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">
              Không tìm thấy công thức
            </h1>
            <p className="text-zinc-400 mb-6">
              Công thức này có thể đã bị xóa hoặc đường dẫn không đúng.
            </p>
            <Link
              to="/cong-thuc-nau-an"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 rounded-full transition"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const embedUrl = getYoutubeEmbedUrl(recipe.youtubeUrl);

  return (
    <>
      <SEO
        title={recipe.name}
        description={`Công thức nấu ${recipe.name} — ${recipe.ingredients?.length || 0} nguyên liệu, hướng dẫn chi tiết từng bước tại HTCOACHING.`}
        canonical={`/cong-thuc-nau-an/${slug}`}
        image={recipe.thumbnail}
        type="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Recipe",
          "name": recipe.name,
          "image": recipe.thumbnail,
          "description": `Công thức nấu ${recipe.name} với ${recipe.ingredients?.length || 0} nguyên liệu.`,
          "prepTime": recipe.prepTime ? `PT${parseInt(recipe.prepTime)}M` : undefined,
          "recipeIngredient": recipe.ingredients?.map(
            (i) => `${i.measure} ${i.name}`,
          ),
          "recipeInstructions": recipe.instructions?.map((step, idx) => ({
            "@type": "HowToStep",
            "position": idx + 1,
            "text": step,
          })),
          "recipeCategory": recipe.category,
          "recipeCuisine": recipe.area,
          "author": {
            "@type": "Organization",
            "name": "HTCOACHING",
          },
        }}
      />
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-black text-white pt-28 pb-16">
        <div className="container-custom max-w-5xl">
          {/* Back button */}
          <Link
            to="/cong-thuc-nau-an"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </Link>

          {/* Top Section: Image (Left) + Title/Meta/Ingredients (Right) */}
          <div className="grid lg:grid-cols-[4fr_5fr] gap-8 xl:gap-12 mb-10">
            {/* Left: Image (Sticky) */}
            <div className="lg:sticky lg:top-28 h-fit">
              {recipe.thumbnail && (
                <div className="relative rounded-2xl overflow-hidden aspect-square sm:aspect-video lg:aspect-[4/5] bg-zinc-800 shadow-2xl ring-1 ring-white/10">
                  <img
                    src={recipe.thumbnail}
                    alt={recipe.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 mt-5">
                {user && (
                  <button
                    onClick={() => bookmarkMutation.mutate(recipe._id)}
                    disabled={bookmarkMutation.isPending}
                    className="flex items-center justify-center flex-1 gap-2 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm font-medium hover:border-primary hover:text-primary transition disabled:opacity-50"
                  >
                    <Heart className="w-4 h-4" />
                    Lưu yêu thích
                  </button>
                )}
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center flex-1 gap-2 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm font-medium hover:border-primary hover:text-primary transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Sao chép link
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Title, Meta, Actions, and Ingredients */}
            <div className="flex flex-col">
              {/* Title + Meta */}
              <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
              {recipe.name}
            </h1>
            {recipe.nameEn && recipe.nameEn !== recipe.name && (
              <p className="text-zinc-500 text-sm mt-1 italic">
                {recipe.nameEn}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-zinc-400">
              {displayArea && (
                <span className="flex items-center gap-1.5 font-medium">
                  {getFlagUrl(displayArea) ? (
                    <img src={getFlagUrl(displayArea)} alt={displayArea} className="w-6 h-auto rounded-sm shadow-sm" loading="lazy" />
                  ) : (
                    <span className="text-base">🌍</span>
                  )}
                  {displayArea}
                </span>
              )}
              {recipe.category && (
                <span className="flex items-center gap-1.5">
                  <ChefHat className="w-4 h-4 text-primary" />
                  {recipe.category}
                </span>
              )}
              {recipe.prepTime && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" />
                  {recipe.prepTime}
                </span>
              )}
            </div>

            {/* Tags */}
            {recipe.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

              </div>

              {/* Ingredients */}
              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex-1">
                <h2 className="font-bold text-white text-lg mb-5 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-xl">
                    📝
                  </span>
                  Nguyên liệu
                </h2>
              <ul className="space-y-2.5">
                {recipe.ingredients?.map((ing, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between items-start text-sm border-b border-zinc-700/50 pb-2 last:border-0"
                  >
                    <span className="text-zinc-200">{ing.name}</span>
                    <span className="text-zinc-400 text-right ml-3 shrink-0">
                      {ing.measure}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

          {/* Bottom Section: Instructions & Video */}
          <div className="space-y-10">
            {/* Instructions */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-xl">
              <h2 className="font-bold text-white text-xl mb-6 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-xl">
                  👨‍🍳
                </span>
                Cách chế biến
              </h2>
              <div className="space-y-4">
                {recipe.instructions?.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex gap-4 items-start bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4"
                  >
                    <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <p className="text-zinc-200 text-sm leading-relaxed">
                      {step.replace(/^Bước\s*\d+\s*:\s*/i, "")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* YouTube embed */}
            {embedUrl && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
                <h2 className="font-bold text-white text-xl mb-6 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Youtube className="w-5 h-5 text-red-500" />
                  </span>
                  Video hướng dẫn
                </h2>
              <div className="aspect-video rounded-xl overflow-hidden bg-zinc-800">
                <iframe
                  src={embedUrl}
                  title={`Hướng dẫn nấu ${recipe.name}`}
                  className="w-full h-full"
                  allowFullScreen
                  loading="lazy"
                />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Internal Linking */}
      <section className="bg-zinc-900 py-12 border-t border-zinc-800">
        <div className="container-custom">
          <h2 className="text-center text-2xl font-bold text-white uppercase mb-2">
            Khám phá <span className="text-primary">thêm</span>
          </h2>
          <p className="text-center text-sm text-zinc-400 mb-8">
            Kết hợp công thức với dinh dưỡng và tập luyện khoa học
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              to="/cong-thuc-nau-an"
              className="group border border-zinc-700 bg-zinc-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <ChefHat className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                Công thức nấu ăn
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Khám phá thêm công thức nấu ăn từ Việt Nam và thế giới.
              </p>
            </Link>
            <Link
              to="/tdee-calculator"
              className="group border border-zinc-700 bg-zinc-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Flame className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                Tính TDEE & Macro
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Xác định lượng calo cần nạp mỗi ngày phù hợp mục tiêu.
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
          </div>
        </div>
      </section>

      <ScrollToTop />
      <ChatIcons />
      <Footer />
    </>
  );
};

export default RecipeDetail;
