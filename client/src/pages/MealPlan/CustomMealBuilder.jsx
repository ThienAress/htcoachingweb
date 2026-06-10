import React, { useState, useEffect, useMemo, useRef } from "react";
import { Wheat, Drumstick, Fish, Plus, X, Search, Crown, Save, PlusCircle } from "lucide-react";
import MealSummary from "./MealSummary";
import NutritionLegend from "./NutritionLegend";
import { toast } from "react-toastify";
import { useMealPlanAccess } from "../../hooks/useMealPlanAccess";

const round1 = (num) => Math.round(num * 10) / 10;
const calcCalories = (p, c, f) => round1(p * 4 + c * 4 + f * 9);

export default function CustomMealBuilder({
  foodDatabase,
  targetMacros,
  targetLabel,
  selectedPlan,
}) {
  const { accessLevel, canGenerate, recordGeneration } = useMealPlanAccess();
  
  // State for meals
  const [meals, setMeals] = useState([]);
  const [hasRecorded, setHasRecorded] = useState(false);

  // Initialize or adjust meals based on selectedPlan
  useEffect(() => {
    setMeals((prev) => {
      const saved = localStorage.getItem("customMealBuilder");
      if (saved && prev.length === 0) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) {
            return parsed.map(meal => ({
              ...meal,
              carbFood: Array.isArray(meal.carbFood) ? meal.carbFood : (meal.carbFood ? [meal.carbFood] : []),
              proteinFood: Array.isArray(meal.proteinFood) ? meal.proteinFood : (meal.proteinFood ? [meal.proteinFood] : []),
              fatFood: Array.isArray(meal.fatFood) ? meal.fatFood : (meal.fatFood ? [meal.fatFood] : []),
            }));
          }
        } catch (e) {}
      }

      if (prev.length === selectedPlan) return prev;
      
      const newMeals = [...prev];
      if (newMeals.length < selectedPlan) {
        for (let i = newMeals.length; i < selectedPlan; i++) {
          newMeals.push({
            id: `meal-${Date.now()}-${i}`,
            mealName: `Bữa ${i + 1}`,
            carbFood: [],
            proteinFood: [],
            fatFood: [],
          });
        }
      } else {
        return newMeals.slice(0, selectedPlan);
      }
      return newMeals;
    });
  }, [selectedPlan]);

  // Save to localStorage
  useEffect(() => {
    if (meals.length > 0) {
      localStorage.setItem("customMealBuilder", JSON.stringify(meals));
    }
  }, [meals]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState(null); // { mealIndex, type: 'carbFood' | 'proteinFood' | 'fatFood' }
  const [searchQuery, setSearchQuery] = useState("");
  const [customFood, setCustomFood] = useState({ name: "", protein: "", carb: "", fat: "" });
  const [isCustomMode, setIsCustomMode] = useState(false);

  const getFoodDisplayMacros = (food) => {
    if (!food) return null;
    const amount = Number(food.amount || 0);
    const p = round1(((Number(food.protein) || 0) * amount) / 100);
    const c = round1(((Number(food.carb) || 0) * amount) / 100);
    const f = round1(((Number(food.fat) || 0) * amount) / 100);
    return { p, c, f, cal: calcCalories(p, c, f) };
  };

  const calculateTotal = () => {
    let totalP = 0, totalC = 0, totalF = 0;
    meals.forEach((meal) => {
      [...(meal.carbFood||[]), ...(meal.proteinFood||[]), ...(meal.fatFood||[])].forEach((food) => {
        const m = getFoodDisplayMacros(food);
        if (m) {
          totalP += m.p;
          totalC += m.c;
          totalF += m.f;
        }
      });
    });
    const finalP = round1(totalP);
    const finalC = round1(totalC);
    const finalF = round1(totalF);
    return {
      totalMacros: { protein: finalP, carb: finalC, fat: finalF },
      totalCalories: calcCalories(finalP, finalC, finalF)
    };
  };

  const { totalMacros, totalCalories } = calculateTotal();

  const handleOpenModal = async (mealIndex, type) => {
    // Check trial limit only when they try to add the very FIRST food if they haven't recorded yet
    const hasAnyFood = meals.some(m => m.carbFood?.length || m.proteinFood?.length || m.fatFood?.length);
    
    if (!hasAnyFood && !hasRecorded) {
      if (!canGenerate) {
        toast.error("Bạn đã hết lượt sử dụng miễn phí. Hãy đăng ký gói để tiếp tục trải nghiệm!", { autoClose: 5000 });
        return;
      }
      const recorded = await recordGeneration();
      if (!recorded && accessLevel === "trial") {
        toast.error("Không thể ghi nhận lượt sử dụng hoặc đã hết lượt.");
        return;
      }
      setHasRecorded(true);
    }

    setActiveCell({ mealIndex, type });
    setSearchQuery("");
    setIsCustomMode(false);
    setCustomFood({ name: "", protein: "", carb: "", fat: "" });
    setModalOpen(true);
  };

  const handleAmountChange = (mealIndex, type, foodIndex, amount) => {
    const val = Math.max(0, Number(amount));
    setMeals(prev => {
      const newMeals = [...prev];
      const newMeal = { ...newMeals[mealIndex] };
      const newArr = [...newMeal[type]];
      if (newArr[foodIndex]) {
        newArr[foodIndex] = { ...newArr[foodIndex], amount: val };
      }
      newMeal[type] = newArr;
      newMeals[mealIndex] = newMeal;
      return newMeals;
    });
  };

  const handleRemoveFood = (mealIndex, type, foodIndex) => {
    setMeals(prev => {
      const newMeals = [...prev];
      const newMeal = { ...newMeals[mealIndex] };
      newMeal[type] = newMeal[type].filter((_, i) => i !== foodIndex);
      newMeals[mealIndex] = newMeal;
      return newMeals;
    });
  };

  // Lọc DB
  const searchResults = useMemo(() => {
    const keyword = searchQuery.toLowerCase().trim();
    let filtered = foodDatabase.filter(f => (f.label || f.name || "").toLowerCase().includes(keyword));
    
    // Sort by priority (if needed)
    filtered.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Trial restriction
    if (accessLevel === "trial") {
      return filtered.slice(0, 10);
    }
    return filtered;
  }, [searchQuery, foodDatabase, accessLevel]);

  const handleSelectDbFood = (food) => {
    setMeals(prev => {
      const newMeals = [...prev];
      const newMeal = { ...newMeals[activeCell.mealIndex] };
      const newArr = [...newMeal[activeCell.type]];
      newArr.push({
        ...food,
        amount: 100 // Default 100g
      });
      newMeal[activeCell.type] = newArr;
      newMeals[activeCell.mealIndex] = newMeal;
      return newMeals;
    });
    setModalOpen(false);
    toast.success(`Đã thêm ${food.label || food.name}`);
  };

  const handleAddCustomFood = () => {
    if (!customFood.name) return toast.error("Vui lòng nhập tên thực phẩm");
    
    setMeals(prev => {
      const newMeals = [...prev];
      const newMeal = { ...newMeals[activeCell.mealIndex] };
      const newArr = [...newMeal[activeCell.type]];
      newArr.push({
        _id: `custom-${Date.now()}`,
        label: customFood.name,
        protein: Number(customFood.protein),
        carb: Number(customFood.carb),
        fat: Number(customFood.fat),
        amount: 100 // Default 100g
      });
      newMeal[activeCell.type] = newArr;
      newMeals[activeCell.mealIndex] = newMeal;
      return newMeals;
    });
    setModalOpen(false);
    toast.success("Đã thêm thực phẩm tự chọn");
  };

  const renderCell = (mealIndex, type, icon, colorClass, borderClass, bgClass, emptyLabel) => {
    const foods = meals[mealIndex][type] || [];
    
    return (
      <div className="flex flex-col gap-2 h-full">
        {foods.map((food, foodIndex) => {
          const m = getFoodDisplayMacros(food);
          return (
            <div key={foodIndex} className={`relative bg-gray-800/80 border border-gray-700 rounded-xl p-3 shadow-inner group ${colorClass}`}>
              <button 
                onClick={() => handleRemoveFood(mealIndex, type, foodIndex)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                title="Xóa thực phẩm"
              >
                <X className="w-3 h-3" />
              </button>

              <div className="flex items-center flex-wrap gap-2 mb-2">
                <span className="font-bold flex-1 min-w-0 truncate" title={food.label || food.name}>
                  {food.label || food.name}
                </span>
                <div className="flex items-center gap-1 shrink-0 bg-gray-900 rounded-lg px-2 py-1 border border-gray-700 focus-within:border-primary transition-colors">
                  <input 
                    type="number" 
                    value={food.amount}
                    onChange={(e) => handleAmountChange(mealIndex, type, foodIndex, e.target.value)}
                    className="w-12 bg-transparent text-white text-right text-sm font-bold outline-none"
                    min="0"
                    step="5"
                  />
                  <span className="text-xs text-gray-400">g</span>
                </div>
              </div>
              
              <div className="text-xs text-gray-300 bg-gray-900/50 rounded-lg p-2 flex justify-between">
                <span title="Protein">P: <strong>{m.p}</strong>g</span>
                <span title="Carb">C: <strong>{m.c}</strong>g</span>
                <span title="Fat">F: <strong>{m.f}</strong>g</span>
              </div>
            </div>
          );
        })}
        
        <button 
          onClick={() => handleOpenModal(mealIndex, type)}
          className={`w-full ${foods.length === 0 ? 'min-h-[80px] h-full' : 'py-2 mt-auto'} border-2 border-dashed ${borderClass} ${bgClass} ${colorClass} hover:opacity-80 rounded-xl flex flex-col items-center justify-center gap-1 transition-all`}
        >
          {foods.length === 0 ? (
            <>
              <PlusCircle className="w-5 h-5" />
              <span className="text-xs font-semibold">{emptyLabel}</span>
            </>
          ) : (
            <span className="text-xs font-semibold flex items-center gap-1"><Plus className="w-3 h-3"/> Thêm món</span>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex gap-3">
        <Search className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <strong className="text-blue-300">Hướng dẫn:</strong> Nhấn vào ô trống để tìm thực phẩm trong cơ sở dữ liệu hoặc tự nhập thủ công. Cập nhật định lượng (g) trực tiếp trên ô, hệ thống sẽ tính toán Calories và Macro ngay lập tức.
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[800px] sm:min-w-full">
          <table className="w-full bg-gray-800/40 rounded-2xl border border-gray-700 shadow-lg table-fixed">
            <thead className="bg-gray-700/60">
              <tr>
                <th className="w-[12%] px-3 sm:px-5 py-4 text-left text-primary font-bold border-b border-gray-600 text-sm sm:text-base rounded-tl-2xl">
                  Bữa ăn
                </th>
                <th className="w-[26%] px-3 sm:px-5 py-4 text-left text-green-300 font-bold border-b border-gray-600">
                  <Wheat className="w-4 h-4 inline mr-1" /> Tinh bột
                </th>
                <th className="w-[26%] px-3 sm:px-5 py-4 text-left text-red-300 font-bold border-b border-gray-600">
                  <Drumstick className="w-4 h-4 inline mr-1" /> Đạm
                </th>
                <th className="w-[26%] px-3 sm:px-5 py-4 text-left text-yellow-300 font-bold border-b border-gray-600">
                  <Fish className="w-4 h-4 inline mr-1" /> Chất béo
                </th>
                <th className="w-[10%] px-3 sm:px-5 py-4 text-center text-primary font-bold border-b border-gray-600 rounded-tr-2xl">
                  Calo
                </th>
              </tr>
            </thead>
            <tbody>
              {meals.map((meal, idx) => {
                let mealP = 0, mealC = 0, mealF = 0;
                [...(meal.carbFood||[]), ...(meal.proteinFood||[]), ...(meal.fatFood||[])].forEach(food => {
                  const m = getFoodDisplayMacros(food);
                  if (m) { mealP += m.p; mealC += m.c; mealF += m.f; }
                });
                const mealCal = calcCalories(round1(mealP), round1(mealC), round1(mealF));

                return (
                  <tr key={meal.id} className="border-b border-gray-700/50 hover:bg-gray-700/20 transition group">
                    <td className="px-3 sm:px-5 py-4 font-semibold text-white text-sm sm:text-base align-middle">
                      {meal.mealName}
                    </td>
                    <td className="px-2 sm:px-3 py-3 align-top">
                      {renderCell(idx, 'carbFood', Wheat, 'text-green-300', 'border-green-500/30', 'bg-green-500/5', 'Tinh bột')}
                    </td>
                    <td className="px-2 sm:px-3 py-3 align-top">
                      {renderCell(idx, 'proteinFood', Drumstick, 'text-red-300', 'border-red-500/30', 'bg-red-500/5', 'Đạm')}
                    </td>
                    <td className="px-2 sm:px-3 py-3 align-top">
                      {renderCell(idx, 'fatFood', Fish, 'text-yellow-300', 'border-yellow-500/30', 'bg-yellow-500/5', 'Chất béo')}
                    </td>
                    <td className="px-3 sm:px-5 py-4 font-bold text-primary text-sm sm:text-base text-center align-middle">
                      {mealCal} <span className="text-xs text-gray-400 font-normal block">kcal</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <NutritionLegend />
      
      <MealSummary 
        totalMacros={totalMacros}
        totalCalories={totalCalories}
        targetMacros={targetMacros}
        targetLabel={targetLabel}
      />

      {/* Modal chọn thực phẩm */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/50">
              <h3 className="text-lg font-bold text-white">
                Thêm <span className="text-primary uppercase">
                  {activeCell?.type === 'carbFood' ? 'Tinh bột' : activeCell?.type === 'proteinFood' ? 'Đạm' : 'Chất béo'}
                </span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white transition bg-gray-800 hover:bg-gray-700 rounded-full p-1.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-gray-700">
              <button 
                onClick={() => setIsCustomMode(false)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${!isCustomMode ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Từ Database
              </button>
              <button 
                onClick={() => setIsCustomMode(true)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${isCustomMode ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Nhập thủ công
              </button>
            </div>

            {!isCustomMode ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="p-4 pb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Tìm tên thực phẩm..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 pt-2 space-y-2">
                  {searchResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Không tìm thấy thực phẩm. Bạn có thể chọn "Nhập thủ công" để tự thêm.
                    </div>
                  ) : (
                    searchResults.map(f => (
                      <button 
                        key={f._id}
                        onClick={() => handleSelectDbFood(f)}
                        className="w-full text-left p-3 rounded-xl border border-gray-700 hover:border-primary/50 bg-gray-800/50 hover:bg-gray-800 transition-all flex justify-between items-center group"
                      >
                        <div className="min-w-0 pr-4">
                          <div className="font-semibold text-white text-sm truncate group-hover:text-primary transition-colors">
                            {f.label || f.name}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            P: {f.protein}g • C: {f.carb}g • F: {f.fat}g / 100g
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-gray-500 group-hover:text-primary shrink-0" />
                      </button>
                    ))
                  )}
                  
                  {accessLevel === "trial" && (
                    <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 text-center">
                      <Crown className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-300">
                        Bạn đang xem <strong className="text-white">10 thực phẩm</strong> cơ bản. Có hơn <strong className="text-white">{foodDatabase.length - 10}</strong> thực phẩm đa dạng khác trong kho dữ liệu.
                      </p>
                      <a href="/" className="inline-block mt-3 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-orange-500/20">
                        Nâng cấp gói ngay
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Tên thực phẩm</label>
                    <input 
                      type="text" 
                      value={customFood.name}
                      onChange={e => setCustomFood(p => ({ ...p, name: e.target.value }))}
                      placeholder="VD: Whey Protein ISO"
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-red-400 mb-1.5 font-medium">Protein (g)</label>
                      <input 
                        type="number" min="0" step="0.1"
                        value={customFood.protein}
                        onChange={e => setCustomFood(p => ({ ...p, protein: e.target.value }))}
                        placeholder="0"
                        className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-400"
                      />
                      <span className="block mt-1 text-[10px] text-gray-500">/ 100g</span>
                    </div>
                    <div>
                      <label className="block text-sm text-green-400 mb-1.5 font-medium">Carb (g)</label>
                      <input 
                        type="number" min="0" step="0.1"
                        value={customFood.carb}
                        onChange={e => setCustomFood(p => ({ ...p, carb: e.target.value }))}
                        placeholder="0"
                        className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-green-400"
                      />
                      <span className="block mt-1 text-[10px] text-gray-500">/ 100g</span>
                    </div>
                    <div>
                      <label className="block text-sm text-yellow-400 mb-1.5 font-medium">Fat (g)</label>
                      <input 
                        type="number" min="0" step="0.1"
                        value={customFood.fat}
                        onChange={e => setCustomFood(p => ({ ...p, fat: e.target.value }))}
                        placeholder="0"
                        className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400"
                      />
                      <span className="block mt-1 text-[10px] text-gray-500">/ 100g</span>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleAddCustomFood}
                  className="w-full mt-6 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                >
                  <Save className="w-5 h-5" /> Thêm vào thực đơn
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
