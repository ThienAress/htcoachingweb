import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";
import { Utensils, Heart, Database, RefreshCw, BarChart3, Dumbbell, Trophy } from "lucide-react";

import MealSelector from "./MealSelector";
import MealButton from "./MealButton";
import MealTable from "./MealTable";
import MealSummary from "./MealSummary";
import NutritionLegend from "./NutritionLegend";
import FoodNutritionTable from "./FoodNutritionTable";
import FoodSelectorModal from "./FoodSelectorModal";
import CustomMealBuilder from "./CustomMealBuilder";

import { useMacroSet } from "../../hooks/useMacroSet";
import { useFoodDatabase } from "../../hooks/useFoodDatabase";
import { useMealGenerator } from "../../hooks/useMealGenerator";
import Header from "../../sections/Header/Header";
import ChatIcons from "../../components/ChatIcons";
import SEO from "../../components/SEO";
import { useMealPlanAccess } from "../../hooks/useMealPlanAccess";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import LoginModal from "./LoginModal";

const MealPlan = () => {
  const { t } = useTranslation("mealplan");
  const [selectedPlan, setSelectedPlan] = useState(3);
  const { macroSet, selectedMacroPlan, setSelectedMacroPlan } = useMacroSet();
  const { foodDatabase, isLoadingFoods } = useFoodDatabase();

  const [activeTab, setActiveTab] = useState("menu");
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { accessLevel, isChecking, canGenerate, remainingGenerations, recordGeneration, maxGenerations } = useMealPlanAccess();

  // Đợi macroSet load xong
  const [isMacroReady, setIsMacroReady] = useState(false);
  useEffect(() => {
    if (macroSet !== null && !isMacroReady) {
      setIsMacroReady(true);
    }
  }, [macroSet, isMacroReady]);

  // Xác định macro đang active từ chế độ đã chọn
  const activeMacroTarget =
    selectedMacroPlan && macroSet ? macroSet[selectedMacroPlan] : null;

  // Khôi phục danh sách thực phẩm yêu thích từ localStorage
  useEffect(() => {
    const saved = localStorage.getItem("selectedFoods");
    if (saved) {
      try {
        setSelectedFoods(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse selectedFoods", e);
      }
    }
  }, []);

  const { generateMeals, meals, totalMacros, totalCalories, isGenerating } =
    useMealGenerator({
      selectedPlan,
      targetMacros: activeMacroTarget,
      foodDatabase,
      customFoods: selectedFoods,
    });



  // Lưu danh sách món yêu thích
  const handleSaveSelectedFoods = (selected) => {
    setSelectedFoods(selected);
    localStorage.setItem("selectedFoods", JSON.stringify(selected));
    setIsFoodModalOpen(false);
    toast.success(t("toast.save_success"));
  };

  const handleResetSelectedFoods = () => {
    setSelectedFoods(null);
    localStorage.removeItem("selectedFoods");
    toast.info(t("toast.reset_info"));
  };

  // Xử lý tạo thực đơn (gợi ý)
  const handleGenerateMeal = async () => {
    // Guest chưa login → hiện LoginModal
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    // Kiểm tra giới hạn lượt cho trial users
    if (!canGenerate) {
      toast.error(
        t("toast.no_remaining", { max: maxGenerations }),
        { autoClose: 5000 }
      );
      return;
    }

    if (selectedMacroPlan && macroSet && macroSet[selectedMacroPlan]) {
      // Ghi nhận lượt lên server trước
      const recorded = await recordGeneration();
      if ((!recorded) && accessLevel === "trial") {
        toast.error(t("toast.no_remaining_simple"));
        return;
      }
      generateMeals(macroSet[selectedMacroPlan]);
      return;
    }
    if (!macroSet || !isMacroReady) {
      toast.info(t("toast.loading_macros"));
      return;
    }
    toast.error(t("toast.select_plan_first"));
  };

  const hasMeals = meals.length > 0;
  const buttonLabel = hasMeals ? t("btn_regenerate") : t("btn_generate");

  // Loading states (chỉ chờ auth, không block nếu chưa login)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const mealplanSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": t("seo_title"),
    "url": "https://htcoachingweb.io.vn/mealplan",
    "description": t("seo_desc"),
    "applicationCategory": "HealthApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "VND" },
    "provider": { "@type": "Organization", "name": "HTCOACHING", "url": "https://htcoachingweb.io.vn" }
  };

  return (
    <>
      <SEO
        title={t("seo_title")}
        description={t("seo_desc")}
        canonical="/mealplan"
        jsonLd={mealplanSchema}
      />
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <ToastContainer position="top-right" autoClose={3000} theme="dark" />

        <div className="container-custom py-6 sm:py-8">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-primary/20 rounded-full px-4 sm:px-5 py-1.5 sm:py-2 mb-4 mt-20">
              <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="font-semibold text-primary tracking-wide text-fluid-sm">
                MEAL PLAN
              </span>
            </div>

            <h1 className="text-fluid-3xl font-black uppercase tracking-normal">
              <Trans i18nKey="title" ns="mealplan" components={[<span className="text-primary" key="0" />]} />
            </h1>

            <div className="w-20 sm:w-24 h-1 bg-primary mx-auto mt-3 sm:mt-4 rounded-full"></div>
          </div>

          <MealSelector
            selectedPlan={selectedPlan}
            setSelectedPlan={setSelectedPlan}
            macroSet={macroSet}
            selectedMacroPlan={selectedMacroPlan}
            setSelectedMacroPlan={setSelectedMacroPlan}
          />

          {activeMacroTarget && (
            <div className="mb-6 text-center text-sm text-gray-300">
              {t("active_target")}{" "}
              <span className="text-red-400 font-semibold">
                P {activeMacroTarget.protein}g
              </span>{" "}
              |{" "}
              <span className="text-green-400 font-semibold">
                C {activeMacroTarget.carb}g
              </span>{" "}
              |{" "}
              <span className="text-yellow-400 font-semibold">
                F {activeMacroTarget.fat}g
              </span>{" "}
              |{" "}
              <span className="text-primary font-semibold">
                {activeMacroTarget.calories} kcal
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mb-4">
            <MealButton
              onGenerate={handleGenerateMeal}
              isGenerating={isGenerating}
              disabled={!isMacroReady || isLoadingFoods}
              label={buttonLabel}
            />

            <button
              onClick={() => setIsFoodModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-full text-white font-medium transition flex items-center justify-center gap-2"
            >
              <Heart className="w-4 h-4" /> {t("btn_select_favorites")}
            </button>

            {selectedFoods && (
              <button
                onClick={handleResetSelectedFoods}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-900/50 hover:bg-red-800/50 rounded-full text-red-300 font-medium transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> {t("btn_reset")}
              </button>
            )}
          </div>

          {/* Thông báo giới hạn lượt cho trial users */}
          {accessLevel === "trial" && (
            <div className={`flex items-center justify-center gap-2 text-sm mb-6 py-2.5 px-4 rounded-lg mx-auto max-w-lg ${
              canGenerate
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              {canGenerate ? (
                <Trans 
                  i18nKey="trial_remaining" 
                  ns="mealplan"
                  values={{ remaining: remainingGenerations, max: maxGenerations }} 
                  components={[<strong key="0" />]} 
                />
              ) : (
                <Trans 
                  i18nKey="trial_expired" 
                  ns="mealplan"
                  components={[
                    <Link to="/" className="underline font-semibold hover:text-red-300" key="0" />
                  ]} 
                />
              )}
            </div>
          )}

          <div className="border-b border-gray-700 mb-6">
            <div className="flex justify-center sm:justify-start gap-4 sm:gap-6">
              <button
                onClick={() => setActiveTab("menu")}
                className={`py-2 px-1 font-semibold text-sm transition-all flex items-center gap-1 ${activeTab === "menu"
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                {t("tab_menu")}
              </button>

              <button
                onClick={() => setActiveTab("custom")}
                className={`py-2 px-1 font-semibold text-sm transition-all flex items-center gap-1 ${activeTab === "custom"
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                {t("tab_custom")}
              </button>

              <button
                onClick={() => setActiveTab("nutrition")}
                className={`py-2 px-1 font-semibold text-sm transition-all flex items-center gap-1 ${activeTab === "nutrition"
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                <Database className="w-4 h-4" /> {t("tab_nutrition")}
              </button>
            </div>
          </div>

          <div>
            {activeTab === "menu" ? (
              <>
                <MealTable meals={meals} />

                {meals.length > 0 && (
                  <>
                    <NutritionLegend />
                    <MealSummary
                      totalMacros={totalMacros}
                      totalCalories={totalCalories}
                      targetMacros={activeMacroTarget}
                      targetLabel={selectedMacroPlan}
                    />
                  </>
                )}
              </>
            ) : activeTab === "custom" ? (
              <CustomMealBuilder 
                foodDatabase={foodDatabase}
                targetMacros={activeMacroTarget}
                targetLabel={selectedMacroPlan}
                selectedPlan={selectedPlan}
              />
            ) : (
              <FoodNutritionTable foodDatabase={foodDatabase} canViewFull={accessLevel === "unlimited" || canGenerate} />
            )}
          </div>
        </div>

        <FoodSelectorModal
          isOpen={isFoodModalOpen}
          onClose={() => setIsFoodModalOpen(false)}
          onSave={handleSaveSelectedFoods}
          initialSelected={selectedFoods}
          foodDatabase={foodDatabase}
        />
      </main>

      {/* Internal Linking — SEO Hub */}
      <section className="bg-gray-900 py-12 border-t border-gray-800">
        <div className="container-custom">
          <h2 className="text-center text-2xl font-bold text-white uppercase mb-2">
            <Trans i18nKey="explorer.tools_title" ns="mealplan" components={[<span className="text-primary" key="0" />]} />
          </h2>
          <p className="text-center text-sm text-gray-400 mb-8">
            {t("explorer.tools_desc")}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              to="/tdee-calculator"
              className="group border border-gray-700 bg-gray-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <BarChart3 className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                {t("links.tdee_title")}
              </h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                {t("links.tdee_desc")}
              </p>
            </Link>
            <Link
              to="/exercises"
              className="group border border-gray-700 bg-gray-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Dumbbell className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-white group-hover:text-primary transition">
                {t("links.exercises_title")}
              </h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                {t("links.exercises_desc")}
              </p>
            </Link>
            <Link
              to="/ket-qua-khach-hang"
              className="group border border-gray-700 bg-gray-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <Trophy className="h-6 w-6 text-primary mb-3" />
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

      <ChatIcons />
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  );
};

export default MealPlan;
