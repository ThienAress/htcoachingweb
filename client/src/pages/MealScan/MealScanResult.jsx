import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BarChart3,
  ScanLine,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import MealMacroSummary from "./MealMacroSummary";
import { calculateMacroBalanceScore } from "./mealScan.helpers";

const scoreStyle = (score) => {
  if (score >= 9) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 7) return "border-sky-200 bg-sky-50 text-sky-700";
  if (score >= 5) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
};

export default function MealScanResult({
  result,
  status,
  error,
  adjustments,
  declaredIngredients,
  onPortionChange,
  onRetry,
  quotaAction = null,
}) {
  const { t } = useTranslation("mealScan");
  const firstPortionRef = useRef(null);
  const busy = ["checking", "compressing", "analyzing"].includes(status);

  if (busy) {
    return (
      <section className="flex min-h-[34rem] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="max-w-sm text-center" role="status" aria-live="polite">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full border border-primary/25" />
            <div className="absolute inset-2 animate-pulse rounded-full border border-primary/45" />
            <div className="absolute inset-4 rounded-full border border-primary/80" />
            <ScanLine size={24} className="relative text-primary" aria-hidden="true" />
          </div>
          <h2 className="mt-6 text-xl font-bold text-slate-900">
            {status === "compressing"
              ? t("result.compressing_title")
              : status === "checking"
                ? t("result.checking_title")
                : t("result.processing_title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t("result.processing_desc")}
          </p>
          <div className="mt-8 space-y-2">
            <div className="mx-auto h-2 w-4/5 animate-pulse rounded-full bg-slate-100" />
            <div className="mx-auto h-2 w-3/5 animate-pulse rounded-full bg-slate-100" />
            <div className="mx-auto h-2 w-2/3 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex min-h-[34rem] flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
        <div className="max-w-md text-center" role="alert">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50">
            <AlertCircle size={32} className="text-rose-500" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">
            {t("result.error_title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
          {quotaAction ? (
            <Link
              to={quotaAction === "login" ? "/login" : "/#pricing"}
              state={
                quotaAction === "login" ? { from: "/quet-mon-an" } : undefined
              }
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t(
                quotaAction === "login"
                  ? "result.login_to_continue"
                  : "result.view_plans",
              )}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onRetry}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("result.retry")}
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="flex min-h-[34rem] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <ScanLine size={28} className="text-slate-400" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-900">
            {t("result.empty_title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {t("result.empty_desc")}
          </p>
        </div>
      </section>
    );
  }

  const macroScore = calculateMacroBalanceScore(result.total);
  const displayedDeclaredIngredients = Array.isArray(result.declaredIngredients)
    ? result.declaredIngredients
    : (declaredIngredients || []).map((item) => ({
        ...item,
        status: "unresolved",
        includedInTotal: false,
      }));

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="meal-scan-result-title"
    >
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
              <BarChart3 size={14} aria-hidden="true" />
              {t("result.estimate")}
            </p>
            <h2
              id="meal-scan-result-title"
              className="mt-1.5 text-2xl font-black leading-tight text-slate-950"
            >
              {result.mealName}
            </h2>
          </div>
          <div
            className={`rounded-xl border px-3 py-2 text-right ${scoreStyle(macroScore.score)}`}
            aria-label={t("result.score_aria", { score: macroScore.score })}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide">
              {t("result.macro_score")}
            </p>
            <p className="mt-0.5 text-lg font-black">
              {macroScore.score}/10
            </p>
            <p className="text-[10px] font-semibold">
              {t(`result.score_${macroScore.labelKey}`)}
            </p>
          </div>
        </div>

        {result.imageAssessment?.scenario &&
          result.imageAssessment.scenario !== "unknown" && (
            <p className="mt-3 text-xs font-semibold text-slate-500">
              {t("result.scenario")}: {t(`scenario.${result.imageAssessment.scenario}`)}
              {result.imageAssessment.servingsVisible > 1
                ? ` · ${t("result.servings_visible", {
                    count: result.imageAssessment.servingsVisible,
                  })}`
                : ""}
            </p>
          )}
        <p className="mt-2 text-xs leading-5 text-slate-400">
          {t("result.score_help")}
        </p>
      </div>

      <div className="border-b border-slate-100 px-6 py-5">
        <MealMacroSummary total={result.total} />
      </div>

      {displayedDeclaredIngredients.length > 0 && (
        <div className="border-b border-slate-100 px-6 py-5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {t("result.declared_ingredients")}
          </h3>
          <div className="mt-3 space-y-2">
            {displayedDeclaredIngredients.map((item) => (
              <div
                key={`${item.name}-${item.grams}`}
                className="grid gap-2 rounded-xl bg-slate-50 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-slate-800">{item.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {item.grams} g
                  </p>
                </div>
                {item.includedInTotal ? (
                  <div className="sm:text-right">
                    <p className="text-xs font-bold text-emerald-700">
                      {t("result.declared_included")}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-600">
                      +{item.calories.estimate} kcal ·{" "}
                      {t("result.compact_protein")} {item.protein.estimate} g ·{" "}
                      {t("result.compact_carb")} {item.carb.estimate} g ·{" "}
                      {t("result.compact_fat")} {item.fat.estimate} g
                    </p>
                  </div>
                ) : (
                  <div className="sm:max-w-xs sm:text-right">
                    <p className="text-xs font-bold text-amber-800">
                      {t("result.declared_unresolved")}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-600">
                      {t("result.declared_unresolved_help")}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {t("result.estimated_ingredients")}
          </h3>
          <span className="text-xs text-slate-400">{t("result.adjust_hint")}</span>
        </div>

        <div className="space-y-2">
          {result.items.map((item, index) => (
            <div
              key={item.id}
              className="grid gap-3 rounded-xl bg-slate-50 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem] sm:items-center"
            >
              <div>
                <p className="font-semibold text-slate-900">{item.label}</p>
                {item.note && (
                  <p className="mt-0.5 text-xs leading-5 text-slate-400">
                    {item.note}
                  </p>
                )}
              </div>

              <label className="text-sm font-semibold text-slate-500">
                <span
                  aria-hidden="true"
                  className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  {t("result.portion")}
                </span>
                <span className="sr-only">
                  {t("result.portion_for", { item: item.label })}
                </span>
                <span className="relative block">
                  <input
                    ref={index === 0 ? firstPortionRef : undefined}
                    type="number"
                    min="1"
                    max="3000"
                    inputMode="decimal"
                    value={adjustments[item.id] ?? item.portionGrams.estimate}
                    onChange={(event) =>
                      onPortionChange(item.id, event.target.value)
                    }
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      onPortionChange(
                        item.id,
                        Number.isFinite(value)
                          ? Math.min(Math.max(value, 1), 3000)
                          : item.portionGrams.estimate,
                      );
                    }}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 pr-7 text-right text-sm font-bold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    g
                  </span>
                </span>
              </label>

              <div className="text-left sm:text-right">
                <p className="font-black text-slate-900">
                  {item.calories.estimate}
                  <span className="ml-1 text-xs font-semibold text-slate-400">kcal</span>
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-400">
                  {t("result.compact_protein")} {item.protein.estimate} g ·{" "}
                  {t("result.compact_carb")} {item.carb.estimate} g ·{" "}
                  {t("result.compact_fat")} {item.fat.estimate} g
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 px-6 py-4">
        <p className="text-xs leading-5 text-slate-400">{result.disclaimer}</p>
        {result.allergyDisclaimer && (
          <p className="mt-2 text-xs font-medium leading-5 text-rose-700">
            {result.allergyDisclaimer}
          </p>
        )}
      </div>
    </section>
  );
}
