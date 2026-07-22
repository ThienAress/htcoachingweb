import React, { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Flame,
  List,
  Info,
  FileText,
  Send,
  Dumbbell,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import useExercisesLogic from "../../hooks/useExercisesLogic";
import MuscleGroupSelector from "./MuscleGroupSelector";
import ExerciseSections from "./ExerciseSections";
import ExerciseListModal from "./ExerciseListModal";
import { workoutExplanations, workoutSections } from "./constants";
import Header from "../../sections/Header/Header";
import Footer from "../../sections/Footer/Footer";
import ChatIcons from "../../components/ChatIcons";
import ScrollToTop from "../../components/ScrollToTop";
import Contact from "../../sections/Contact";
import { usePrompt } from "../../hooks/usePrompt";
import SEO from "../../components/SEO";
import { translateData } from "../../utils/localDataTranslator";

const ExercisesPage = () => {
  const { t, i18n } = useTranslation("exercises");
  const logic = useExercisesLogic();

  const translatedExercises = translateData(logic.filteredExercises, "exercise", i18n.language);
  const translatedAllExercises = translateData(logic.exerciseOptions, "exercise", i18n.language);

  const hasWorkoutData = logic.workoutData && logic.workoutData.length > 0;
  const [hasExported, setHasExported] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasWorkoutData && !hasExported) {
        event.preventDefault();
        event.returnValue = t("alert_beforeunload");
        return event.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasExported, hasWorkoutData, t]);

  usePrompt(
    hasWorkoutData && !hasExported,
    t("alert_leave"),
  );

  const handleExportPDF = async () => {
    try {
      if (!logic.selectedMuscleGroups || !logic.workoutData) {
        toast.warning(t("toast_not_ready"));
        return;
      }
      if (!workoutSections || workoutSections.length === 0) {
        toast.error(t("toast_structure_error"));
        return;
      }

      const planData = logic.selectedMuscleGroups
        .map((groupId) => {
          const group = logic.getMuscleGroupById(groupId);
          const sections = workoutSections
            .map((section) => {
              const rows = logic.workoutData.filter(
                (ex) => ex.muscleGroup === groupId && ex.section === section.id,
              );
              if (rows.length === 0) return null;
              return {
                id: section.id,
                title: section.title,
                data: rows,
              };
            })
            .filter(Boolean);
          if (sections.length === 0) return null;
          return {
            muscleGroup: group ? group.name : groupId,
            date: new Date().toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US"),
            sections,
          };
        })
        .filter(Boolean);

      if (planData.length === 0) {
        toast.warning(t("toast_no_plan"));
        return;
      }

      const [{ pdf }, { saveAs }, { default: WorkoutPlanPDF }] =
        await Promise.all([
          import("@react-pdf/renderer"),
          import("file-saver"),
          import("./WorkoutPlanPDF"),
        ]);
      const blob = await pdf(
        <WorkoutPlanPDF
          planData={planData}
          date={new Date().toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US")}
          t={t}
        />,
      ).toBlob();
      saveAs(blob, `Lich_Tap_${new Date().toISOString().slice(0, 10)}.pdf`);
      setHasExported(true);
      toast.success(t("toast_pdf_success"));
    } catch {
      toast.error(t("toast_pdf_error"));
    }
  };

  const [suggestion, setSuggestion] = useState("");
  const [sending, setSending] = useState(false);
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
          "url": "https://htcoachingweb.io.vn/exercises",
          "applicationCategory": "HealthApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "VND"
          },
          "provider": {
            "@type": "Organization",
            "name": "HTCOACHING",
            "url": "https://htcoachingweb.io.vn"
          }
        }}
      />
      <Header />
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white pt-28 pb-8">
        <div className="container-custom">
          {/* Header section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
              <Flame className="text-primary w-6 h-6" />
              <span className="font-semibold text-primary tracking-wide">
                {t("badge")}
              </span>
            </div>
            <h1 className="font-display text-fluid-6xl font-black uppercase tracking-normal">
              <Trans i18nKey="title" ns="exercises" components={[<span className="text-primary" key="0" />]} />
            </h1>
            <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              {t("desc")}
            </p>
          </div>

          {/* Card chính */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Dumbbell className="text-primary w-7 h-7" />
                <h2 className="text-2xl font-bold text-white uppercase">{t("card_title")}</h2>
              </div>
              <button
                onClick={() => logic.setShowExerciseList(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark rounded-full shadow-lg shadow-primary/30 transition"
              >
                <List size={18} /> {t("btn_view_list")}
              </button>
            </div>
            <MuscleGroupSelector
              muscleGroups={[...logic.muscleGroups, ...logic.customGroups]}
              selected={logic.selectedMuscleGroups}
              onToggle={logic.toggleMuscleGroup}
              showCustomGroupModal={logic.showCustomGroupModal}
              setShowCustomGroupModal={logic.setShowCustomGroupModal}
              tempSelectedGroups={logic.tempSelectedGroups}
              setTempSelectedGroups={logic.setTempSelectedGroups}
              handleCreateCustomGroup={logic.handleCreateCustomGroup}
              customGroupName={logic.customGroupName}
              setCustomGroupName={logic.setCustomGroupName}
            />
          </div>

          {/* Các nhóm cơ đã chọn */}
          {logic.selectedMuscleGroups.length > 0 && (
            <ExerciseSections
              selectedMuscleGroups={logic.selectedMuscleGroups}
              workoutData={logic.workoutData}
              handleAddExercise={logic.handleAddExercise}
              handleDeleteExercise={logic.handleDeleteExercise}
              handleExerciseChange={logic.handleExerciseChange}
              exerciseOptions={translatedAllExercises}
              toggleMuscleGroup={logic.toggleMuscleGroup}
              formatDate={logic.formatDate}
              isMobile={logic.isMobile}
              getMuscleGroupById={logic.getMuscleGroupById}
            />
          )}

          {/* Giải thích lịch tập */}
          {logic.selectedMuscleGroups.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 mt-8">
              <div className="flex items-center gap-2 mb-5">
                <Info className="text-primary w-6 h-6" />
                <h3 className="text-xl font-bold text-white">
                  {t("explanation.title")}
                </h3>
              </div>

              <div className="divide-y divide-gray-700/80">
                {workoutExplanations.map((item, idx) => {
                  const keyMap = {
                    "WARM UP": "warmUp",
                    "STRENGTH PREPARATION": "strength",
                    "COMPOUND TRAINING": "compound",
                    "ISOLATION TRAINING": "isolation",
                    "COOLDOWN / STRETCHING": "cooldown"
                  };
                  const descKey = keyMap[item.title];
                  const description = descKey ? t(`explanation.${descKey}`) : item.description;
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-[260px_1fr] gap-x-6 py-4 items-start"
                    >
                      <div className="font-bold text-primary text-base leading-relaxed whitespace-nowrap">
                        {item.title}:
                      </div>

                      <div className="text-gray-300 text-base leading-relaxed">
                        {description}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 mt-3 border-t border-gray-700 space-y-2">
                <p className="text-gray-200 italic text-base">
                  {t("explanation.footer_1")}
                </p>

                <p className="text-yellow-400 text-base italic font-semibold">
                  {t("explanation.footer_2")}
                </p>
              </div>
            </div>
          )}
          {/* Modal danh sách bài tập */}
          <ExerciseListModal
            open={logic.showExerciseList}
            onClose={() => logic.setShowExerciseList(false)}
            exercises={translatedExercises}
            allExercises={translatedAllExercises}
            setFilteredExercises={logic.setFilteredExercises}
          />

          {/* Nút xuất PDF */}
          {logic.selectedMuscleGroups.length > 0 && (
            <div className="flex justify-start mt-8">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-full shadow-lg shadow-green-600/30 transition"
              >
                <FileText size={18} /> {t("btn_export_pdf")}
              </button>
            </div>
          )}

          {/* Góp ý bài tập */}
          {logic.selectedMuscleGroups.length > 0 && (
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <textarea
                rows={2}
                placeholder={t("suggestion.placeholder")}
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                disabled={sending}
                className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleSendSuggestion}
                disabled={sending}
                className="px-6 py-2 bg-primary hover:bg-primary-dark rounded-full text-white font-semibold shadow-lg shadow-primary/30 disabled:opacity-50 flex items-center justify-center gap-2 transition"
              >
                <Send size={16} /> {sending ? t("suggestion.sending") : t("suggestion.send")}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Internal Linking — SEO Hub */}
      <section className="bg-gray-900 py-12 border-t border-gray-800">
        <div className="container-custom">
          <h2 className="text-center text-2xl font-bold text-white uppercase mb-2">
            <Trans i18nKey="explorer.tools_title" ns="exercises" components={[<span className="text-primary" key="0" />]} />
          </h2>
          <p className="text-center text-sm text-gray-400 mb-8">
            {t("explorer.tools_desc")}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              to="/tdee-calculator"
              className="group border border-gray-700 bg-gray-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Flame className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                {t("links.tdee_title")}
              </h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                {t("links.tdee_desc")}
              </p>
            </Link>
            <Link
              to="/mealplan"
              className="group border border-gray-700 bg-gray-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Calendar className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                {t("links.mealplan_title")}
              </h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                {t("links.mealplan_desc")}
              </p>
            </Link>
            <Link
              to="/ket-qua-khach-hang"
              className="group border border-gray-700 bg-gray-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Dumbbell className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                {t("links.stories_title")}
              </h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                {t("links.stories_desc")}
              </p>
            </Link>
          </div>
        </div>
      </section>

      <Contact />
      <ScrollToTop />
      <ChatIcons />
      <Footer />
    </>
  );
};

export default ExercisesPage;
