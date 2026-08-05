import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Gauge,
  ShieldCheck,
  Timer,
  Utensils,
} from "lucide-react";

import SEO from "../../components/SEO";
import { useAuth } from "../../context/AuthContext";
import { analyzeMeal } from "../../services/mealScan.service";
import { compressChatImage } from "../../utils/compressChatImage";
import MealScanAnalyzeDialog from "./MealScanAnalyzeDialog";
import MealScanIngredientSetup from "./MealScanIngredientSetup";
import MealScanResult from "./MealScanResult";
import MealScanUploader from "./MealScanUploader";
import {
  MAX_DECLARED_INGREDIENTS,
  prepareDeclaredIngredients,
} from "./mealScan.declaredIngredients";
import { applyPortionAdjustments } from "./mealScan.helpers";
import { inspectMealImageFile } from "./mealScan.imageQuality";

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

const FEATURE_LINKS = [
  ["/tdee-calculator", "tdee"],
  ["/mealplan", "mealplan"],
  ["/cong-thuc-nau-an", "recipes"],
];

const SCAN_ERROR_KEYS = {
  MEAL_SCAN_ANONYMOUS_LIMITED: "errors.MEAL_SCAN_ANONYMOUS_LIMITED",
  MEAL_SCAN_RATE_LIMITED: "errors.MEAL_SCAN_RATE_LIMITED",
};

let ingredientRowSequence = 0;
const createIngredientRow = () => ({
  id: `declared-ingredient-${ingredientRowSequence += 1}`,
  name: "",
  grams: "",
});

export default function MealScan() {
  const { t, i18n } = useTranslation("mealScan");
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [adjustments, setAdjustments] = useState({});
  const [imageQuality, setImageQuality] = useState(null);
  const [declaredIngredientRows, setDeclaredIngredientRows] = useState([
    createIngredientRow(),
  ]);
  const [declaredIngredients, setDeclaredIngredients] = useState([]);
  const [ingredientsLocked, setIngredientsLocked] = useState(false);
  const [ingredientErrorCode, setIngredientErrorCode] = useState("");
  const [confirmAnalysisOpen, setConfirmAnalysisOpen] = useState(false);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const jsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: t("seo.app_name"),
        description: t("seo.description"),
        url: "https://htcoachingweb.io.vn/quet-mon-an/",
        applicationCategory: "HealthApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        featureList: [
          t("seo.feature_calories"),
          t("seo.feature_macros"),
          t("seo.feature_portions"),
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [1, 2, 3].map((index) => ({
          "@type": "Question",
          name: t(`faq.q${index}`),
          acceptedAnswer: {
            "@type": "Answer",
            text: t(`faq.a${index}`),
          },
        })),
      },
    ],
    [t],
  );

  const adjustedResult = useMemo(
    () => applyPortionAdjustments(result, adjustments),
    [adjustments, result],
  );
  const showIngredientSetup =
    Boolean(file) && !result && !error && status === "selected";

  const clearPreview = () => {
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return "";
    });
  };

  const resetIngredientSetup = () => {
    setDeclaredIngredientRows([createIngredientRow()]);
    setDeclaredIngredients([]);
    setIngredientsLocked(false);
    setIngredientErrorCode("");
    setConfirmAnalysisOpen(false);
  };

  const handleFile = (candidate) => {
    setError("");

    if (!SUPPORTED_TYPES.has(candidate?.type)) {
      setError(t("errors.type"));
      return;
    }
    if (candidate.size > MAX_SOURCE_BYTES) {
      setError(t("errors.size"));
      return;
    }

    clearPreview();
    setFile(candidate);
    setPreviewUrl(URL.createObjectURL(candidate));
    setResult(null);
    setAdjustments({});
    setImageQuality(null);
    resetIngredientSetup();
    setStatus("selected");
  };

  const handleRemove = () => {
    clearPreview();
    setFile(null);
    setResult(null);
    setAdjustments({});
    setImageQuality(null);
    setError("");
    resetIngredientSetup();
    setStatus("idle");
  };

  const handleIngredientChange = (rowId, field, value) => {
    setDeclaredIngredientRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row,
      ),
    );
    setIngredientErrorCode("");
    setIngredientsLocked(false);
  };

  const handleAddIngredient = () => {
    setDeclaredIngredientRows((current) =>
      current.length >= MAX_DECLARED_INGREDIENTS
        ? current
        : [...current, createIngredientRow()],
    );
    setIngredientErrorCode("");
    setIngredientsLocked(false);
  };

  const handleRemoveIngredient = (rowId) => {
    setDeclaredIngredientRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length > 0 ? next : [createIngredientRow()];
    });
    setIngredientErrorCode("");
    setIngredientsLocked(false);
  };

  const handleLockIngredients = () => {
    const prepared = prepareDeclaredIngredients(declaredIngredientRows);
    if (!prepared.valid) {
      setIngredientErrorCode(prepared.code);
      return;
    }
    setDeclaredIngredients(prepared.ingredients);
    setIngredientErrorCode("");
    setIngredientsLocked(true);
  };

  const handleUnlockIngredients = () => {
    setIngredientsLocked(false);
    setIngredientErrorCode("");
  };

  const performAnalyze = async () => {
    if (!file || !ingredientsLocked) return;

    setError("");
    try {
      setStatus("checking");
      const quality = await inspectMealImageFile(file);
      setImageQuality(quality);
      if (!quality.usable) {
        const issue = quality.blockingIssues[0] || "unreadable";
        setError(t(`errors.quality_${issue}`));
        setStatus("selected");
        return;
      }
      setStatus("compressing");
      const image = await compressChatImage(file);
      setStatus("analyzing");
      const data = await analyzeMeal(
        image,
        i18n.language,
        declaredIngredients,
      );
      setResult(data);
      setAdjustments(
        Object.fromEntries(
          data.items.map((item) => [item.id, item.portionGrams.estimate]),
        ),
      );
      setStatus("result");
    } catch (scanError) {
      const errorKey = SCAN_ERROR_KEYS[scanError.response?.data?.code];
      setError(
        (errorKey && t(errorKey)) ||
          scanError.response?.data?.message ||
          scanError.message ||
          t("errors.generic"),
      );
      setStatus("error");
    }
  };

  const requestAnalyze = () => {
    if (!file || !ingredientsLocked) return;
    setConfirmAnalysisOpen(true);
  };

  const handleConfirmAnalysis = () => {
    setConfirmAnalysisOpen(false);
    void performAnalyze();
  };

  const handlePortionChange = (itemId, value) => {
    setAdjustments((current) => ({ ...current, [itemId]: value }));
  };
  return (
    <>
      <SEO
        title={t("seo.title")}
        description={t("seo.description")}
        canonical="/quet-mon-an"
        jsonLd={jsonLd}
      />

      <main className="min-h-screen bg-slate-50 pb-24 pt-28 text-slate-900 sm:pt-32">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">

          {/* ── HERO ── */}
          <header className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1">
              <Utensils size={13} className="text-primary" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                {t("hero.kicker")}
              </span>
            </div>
            <h1 className="mt-4 text-balance font-heading text-4xl font-black uppercase leading-[1.15] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              {t("hero.title_prefix")}
              <span className="text-primary-dark">{t("hero.title_highlight")}</span>
              {t("hero.title_suffix")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {t("hero.description")}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                { icon: Camera, label: t("hero.photo") },
                { icon: Gauge, label: t("hero.ranges") },
                { icon: CheckCircle2, label: t("hero.adjust") },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm"
                >
                  <Icon size={15} className="text-primary" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </header>

          {/* QUICK GUIDE */}
          <section
            className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            aria-labelledby="meal-scan-quick-title"
          >
            <div className="border-b border-slate-100 px-5 py-5 text-center sm:px-8">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                {t("quick.eyebrow")}
              </p>
              <h2
                id="meal-scan-quick-title"
                className="mt-1 text-xl font-black uppercase text-slate-950 sm:text-2xl"
              >
                {t("quick.title")}
              </h2>
            </div>
            <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                    {step}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {t("quick.step" + step + "_title")}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {t("quick.step" + step + "_desc")}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </section>

          {/* MAIN GRID */}
          <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-12">
            <div className="flex flex-col lg:col-span-5">
              <p className="mb-3 flex justify-center">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary shadow-sm">
                  {t("steps.upload")}
                </span>
              </p>
              <MealScanUploader
                user={user}
                file={file}
                previewUrl={previewUrl}
                status={status}
                canAnalyze={ingredientsLocked}
                onFile={handleFile}
                onAnalyze={requestAnalyze}
                onRemove={handleRemove}
                inputRef={inputRef}
                imageQuality={imageQuality}
              />
            </div>
            <div className="flex flex-col lg:col-span-7">
              <p className="mb-3 flex justify-center">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary shadow-sm">
                  {t("steps.analyze")}
                </span>
              </p>
              {showIngredientSetup ? (
                <MealScanIngredientSetup
                  rows={declaredIngredientRows}
                  locked={ingredientsLocked}
                  lockedIngredients={declaredIngredients}
                  errorCode={ingredientErrorCode}
                  onChange={handleIngredientChange}
                  onAdd={handleAddIngredient}
                  onRemove={handleRemoveIngredient}
                  onLock={handleLockIngredients}
                  onUnlock={handleUnlockIngredients}
                />
              ) : (
                <MealScanResult
                  result={adjustedResult}
                  status={status}
                  error={error}
                  adjustments={adjustments}
                  declaredIngredients={declaredIngredients}
                  onPortionChange={handlePortionChange}
                  onRetry={requestAnalyze}
                />
              )}
            </div>
          </div>

          {/* WHY TRY IT */}
          <section
            className="mt-20 border-t border-slate-200 pt-14"
            aria-labelledby="meal-scan-why-title"
          >
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                {t("why.eyebrow")}
              </p>
              <h2
                id="meal-scan-why-title"
                className="mx-auto mt-2 max-w-3xl text-balance text-2xl font-black uppercase text-slate-950 sm:text-3xl"
              >
                {t("why.title")}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-6 text-slate-500">
                {t("why.description")}
              </p>
            </div>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {[
                { icon: Timer, key: "speed" },
                { icon: Gauge, key: "transparent" },
                { icon: ShieldCheck, key: "privacy" },
              ].map(({ icon: Icon, key }) => (
                <div
                  key={key}
                  className="flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div className="mt-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      {t("why." + key + "_title")}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {t("why." + key + "_desc")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          {/* ── RELATED LINKS ── */}
          <section className="mt-14" aria-labelledby="meal-scan-next-title">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                {t("links.eyebrow")}
              </p>
              <h2
                id="meal-scan-next-title"
                className="mt-1 text-2xl font-black uppercase text-slate-950 sm:text-3xl"
              >
                {t("links.title")}
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
                {t("links.description")}
              </p>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {FEATURE_LINKS.map(([path, key]) => (
                <Link
                  key={path}
                  to={path}
                  className="group flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="font-bold text-slate-900 transition-colors group-hover:text-primary">
                    {t(`links.${key}_title`)}
                  </span>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <span className="text-sm leading-6 text-slate-500">
                      {t(`links.${key}_desc`)}
                    </span>
                    <ArrowRight
                      size={15}
                      className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <MealScanAnalyzeDialog
        open={confirmAnalysisOpen}
        onCancel={() => setConfirmAnalysisOpen(false)}
        onConfirm={handleConfirmAnalysis}
      />
    </>
  );
}
