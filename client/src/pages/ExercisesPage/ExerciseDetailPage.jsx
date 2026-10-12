import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Dumbbell, ImageOff, Play, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import ChatIcons from "../../components/ChatIcons";
import ScrollToTop from "../../components/ScrollToTop";
import SEO from "../../components/SEO";
import { useAuth } from "../../context/AuthContext";
import {
  exerciseDetailQueryOptions,
  exerciseReviewsQueryOptions,
} from "../../queries/exercise.queries";
import { isIndexableExerciseDetail } from "../../seo/searchIndexDetailPolicy.js";
import { normalizeSeoDescription } from "../../seo/seoDescription.js";
import Header from "../../sections/Header/Header";
import { resolveInitialCustomerDashboardTheme } from "../../utils/customerDashboardTheme";
import ExerciseReviews from "./ExerciseReviews";
import ExerciseSetupGuide from "./ExerciseSetupGuide";
import { getExerciseDetailPath } from "./exerciseDetailPath";

const ExerciseHeroImage = ({ exercise, t }) => {
  const [failed, setFailed] = useState(false);

  if (!exercise.imageUrl || failed) {
    return (
      <div className="flex aspect-[4/3] min-h-72 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900 text-gray-500 sm:aspect-[5/4] lg:aspect-[4/5] lg:max-h-[34rem] lg:min-h-[30rem]">
        <div className="text-center">
          <ImageOff className="mx-auto size-10" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold">{t("modal.no_image")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex aspect-[4/3] min-h-72 items-center justify-center overflow-hidden rounded-2xl border border-gray-800 bg-white p-5 sm:aspect-[5/4] lg:aspect-[4/5] lg:max-h-[34rem] lg:min-h-[30rem]">
      <img
        src={exercise.imageUrl}
        alt={t("library.image_alt", { name: exercise.name })}
        className="block max-h-full max-w-full object-contain"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
};

export const ExerciseDetailContent = ({ exercise, reviewSummary, t }) => {
  const instructions = exercise.instructions || [];
  const parsedDifficulty = Number(exercise.technicalDifficultyRating);
  const hasDifficulty = Number.isFinite(parsedDifficulty) && parsedDifficulty > 0;
  const difficulty = hasDifficulty
    ? Math.min(5, Math.max(1, Math.round(parsedDifficulty)))
    : 0;
  const hasCommunityRating = reviewSummary?.total > 0;

  return (
    <>
      <section
        className="grid gap-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-center lg:gap-14"
        data-exercise-detail-hero="recipe"
      >
        <ExerciseHeroImage exercise={exercise} t={t} />
        <div className="lg:py-5">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-orange-300">
            {t("detail.title")}
          </p>
          <h1 className="mt-5 font-display text-fluid-5xl font-black uppercase leading-none text-white text-balance">
            {exercise.name}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold">
            <span
              className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-orange-300"
              data-exercise-detail-muscle="pill"
            >
              {exercise.muscleGroup || t("modal.no_muscle")}
            </span>
            {hasCommunityRating && (
              <span className="inline-flex items-center gap-2 text-amber-300">
                <Star className="size-5 fill-current" aria-hidden="true" />
                {t("detail.reviews.summary", {
                  rating: reviewSummary.averageRating,
                  count: reviewSummary.total,
                })}
              </span>
            )}
          </div>
          <p className="mt-6 whitespace-pre-wrap text-base leading-7 text-gray-300 text-pretty">
            {exercise.description || t("modal.no_desc")}
          </p>
          <div className="mt-8 border-t border-gray-800 pt-7">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <strong className="font-semibold text-white">
                {t("difficulty.title")}: {hasDifficulty ? `${difficulty}/5` : t("difficulty.not_rated")}
              </strong>
              <span className="text-gray-500">{t("detail.admin_difficulty")}</span>
            </div>
            <div
              className="mt-4 flex gap-2"
              role="img"
              aria-label={
                hasDifficulty
                  ? t("difficulty.rating_label", { rating: difficulty })
                  : t("difficulty.not_rated")
              }
              data-exercise-difficulty-segments="true"
            >
              {[1, 2, 3, 4, 5].map((segment) => (
                <span
                  key={segment}
                  className={`h-3 flex-1 rounded-full ${
                    segment <= difficulty ? "bg-primary" : "bg-gray-700"
                  }`}
                  data-active={segment <= difficulty ? "true" : "false"}
                  data-exercise-difficulty-segment={segment}
                />
              ))}
            </div>
            <a
              href="#exercise-setup-title"
              aria-label={t("detail.go_to_setup")}
              className="mt-7 inline-flex size-12 items-center justify-center rounded-full border border-gray-800 bg-gray-900 text-gray-300 transition-colors hover:border-primary hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              <ChevronDown className="size-6" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {exercise.videoUrl && (
        <section
          aria-labelledby="exercise-video-title"
          className="mt-14 border-t border-gray-800 pt-14"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-orange-300">
              <Play className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">
                {t("detail.video_eyebrow")}
              </p>
              <h2 id="exercise-video-title" className="text-xl font-bold text-white">
                {t("detail.video_title")}
              </h2>
            </div>
          </div>
          <video
            src={exercise.videoUrl}
            controls
            preload="metadata"
            playsInline
            className="max-h-[70vh] w-full rounded-xl bg-black"
          >
            {t("detail.video_unsupported")}
          </video>
        </section>
      )}

      <ExerciseSetupGuide instructions={instructions} t={t} />
    </>
  );
};

export default function ExerciseDetailPage() {
  const { id, slug } = useParams();
  const { t, i18n } = useTranslation("exercises");
  const { user } = useAuth();
  const [customerTheme] = useState(resolveInitialCustomerDashboardTheme);
  const usesCustomerTheme = user?.role === "user";
  const query = useQuery(
    exerciseDetailQueryOptions({
      exerciseId: id,
      language: i18n.resolvedLanguage || i18n.language,
    }),
  );
  const reviewsQuery = useQuery(exerciseReviewsQueryOptions(id));
  const exercise = query.data?.data;
  const reviewSummary = reviewsQuery.data?.data?.summary;
  const canonical = exercise
    ? getExerciseDetailPath(exercise)
    : `/exercises/${id}/`;
  const isIndexable = isIndexableExerciseDetail({
    routeSlug: slug,
    exercise,
  });
  const exerciseSeoDescription = exercise
    ? normalizeSeoDescription(
        t("detail.seo_description", {
          name: exercise.name,
          muscleGroup: exercise.muscleGroup || t("modal.no_muscle"),
          steps: exercise.instructions?.length || 0,
        }),
      )
    : t("seo_desc");

  const jsonLd = exercise
    ? {
        "@context": "https://schema.org",
        "@type": exercise.instructions?.length ? "HowTo" : "Article",
        name: exercise.name,
        description: exerciseSeoDescription,
        image: exercise.imageUrl || undefined,
        url: `https://htcoachingweb.io.vn${canonical}`,
        step: exercise.instructions?.map((step) => ({
          "@type": "HowToStep",
          name: step.title,
          text: step.description || step.title,
        })),
        publisher: {
          "@type": "Organization",
          name: "HTCOACHING",
        },
      }
    : undefined;

  return (
    <>
      {!query.isLoading && (
        <SEO
          title={exercise?.name || t("detail.title")}
          description={exerciseSeoDescription}
          canonical={canonical}
          image={exercise?.imageUrl}
          type="article"
          noindexFollow={!isIndexable}
          jsonLd={isIndexable ? jsonLd : undefined}
        />
      )}
      <Header />
      <div
        className={
          usesCustomerTheme
            ? "customer-dashboard customer-tool-surface"
            : undefined
        }
        data-theme={usesCustomerTheme ? customerTheme : undefined}
      >
        <main className="min-h-screen overflow-x-hidden bg-gray-950 pt-28 text-white">
          <div className="container-custom pb-4">
            <Link
              to="/exercises/"
              className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-bold text-gray-200 transition-colors hover:border-primary hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("detail.back_to_library")}
            </Link>

            {query.isLoading ? (
              <div className="py-24 text-center" role="status">
                <Dumbbell className="mx-auto size-10 animate-pulse text-primary motion-reduce:animate-none" />
                <p className="mt-4 text-gray-300">{t("detail.loading")}</p>
              </div>
            ) : query.isError || !exercise ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center" role="alert">
                <h1 className="text-2xl font-bold text-white">
                  {t("detail.error_title")}
                </h1>
                <p className="mt-3 text-sm text-gray-300">
                  {t("detail.error_description")}
                </p>
              </div>
            ) : (
              <ExerciseDetailContent
                key={exercise._id}
                exercise={exercise}
                reviewSummary={reviewSummary}
                t={t}
              />
            )}
          </div>

          {exercise && <ExerciseReviews exerciseId={exercise._id} />}
        </main>
      </div>
      <ScrollToTop />
      <ChatIcons />
    </>
  );
}
