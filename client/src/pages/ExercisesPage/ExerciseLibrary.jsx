import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Dumbbell,
  FileDown,
  ImageOff,
  RotateCcw,
  Search,
} from "lucide-react";

import { getExerciseDetailPath } from "./exerciseDetailPath";
import { filterExerciseCatalog } from "./exerciseLibraryFilters";

const INITIAL_VISIBLE_EXERCISES = 24;

const ExerciseImage = ({ exercise, className }) => {
  const { t } = useTranslation("exercises");
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(exercise.imageUrl) && !failed;

  if (!hasImage) {
    return (
      <div className={`${className} flex flex-col items-center justify-center gap-2 bg-gray-900 text-gray-500`}>
        <ImageOff className="size-8" aria-hidden="true" />
        <span className="text-xs font-medium">{t("modal.no_image")}</span>
      </div>
    );
  }

  return (
    <div className={`${className} flex items-center justify-center overflow-hidden bg-white p-3`}>
      <img
        src={exercise.imageUrl}
        alt={t("library.image_alt", { name: exercise.name })}
        className="block h-auto max-h-full w-auto max-w-full object-contain"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
};

const ExerciseCard = ({ exercise }) => {
  const { t } = useTranslation("exercises");

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/60 motion-reduce:transform-none motion-reduce:transition-none">
      <ExerciseImage exercise={exercise} className="h-56 w-full" />
      <div className="flex flex-1 flex-col p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-6 text-white text-pretty">
            {exercise.name}
          </h2>
          <p className="mt-2 inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-orange-300">
            {exercise.muscleGroup || t("modal.no_muscle")}
          </p>
        </div>
        <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-300 text-pretty">
          {exercise.description || t("modal.no_desc")}
        </p>
        <Link
          to={getExerciseDetailPath(exercise)}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none"
        >
          {t("library.view_detail")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
};

export default function ExerciseLibrary({
  exercises = [],
  isLoading = false,
  isError = false,
  onRetry,
  onOpenPlanner,
}) {
  const { t } = useTranslation("exercises");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_EXERCISES);

  const muscleGroups = useMemo(
    () => [...new Set(exercises.map((item) => item.muscleGroup).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    [exercises],
  );
  const filteredExercises = useMemo(
    () => filterExerciseCatalog(exercises, {
      searchTerm,
      muscleGroup: selectedMuscleGroup,
      difficulty,
    }),
    [difficulty, exercises, searchTerm, selectedMuscleGroup],
  );
  const hasActiveFilters = Boolean(searchTerm || selectedMuscleGroup || difficulty);
  const visibleExercises = filteredExercises.slice(0, visibleCount);
  const hasMoreExercises = visibleCount < filteredExercises.length;

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedMuscleGroup("");
    setDifficulty("");
    setVisibleCount(INITIAL_VISIBLE_EXERCISES);
  };

  return (
    <div data-exercise-library="true">
      <div className="flex flex-col gap-6 border-b border-gray-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-primary">
            <Dumbbell className="size-5" aria-hidden="true" />
            {t("badge")}
          </div>
          <h1 className="font-display text-fluid-5xl font-black uppercase leading-none tracking-normal text-white text-balance">
            {t("library.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-300 text-pretty">
            {t("library.description")}
          </p>
        </div>
        <button
          type="button"
          data-open-workout-planner="true"
          onClick={onOpenPlanner}
          className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl border border-gray-700 bg-gray-900 px-5 py-3 text-sm font-bold text-white transition-[border-color,color,background-color] duration-200 hover:border-primary hover:bg-gray-800 hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 lg:self-auto motion-reduce:transition-none"
        >
          <FileDown className="size-5" aria-hidden="true" />
          {t("library.open_planner")}
        </button>
      </div>

      <section className="py-8" aria-labelledby="exercise-search-title">
        <h2 id="exercise-search-title" className="sr-only">
          {t("library.search_label")}
        </h2>
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">{t("library.search_label")}</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-500" aria-hidden="true" />
               <input
                 type="search"
                 name="exercise-search"
                 autoComplete="off"
                value={searchTerm}
                 onChange={(event) => {
                   setSearchTerm(event.target.value);
                   setVisibleCount(INITIAL_VISIBLE_EXERCISES);
                 }}
                placeholder={t("library.search_placeholder")}
                className="min-h-12 w-full rounded-xl border border-gray-700 bg-gray-950 py-3 pl-12 pr-4 text-base text-white placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <select
              name="exercise-difficulty"
              value={difficulty}
              onChange={(event) => {
                setDifficulty(event.target.value);
                setVisibleCount(INITIAL_VISIBLE_EXERCISES);
              }}
              aria-label={t("difficulty.filter_label")}
              className="min-h-12 rounded-xl border border-gray-700 bg-gray-950 px-4 text-sm font-semibold text-gray-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{t("difficulty.filter_all")}</option>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {t("difficulty.filter_rating", { rating, count: rating })}
                </option>
              ))}
              <option value="unrated">{t("difficulty.not_rated")}</option>
            </select>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:flex-wrap">
            {[{ value: "", label: t("library.all_groups") }, ...muscleGroups.map((group) => ({ value: group, label: group }))]
              .map((group) => {
                const active = selectedMuscleGroup === group.value;
                return (
                  <button
                    key={group.value || "all"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedMuscleGroup(group.value);
                      setVisibleCount(INITIAL_VISIBLE_EXERCISES);
                    }}
                    className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-[border-color,color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none ${active
                      ? "border-primary bg-primary text-white"
                      : "border-gray-700 bg-gray-950 text-gray-300 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    {group.label}
                  </button>
                );
              })}
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-gray-300" role="status">
            <Dumbbell className="mx-auto size-9 animate-pulse text-primary motion-reduce:animate-none" aria-hidden="true" />
            <p className="mt-3 font-semibold">{t("library.loading")}</p>
          </div>
        ) : isError ? (
          <div className="py-16 text-center" role="alert" data-exercise-error="true">
            <AlertTriangle className="mx-auto size-10 text-amber-400" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-white">{t("library.error_title")}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-400">{t("library.error_description")}</p>
            <button
              type="button"
              onClick={() => onRetry?.()}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 font-bold text-white transition-colors duration-200 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {t("library.retry")}
            </button>
          </div>
        ) : (
          <>
            <div className="my-6 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-gray-300" aria-live="polite">
                {t("library.result_count", { count: filteredExercises.length })}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-semibold text-orange-300 underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                >
                  {t("library.clear_filters")}
                </button>
              )}
            </div>

             {filteredExercises.length > 0 ? (
              <>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleExercises.map((item) => (
                    <ExerciseCard key={item._id} exercise={item} />
                  ))}
                </div>
                {hasMoreExercises && (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((count) => count + INITIAL_VISIBLE_EXERCISES)}
                      className="min-h-11 rounded-xl border border-gray-700 bg-gray-900 px-5 py-2 font-bold text-white transition-[border-color,color,background-color] duration-200 hover:border-primary hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none"
                    >
                      {t("library.load_more")}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-16 text-center" data-exercise-empty="true">
                <Search className="mx-auto size-10 text-gray-600" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-bold text-white">{t("library.empty_title")}</h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-400">{t("library.empty_description")}</p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-5 min-h-11 rounded-xl border border-gray-700 px-5 py-2 font-bold text-white transition-colors duration-200 hover:border-primary hover:text-orange-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transition-none"
                  >
                    {t("library.clear_filters")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
