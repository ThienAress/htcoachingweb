import { useMemo, useState } from "react";
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
import SavedMealPlans from "./SavedMealPlans";
import MealPlanConditions from "./MealPlanConditions";
import MealPlanPreferenceConfirmDialog from "./MealPlanPreferenceConfirmDialog";
import { TODAY_PLATFORM_ENABLED } from "../../config/featureFlags";
import {
  hasUsedGuestMealPlanPreview,
  markGuestMealPlanPreviewUsed,
} from "../../utils/publicJourney";
import { useMealPlanPreferences } from "../../hooks/useMealPlanPreferences";
import {
  EMPTY_MEAL_PLAN_PREFERENCES,
  filterFoodsForMealPlan,
  hasMealPlanFoodCoverage,
  isMealPlanAllergyLocked,
  isMealPlanPreferenceConfirmed,
  validateMealPlanPreferences,
} from "../../utils/mealPlanConstraints";
import {
  clearGuestMealPlanPreferences,
  loadGuestMealPlanPreferences,
  saveGuestMealPlanPreferences,
} from "../../utils/mealPlanPreferenceSession";

const loadSelectedFoods = () => {
  try {
    const saved = globalThis.localStorage?.getItem("selectedFoods");
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
};

const MealPlan = () => {
  const { t } = useTranslation("mealplan");
  const [selectedPlan, setSelectedPlan] = useState(3);
  const { macroSet, selectedMacroPlan, setSelectedMacroPlan } = useMacroSet();
  const {
    foodDatabase,
    isLoadingFoods,
    isErrorFoods,
    retryFoods,
  } = useFoodDatabase();

  const [activeTab, setActiveTab] = useState("menu");
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState(loadSelectedFoods);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [preferenceConfirmationAction, setPreferenceConfirmationAction] =
    useState(null);
  const [guestConfirmedPreferences, setGuestConfirmedPreferences] = useState(
    loadGuestMealPlanPreferences,
  );
  const [guestPreviewUsed, setGuestPreviewUsed] = useState(
    hasUsedGuestMealPlanPreview,
  );

  const { user, loading: authLoading } = useAuth();
  const preferenceQuery = useMealPlanPreferences(user?._id);
  const [preferenceDraft, setPreferenceDraft] = useState(null);
  const { accessLevel, isChecking, accessError, retryAccess, canGenerate, remainingGenerations, recordGeneration, maxGenerations } = useMealPlanAccess();
  const preferenceOwnerKey = user?._id || "guest";
  const storedPreferences = useMemo(
    () =>
      preferenceQuery.preferences
        ? {
            allergyStatus: preferenceQuery.preferences.allergyStatus,
            allergens: preferenceQuery.preferences.allergens || [],
            otherAllergenText:
              preferenceQuery.preferences.otherAllergenText || "",
            budgetVndPerDay: null,
          }
        : EMPTY_MEAL_PLAN_PREFERENCES,
    [preferenceQuery.preferences],
  );
  const hasCurrentDraft = preferenceDraft?.ownerKey === preferenceOwnerKey;
  const mealPlanPreferences = useMemo(
    () =>
      hasCurrentDraft
        ? preferenceDraft.value
        : user
          ? storedPreferences
          : guestConfirmedPreferences || EMPTY_MEAL_PLAN_PREFERENCES,
    [
      guestConfirmedPreferences,
      hasCurrentDraft,
      preferenceDraft,
      storedPreferences,
      user,
    ],
  );
  const preferencesDirty = Boolean(hasCurrentDraft);
  const confirmedPreferences = user
    ? preferenceQuery.preferences
    : guestConfirmedPreferences;
  const isPreferenceConfirmed = isMealPlanPreferenceConfirmed(
    confirmedPreferences,
  );
  const isAllergySafetyLocked = isMealPlanAllergyLocked(mealPlanPreferences);
  const areMealPlanActionsLocked =
    isAllergySafetyLocked || !isPreferenceConfirmed;

  // Đợi macroSet load xong
  const isMacroReady = macroSet !== null;

  // Xác định macro đang active từ chế độ đã chọn
  const activeMacroTarget =
    selectedMacroPlan && macroSet ? macroSet[selectedMacroPlan] : null;
  const constrainedFoodDatabase = useMemo(
    () => filterFoodsForMealPlan(foodDatabase, mealPlanPreferences),
    [foodDatabase, mealPlanPreferences],
  );

  // Khôi phục danh sách thực phẩm yêu thích từ localStorage
  const { generateMeals, meals, totalMacros, totalCalories, isGenerating } =
    useMealGenerator({
      selectedPlan,
      targetMacros: activeMacroTarget,
      foodDatabase: constrainedFoodDatabase,
      customFoods: user ? selectedFoods : null,
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
    if (areMealPlanActionsLocked) return;
    if (selectedMacroPlan && macroSet && macroSet[selectedMacroPlan]) {
      if (user && preferenceQuery.isLoading) {
        toast.info("Đang tải điều kiện thực đơn đã lưu.");
        return;
      }
      if (user && preferenceQuery.isError) {
        toast.error("Không thể tải điều kiện thực đơn. Vui lòng thử lại.");
        return;
      }
      const preferenceValidation = validateMealPlanPreferences(
        mealPlanPreferences,
        foodDatabase,
      );
      if (!preferenceValidation.valid) {
        const messages = {
          missing: "Vui lòng xác nhận trạng thái dị ứng trước khi tạo thực đơn.",
          unsure:
            "Khi chưa chắc về dị ứng, hãy kiểm tra nhãn hoặc trao đổi với chuyên gia trước khi tạo.",
          allergens: "Vui lòng chọn ít nhất một nhóm dị ứng cần loại trừ.",
          other:
            "Dị ứng ở mục Khác đã được lưu để bạn theo dõi, nhưng hệ thống chưa thể tự động loại trừ chính xác. Vui lòng trao đổi với bác sĩ/chuyên gia trước khi tạo thực đơn.",
          period_separator:
            "Không dùng dấu chấm giữa các thực phẩm. Hãy dùng dấu phẩy hoặc khoảng trắng.",
          too_many: "Chỉ nhập tối đa 8 thực phẩm ở mục Khác.",
          generic_meat:
            "Vui lòng nhập rõ loại thịt dị ứng, ví dụ: gà, bò hoặc heo.",
          budget: "Dữ liệu ngân sách đã lưu không hợp lệ.",
        };
        toast.error(messages[preferenceValidation.code]);
        return;
      }
      if (!foodDatabase?.length) {
        toast.info(t("toast.loading_foods"));
        return;
      }
      if (!hasMealPlanFoodCoverage(constrainedFoodDatabase)) {
        toast.error(
          "Sau khi loại thực phẩm dị ứng, dữ liệu còn lại chưa đủ nhóm đạm, tinh bột và chất béo để tạo thực đơn. Không có lượt nào bị trừ.",
          { autoClose: 6000 },
        );
        return;
      }

      if (!user) {
        if (guestPreviewUsed) {
          setShowLoginModal(true);
          return;
        }

        generateMeals(macroSet[selectedMacroPlan]);
        markGuestMealPlanPreviewUsed();
        setGuestPreviewUsed(true);
        return;
      }

      if (isChecking) {
        toast.info(t("toast.loading_macros"));
        return;
      }
      if (accessError) {
        toast.error(t("toast.access_error"));
        return;
      }
      if (!canGenerate) {
        toast.error(t("toast.no_remaining", { max: maxGenerations }), {
          autoClose: 5000,
        });
        return;
      }

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

  const handlePreferenceChange = (nextPreferences) => {
    setPreferenceDraft({
      ownerKey: preferenceOwnerKey,
      value: nextPreferences,
    });
  };

  const handleSavePreferences = async () => {
    if (isAllergySafetyLocked) return;
    const validation = validateMealPlanPreferences(
      mealPlanPreferences,
      foodDatabase,
    );
    if (!validation.valid) {
      const messages = {
        missing: "Vui lòng xác nhận trạng thái dị ứng trước khi lưu.",
        allergens: "Vui lòng chọn ít nhất một thực phẩm dị ứng.",
        other:
          "Thực phẩm ở mục Khác chưa có trong hệ thống nên chưa thể lưu điều kiện chính xác.",
        period_separator:
          "Không dùng dấu chấm giữa các thực phẩm. Hãy dùng dấu phẩy hoặc khoảng trắng.",
        too_many: "Chỉ nhập tối đa 8 thực phẩm ở mục Khác.",
        generic_meat:
          "Vui lòng nhập rõ loại thịt dị ứng, ví dụ: gà, bò hoặc heo.",
        budget: "Dữ liệu điều kiện đã lưu không hợp lệ.",
      };
      toast.error(messages[validation.code]);
      return;
    }
    setPreferenceConfirmationAction("save");
  };

  const handleClearPreferences = () => {
    if (!isPreferenceConfirmed) return;
    setPreferenceConfirmationAction("clear");
  };

  const handleConfirmPreferenceAction = async () => {
    if (preferenceConfirmationAction === "save") {
      if (user) {
        try {
          await preferenceQuery.save(mealPlanPreferences);
          toast.success("Đã lưu và khóa điều kiện thực đơn trong tài khoản.");
        } catch {
          toast.error("Không thể lưu điều kiện thực đơn.");
          return;
        }
      } else {
        saveGuestMealPlanPreferences(mealPlanPreferences);
        setGuestConfirmedPreferences({ ...mealPlanPreferences });
        toast.success("Đã xác nhận điều kiện cho phiên hiện tại.");
      }
      setPreferenceDraft(null);
      setPreferenceConfirmationAction(null);
      return;
    }

    if (preferenceConfirmationAction === "clear") {
      if (user) {
        try {
          await preferenceQuery.clear();
          toast.success("Đã bỏ lưu điều kiện thực đơn.");
        } catch {
          toast.error("Không thể bỏ lưu điều kiện thực đơn.");
          return;
        }
      } else {
        clearGuestMealPlanPreferences();
        setGuestConfirmedPreferences(null);
        toast.success("Đã xóa điều kiện trong phiên hiện tại.");
      }
      setPreferenceDraft(null);
      setPreferenceConfirmationAction(null);
    }
  };

  const hasMeals = meals.length > 0;
  const buttonLabel =
    !user && guestPreviewUsed
      ? t("btn_login_to_regenerate")
      : hasMeals
        ? t("btn_regenerate")
        : t("btn_generate");

  const handleOpenFavorites = () => {
    if (areMealPlanActionsLocked) return;
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setIsFoodModalOpen(true);
  };

  const handleSelectTab = (tab) => {
    if (tab === "custom" && !user) {
      setShowLoginModal(true);
      return;
    }
    setActiveTab(tab);
  };

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
    "url": "https://htcoachingweb.io.vn/mealplan/",
    "description": t("seo_desc"),
    "applicationCategory": "HealthApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "VND" },
    "provider": { "@type": "Organization", "name": "HTCOACHING", "url": "https://htcoachingweb.io.vn/" }
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

          <MealPlanConditions
            preferences={mealPlanPreferences}
            savedPreferences={preferenceQuery.preferences || null}
            foodDatabase={foodDatabase}
            onChange={handlePreferenceChange}
            isAuthenticated={Boolean(user)}
            isLoading={Boolean(user) && preferenceQuery.isLoading}
            isError={Boolean(user) && preferenceQuery.isError}
            onRetry={preferenceQuery.retry}
            onSave={handleSavePreferences}
            onClear={handleClearPreferences}
            isSaving={Boolean(user) && preferenceQuery.isSaving}
            isClearing={Boolean(user) && preferenceQuery.isClearing}
            isDirty={preferencesDirty}
            isConfirmed={isPreferenceConfirmed}
          />

          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mb-4">
            <MealButton
              onGenerate={handleGenerateMeal}
              isGenerating={isGenerating}
              disabled={
                areMealPlanActionsLocked ||
                !isMacroReady ||
                isLoadingFoods ||
                (Boolean(user) && (isChecking || accessError))
              }
              label={buttonLabel}
            />

            <button
              type="button"
              onClick={handleOpenFavorites}
              disabled={areMealPlanActionsLocked}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gray-700 px-5 py-2.5 font-medium text-white transition-colors hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 disabled:opacity-60 sm:w-auto"
            >
              <Heart className="w-4 h-4" /> {t("btn_select_favorites")}
            </button>

            {user && selectedFoods && (
              <button
                onClick={handleResetSelectedFoods}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-900/50 hover:bg-red-800/50 rounded-full text-red-300 font-medium transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> {t("btn_reset")}
              </button>
            )}
          </div>

          {!user && guestPreviewUsed && (
            <div
              className="mx-auto mb-6 max-w-2xl rounded-xl border border-primary/30 bg-primary/10 p-4 text-center"
              role="status"
            >
              <p className="font-bold text-white">{t("guest_preview.title")}</p>
              <p className="mt-1 text-sm leading-6 text-gray-300">
                {t("guest_preview.description")}
              </p>
              <button
                className="mt-3 min-h-11 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                onClick={() => setShowLoginModal(true)}
                type="button"
              >
                {t("guest_preview.cta")}
              </button>
            </div>
          )}

          {user && accessError && (
            <div className="mx-auto mb-6 max-w-lg rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
              <p>Không thể xác minh lượt tạo thực đơn hiện tại.</p>
              <button
                type="button"
                onClick={() => retryAccess()}
                className="mt-2 min-h-11 rounded-md px-3 py-2 font-semibold hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                Thử tải lại
              </button>
            </div>
          )}

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
                onClick={() => handleSelectTab("menu")}
                className={`py-2 px-1 font-semibold text-sm transition-all flex items-center gap-1 ${activeTab === "menu"
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                {t("tab_menu")}
              </button>

              <button
                onClick={() => handleSelectTab("custom")}
                className={`py-2 px-1 font-semibold text-sm transition-all flex items-center gap-1 ${activeTab === "custom"
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                {t("tab_custom")}
              </button>

              <button
                onClick={() => handleSelectTab("nutrition")}
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
                {user && TODAY_PLATFORM_ENABLED && (
                  <SavedMealPlans
                    meals={meals}
                    target={activeMacroTarget}
                    targetLabel={selectedMacroPlan}
                  />
                )}
              </>
            ) : activeTab === "custom" ? (
              <CustomMealBuilder
                key={`${user?._id || "guest"}:${selectedPlan}`}
                foodDatabase={constrainedFoodDatabase}
                isFoodDatabaseLoading={isLoadingFoods}
                isFoodDatabaseError={isErrorFoods}
                onRetryFoodDatabase={retryFoods}
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
          foodDatabase={constrainedFoodDatabase}
        />
        <MealPlanPreferenceConfirmDialog
          action={preferenceConfirmationAction}
          isPending={Boolean(user) && preferenceQuery.isMutating}
          onCancel={() => setPreferenceConfirmationAction(null)}
          onConfirm={handleConfirmPreferenceAction}
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
              to="/tdee-calculator/"
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
              to="/exercises/"
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
              to="/ket-qua-khach-hang/"
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
