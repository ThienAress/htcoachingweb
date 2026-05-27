import { useState, useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { toast } from "react-toastify";
import { Utensils, Heart, Database, RefreshCw } from "lucide-react";

import MealSelector from "./MealSelector";
import MealButton from "./MealButton";
import MealTable from "./MealTable";
import MealSummary from "./MealSummary";
import NutritionLegend from "./NutritionLegend";
import FoodNutritionTable from "./FoodNutritionTable";
import FoodSelectorModal from "./FoodSelectorModal";

import { useMacroSet } from "../../hooks/useMacroSet";
import { useFoodDatabase } from "../../hooks/useFoodDatabase";
import { useMealGenerator } from "../../hooks/useMealGenerator";
import Header from "../../sections/Header/Header";
import ChatIcons from "../../components/ChatIcons";
import SEO from "../../components/SEO";
import { useMealPlanAccess } from "../../hooks/useMealPlanAccess";
import { useAuth } from "../../context/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { Lock, Clock } from "lucide-react";

const MealPlan = () => {
  const [selectedPlan, setSelectedPlan] = useState(3);
  const { macroSet, selectedMacroPlan, setSelectedMacroPlan } = useMacroSet();
  const { foodDatabase, isLoadingFoods } = useFoodDatabase();

  const [activeTab, setActiveTab] = useState("menu");
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState(null);

  const { user, loading: authLoading } = useAuth();
  const { accessLevel, isChecking, isBlocked, remainingTime } = useMealPlanAccess();

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
    toast.success("✅ Đã lưu danh sách thực phẩm yêu thích");
  };

  const handleResetSelectedFoods = () => {
    setSelectedFoods(null);
    localStorage.removeItem("selectedFoods");
    toast.info("🔄 Đã reset danh sách thực phẩm");
  };

  // Xử lý tạo thực đơn (gợi ý)
  const handleGenerateMeal = () => {
    if (selectedMacroPlan && macroSet && macroSet[selectedMacroPlan]) {
      generateMeals(macroSet[selectedMacroPlan]);
      return;
    }
    if (!macroSet || !isMacroReady) {
      toast.info("⏳ Đang tải dữ liệu macro, vui lòng chờ...");
      return;
    }
    toast.error("❌ Vui lòng chọn chế độ dinh dưỡng trước");
  };

  const hasMeals = meals.length > 0;
  const buttonLabel = hasMeals ? "Đổi thực đơn khác" : "Gợi ý thực đơn mẫu";

  // Loading states
  if (authLoading || isChecking) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Blocked state
  if (isBlocked) {
    return (
      <>
        <SEO title="Giới hạn truy cập" noindex />
        <Header />
        <main className="min-h-screen bg-gray-900 flex items-center justify-center px-4 pt-20">
          <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl p-8 text-center border border-gray-700">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Đã hết thời gian truy cập</h2>
            <p className="text-gray-300 mb-6">
              Phiên sử dụng thử của bạn đã kết thúc. Để tiếp tục sử dụng tính năng này không giới hạn, vui lòng đăng ký gói dịch vụ hoặc gói tập của chúng tôi.
            </p>
            {remainingTime && (
              <div className="flex items-center justify-center gap-2 text-yellow-500 font-medium mb-8 bg-yellow-500/10 py-3 rounded-lg border border-yellow-500/20">
                <Clock className="w-5 h-5" />
                <span>Thử lại sau: {remainingTime}</span>
              </div>
            )}
            <div className="space-y-3">
              <Link to="/club" className="block w-full py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-colors">
                Xem các gói dịch vụ
              </Link>
              <Link to="/" className="block w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors">
                Về trang chủ
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Gợi ý thực đơn cá nhân hóa"
        description="Thực đơn giảm mỡ, tăng cơ tự động dựa trên TDEE và Macros của bạn. Xây dựng chế độ ăn chuẩn khoa học cùng HTCOACHING."
        canonical="/mealplan"
      />
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <ToastContainer position="top-right" autoClose={3000} theme="dark" />

        <div className="container-custom py-6 sm:py-8">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-primary/20 rounded-full px-4 sm:px-5 py-1.5 sm:py-2 mb-4 mt-20">
              <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <span className="font-semibold text-primary tracking-wide text-sm sm:text-base">
                MEAL PLAN
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-normal">
              THỰC ĐƠN <span className="text-primary">CỦA BẠN</span>
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
              Target đang dùng:{" "}
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

          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 mb-8">
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
              <Heart className="w-4 h-4" /> Chọn món yêu thích
            </button>

            {selectedFoods && (
              <button
                onClick={handleResetSelectedFoods}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-900/50 hover:bg-red-800/50 rounded-full text-red-300 font-medium transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Reset
              </button>
            )}
          </div>


          <div className="border-b border-gray-700 mb-6">
            <div className="flex justify-center sm:justify-start gap-4 sm:gap-6">
              <button
                onClick={() => setActiveTab("menu")}
                className={`py-2 px-1 font-semibold text-sm transition-all ${activeTab === "menu"
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                📋 Thực đơn
              </button>

              <button
                onClick={() => setActiveTab("nutrition")}
                className={`py-2 px-1 font-semibold text-sm transition-all flex items-center gap-1 ${activeTab === "nutrition"
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                <Database className="w-4 h-4" /> Bảng Dinh dưỡng Thực Phẩm
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
            ) : (
              <FoodNutritionTable foodDatabase={foodDatabase} />
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
      <ChatIcons />
    </>
  );
};

export default MealPlan;
