import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Calendar, Dumbbell, Flame } from "lucide-react";

import ChatIcons from "../../components/ChatIcons";
import ScrollToTop from "../../components/ScrollToTop";
import SEO from "../../components/SEO";
import { useAuth } from "../../context/AuthContext";
import useExercisesLogic from "../../hooks/useExercisesLogic";
import { usePrompt } from "../../hooks/usePrompt";
import Header from "../../sections/Header/Header";
import { SEARCH_INDEX_EXERCISE_IDS } from "../../seo/searchIndexCohort.js";
import { resolveInitialCustomerDashboardTheme } from "../../utils/customerDashboardTheme";
import { translateData } from "../../utils/localDataTranslator";
import ExerciseLibrary from "./ExerciseLibrary";
import WorkoutPlanner from "./WorkoutPlanner";
import { workoutSections } from "./constants";

const relatedTools = [
  { to: "/tdee-calculator/", icon: Flame, titleKey: "links.tdee_title", descriptionKey: "links.tdee_desc" },
  { to: "/mealplan/", icon: Calendar, titleKey: "links.mealplan_title", descriptionKey: "links.mealplan_desc" },
  { to: "/ket-qua-khach-hang/", icon: Dumbbell, titleKey: "links.stories_title", descriptionKey: "links.stories_desc" },
];

const RelatedTools = ({ t }) => (
  <section className="border-t border-gray-800 bg-gray-900 py-12">
    <div className="container-custom">
      <h2 className="text-center text-2xl font-bold uppercase text-white">
        {t("explorer.tools_title")}
      </h2>
      <p className="mt-2 text-center text-sm text-gray-400">{t("explorer.tools_desc")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {relatedTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.to}
              to={tool.to}
              className="group rounded-xl border border-gray-800 bg-gray-950 p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <Icon className="mb-3 size-6 text-primary" aria-hidden="true" />
              <h3 className="font-bold text-white transition-colors duration-200 group-hover:text-orange-300 motion-reduce:transition-none">
                {t(tool.titleKey)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">{t(tool.descriptionKey)}</p>
            </Link>
          );
        })}
      </div>
    </div>
  </section>
);

const ExercisesPage = () => {
  const { t, i18n } = useTranslation("exercises");
  const { user } = useAuth();
  const logic = useExercisesLogic();
  const [activeView, setActiveView] = useState("library");
  const [hasExported, setHasExported] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [sending, setSending] = useState(false);
  const [customerTheme] = useState(resolveInitialCustomerDashboardTheme);
  const usesCustomerTheme = user?.role === "user";

  const translatedExercises = translateData(logic.exerciseOptions, "exercise", i18n.language);
  const hasWorkoutData = logic.workoutData.length > 0;

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasWorkoutData || hasExported) return undefined;
      event.preventDefault();
      event.returnValue = t("alert_beforeunload");
      return event.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasExported, hasWorkoutData, t]);

  usePrompt(hasWorkoutData && !hasExported, t("alert_leave"));

  const handleExportPDF = async () => {
    try {
      if (!logic.selectedMuscleGroups || !logic.workoutData) {
        toast.warning(t("toast_not_ready"));
        return;
      }
      if (!workoutSections.length) {
        toast.error(t("toast_structure_error"));
        return;
      }

      const planData = logic.selectedMuscleGroups
        .map((groupId) => {
          const group = logic.getMuscleGroupById(groupId);
          const sections = workoutSections
            .map((section) => {
              const rows = logic.workoutData.filter(
                (exercise) => exercise.muscleGroup === groupId && exercise.section === section.id,
              );
              if (!rows.length) return null;
              return { id: section.id, title: section.title, data: rows };
            })
            .filter(Boolean);
          if (!sections.length) return null;
          return {
            muscleGroup: group ? group.name : groupId,
            date: new Date().toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US"),
            sections,
          };
        })
        .filter(Boolean);

      if (!planData.length) {
        toast.warning(t("toast_no_plan"));
        return;
      }

      const [{ pdf }, { saveAs }, { default: WorkoutPlanPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("file-saver"),
        import("./WorkoutPlanPDF"),
      ]);
      const exportDate = new Date().toLocaleDateString(
        i18n.language === "vi" ? "vi-VN" : "en-US",
      );
      const blob = await pdf(
        <WorkoutPlanPDF planData={planData} date={exportDate} t={t} />,
      ).toBlob();
      saveAs(blob, `Lich_Tap_${new Date().toISOString().slice(0, 10)}.pdf`);
      setHasExported(true);
      toast.success(t("toast_pdf_success"));
    } catch {
      toast.error(t("toast_pdf_error"));
    }
  };

  const handleSendSuggestion = async () => {
    if (!suggestion.trim()) {
      toast.warning(t("toast_suggestion_empty"));
      return;
    }
    setSending(true);
    const success = await logic.sendExerciseSuggestion(suggestion);
    if (success) {
      toast.success(t("toast_suggestion_success"));
      setSuggestion("");
    } else {
      toast.error(t("toast_suggestion_error"));
    }
    setSending(false);
  };

  return (
    <>
      <SEO
        title={t("seo_title")}
        description={t("seo_desc")}
        canonical="/exercises"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": `${t("seo_title")} - HTCOACHING`,
          "description": t("seo_desc"),
          "url": "https://htcoachingweb.io.vn/exercises/",
          "applicationCategory": "HealthApplication",
          "operatingSystem": "Web",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "VND" },
          "provider": {
            "@type": "Organization",
            "name": "HTCOACHING",
            "url": "https://htcoachingweb.io.vn/",
          },
        }}
      />
      <Header />
      <div
        className={usesCustomerTheme ? "customer-dashboard customer-tool-surface" : undefined}
        data-theme={usesCustomerTheme ? customerTheme : undefined}
      >
      <main className="min-h-screen overflow-x-hidden bg-gray-950 pb-12 pt-28 text-white">
        <div className="container-custom">
          {activeView === "library" ? (
            <ExerciseLibrary
              key={i18n.resolvedLanguage || i18n.language}
              exercises={translatedExercises}
              isLoading={logic.isExercisesLoading}
              isError={logic.isExercisesError}
              onRetry={logic.retryExercises}
              onOpenPlanner={() => setActiveView("planner")}
              priorityExerciseIds={SEARCH_INDEX_EXERCISE_IDS}
            />
          ) : (
            <WorkoutPlanner
              logic={logic}
              exerciseOptions={translatedExercises}
              onBack={() => setActiveView("library")}
              onExportPDF={handleExportPDF}
              suggestion={suggestion}
              onSuggestionChange={setSuggestion}
              sending={sending}
              onSendSuggestion={handleSendSuggestion}
            />
          )}
        </div>

      </main>

      <RelatedTools t={t} />
      </div>
      <ScrollToTop />
      <ChatIcons />
    </>
  );
};

export default ExercisesPage;
