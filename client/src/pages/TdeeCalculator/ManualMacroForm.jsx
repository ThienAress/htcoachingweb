import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Calculator, ArrowRight, Activity, Flame } from "lucide-react";
import { calculateCaloriesFromMacros } from "./tdee.helpers";

const ManualMacroForm = () => {
  const { t } = useTranslation("tdee");
  const [macros, setMacros] = useState({
    protein: "",
    carb: "",
    fat: "",
  });

  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Allow empty or positive numbers
    if (value === "" || (Number(value) >= 0 && !isNaN(value))) {
      setMacros((prev) => ({ ...prev, [name]: value }));
      setError("");
    }
  };

  const p = parseFloat(macros.protein) || 0;
  const c = parseFloat(macros.carb) || 0;
  const f = parseFloat(macros.fat) || 0;
  const computedCalories = calculateCaloriesFromMacros(p, c, f);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!p && !c && !f) {
      setError(t("manual.err_empty"));
      return;
    }

    const customMacroSet = {
      "Tự nhập (Custom)": {
        protein: Math.round(p),
        carb: Math.round(c),
        fat: Math.round(f),
        calories: computedCalories
      },
    };

    localStorage.setItem("macroSet", JSON.stringify(customMacroSet));
    // Clear out TDEE data so we don't mix manual and auto
    localStorage.removeItem("tdeeForm");
    localStorage.removeItem("tdeeData");

    navigate("/mealplan");
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10 w-full max-w-4xl mx-auto animate-fade-in-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 mb-4">
          <Calculator className="text-primary w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 uppercase">{t("manual.title")}</h2>
        <p className="text-gray-400">
          {t("manual.desc")}
        </p>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Đạm */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              {t("manual.protein")}
            </label>
            <div className="relative">
              <input
                type="number"
                name="protein"
                value={macros.protein}
                onChange={handleInputChange}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-xl pl-4 pr-14 py-3 focus:ring-2 focus:ring-primary outline-none transition"
                placeholder={t("form.adj_placeholder").replace("300, -500, 0", "150")}
              />
              <div className="absolute right-7 top-1/2 -translate-y-1/2 text-red-400 font-medium">g</div>
            </div>
          </div>

          {/* Tinh bột */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              {t("manual.carb")}
            </label>
            <div className="relative">
              <input
                type="number"
                name="carb"
                value={macros.carb}
                onChange={handleInputChange}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-xl pl-4 pr-14 py-3 focus:ring-2 focus:ring-primary outline-none transition"
                placeholder={t("form.adj_placeholder").replace("300, -500, 0", "200")}
              />
              <div className="absolute right-7 top-1/2 -translate-y-1/2 text-green-400 font-medium">g</div>
            </div>
          </div>

          {/* Béo */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              {t("manual.fat")}
            </label>
            <div className="relative">
              <input
                type="number"
                name="fat"
                value={macros.fat}
                onChange={handleInputChange}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-xl pl-4 pr-14 py-3 focus:ring-2 focus:ring-primary outline-none transition"
                placeholder={t("form.adj_placeholder").replace("300, -500, 0", "60")}
              />
              <div className="absolute right-7 top-1/2 -translate-y-1/2 text-yellow-400 font-medium">g</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm text-center font-medium bg-red-400/10 py-2 rounded-lg border border-red-400/20">
            {error}
          </div>
        )}

        {/* Tổng Calories */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 flex flex-col items-center justify-center space-y-2">
          <span className="text-gray-400 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" /> {t("manual.total_cal")}
          </span>
          <div className="text-4xl font-black text-primary flex items-end gap-2">
            {computedCalories} <span className="text-lg text-gray-400 font-semibold mb-1">kcal</span>
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary shadow-lg shadow-primary/30 flex items-center gap-2 px-8 py-3.5 text-lg font-bold w-full md:w-auto justify-center"
          >
            <Flame className="w-5 h-5" />
            <span>{t("manual.btn_submit")}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualMacroForm;
