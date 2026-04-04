import React, { useMemo, useState, useEffect } from "react";
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
import MacroAdjustModal from "./MacroAdjustModal";
import FoodSelectorModal from "../../pages/MealPlan/FoodSelectorModal";
import { useMacroSet } from "../../hooks/useMacroSet";
import { useFoodDatabase } from "../../hooks/useFoodDatabase";
import { useMealGenerator } from "../../hooks/useMealGenerator";
import Header from "../../sections/Header/Header";
import ChatIcons from "../../components/ChatIcons";

const MealPlan = () => {
  const [selectedPlan, setSelectedPlan] = useState(3);
  const { macroSet, selectedMacroPlan, setSelectedMacroPlan } = useMacroSet();
  const { foodDatabase, isLoadingFoods } = useFoodDatabase();

  const [activeTab, setActiveTab] = useState("menu");
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState(null);

  const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
  const [customMacroTarget, setCustomMacroTarget] = useState(null);

  // Đợi macroSet load xong
  const [isMacroReady, setIsMacroReady] = useState(false);
  useEffect(() => {
    if (macroSet !== null && !isMacroReady) {
      setIsMacroReady(true);
    }
  }, [macroSet, isMacroReady]);

  // Xác định macro đang active (ưu tiên custom, nếu không thì lấy từ chế độ đã chọn)
  const baseMacroTarget =
    selectedMacroPlan && macroSet ? macroSet[selectedMacroPlan] : null;
  const activeMacroTarget = customMacroTarget || baseMacroTarget;

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

  // Khi đổi chế độ, xóa custom macro
  useEffect(() => {
    setCustomMacroTarget(null);
  }, [selectedMacroPlan]);

  const { generateMeals, meals, totalMacros, totalCalories, isGenerating } =
    useMealGenerator({
      selectedPlan,
      targetMacros: activeMacroTarget,
      foodDatabase,
      customFoods: selectedFoods,
    });

  // Giá trị hiển thị trong modal tinh chỉnh macro
  const modalInitialValues = useMemo(() => {
    if (meals.length > 0) {
      return {
        protein: totalMacros.protein,
        carb: totalMacros.carb,
        fat: totalMacros.fat,
        calories: totalCalories,
      };
    }
    return (
      activeMacroTarget || {
        protein: 0,
        carb: 0,
        fat: 0,
        calories: 0,
      }
    );
  }, [meals.length, totalMacros, totalCalories, activeMacroTarget]);

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
    // Trường hợp 1: đã có custom macro (từ tinh chỉnh)
    if (customMacroTarget) {
      generateMeals(customMacroTarget);
      return;
    }
    // Trường hợp 2: đã chọn chế độ dinh dưỡng và macroSet đã sẵn sàng
    if (selectedMacroPlan && macroSet && macroSet[selectedMacroPlan]) {
      generateMeals(macroSet[selectedMacroPlan]);
      return;
    }
    // Trường hợp 3: chưa có macro hợp lệ
    if (!macroSet || !isMacroReady) {
      toast.info("⏳ Đang tải dữ liệu macro, vui lòng chờ...");
      return;
    }
    toast.error(
      "❌ Vui lòng chọn chế độ dinh dưỡng hoặc tinh chỉnh macro trước",
    );
  };

  // Xử lý lưu macro tinh chỉnh
  const handleSaveCustomMacroTarget = (nextTarget) => {
    setCustomMacroTarget(nextTarget);
    // Nếu đã có thực đơn, tạo lại ngay; nếu chưa, chỉ lưu target
    if (meals.length > 0) {
      generateMeals(nextTarget);
    } else {
      toast.success(
        "✅ Đã lưu macro mục tiêu, hãy nhấn 'Gợi ý thực đơn' để tạo",
      );
    }
  };

  const hasMeals = meals.length > 0;
  const buttonLabel = hasMeals
    ? "🔄 Đổi thực đơn khác"
    : "✨ Gợi ý thực đơn mẫu";

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
        <ToastContainer position="top-right" autoClose={3000} theme="dark" />

        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-orange-500/20 rounded-full px-4 sm:px-5 py-1.5 sm:py-2 mb-4 mt-20">
              <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
              <span className="font-semibold text-orange-400 tracking-wide text-sm sm:text-base">
                MEAL PLAN
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter">
              THỰC ĐƠN <span className="text-orange-500">CỦA BẠN</span>
            </h2>

            <div className="w-20 sm:w-24 h-1 bg-orange-500 mx-auto mt-3 sm:mt-4 rounded-full"></div>
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
              <span className="text-orange-400 font-semibold">
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
                className={`py-2 px-1 font-semibold text-sm transition-all ${
                  activeTab === "menu"
                    ? "border-b-2 border-orange-500 text-orange-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                📋 Thực đơn
              </button>

              <button
                onClick={() => setActiveTab("nutrition")}
                className={`py-2 px-1 font-semibold text-sm transition-all flex items-center gap-1 ${
                  activeTab === "nutrition"
                    ? "border-b-2 border-orange-500 text-orange-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Database className="w-4 h-4" /> Dinh dưỡng
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
                      targetLabel={
                        customMacroTarget
                          ? "Mục tiêu đã tinh chỉnh"
                          : selectedMacroPlan
                      }
                      onOpenMacroModal={() => setIsMacroModalOpen(true)}
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

        <MacroAdjustModal
          isOpen={isMacroModalOpen}
          onClose={() => setIsMacroModalOpen(false)}
          initialValues={modalInitialValues}
          onSave={handleSaveCustomMacroTarget}
        />
      </div>
      <ChatIcons />
    </>
  );
};

export default MealPlan;
