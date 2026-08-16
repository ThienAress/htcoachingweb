import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { Flame, BarChart3, Utensils, Calendar, Dumbbell } from "lucide-react";
import TdeeForm from "./TdeeForm";
import TdeeResultBox from "./TdeeResultBox";
import MacroTable from "./MacroTable";
import ManualMacroForm from "./ManualMacroForm";
import Header from "../../sections/Header/Header";
import ChatIcons from "../../components/ChatIcons";
import SEO from "../../components/SEO";
import {
  calculateBmr,
  calculateTdeeEstimate,
  calculateAdjustedCalories,
  calculateMacroSet,
  createDefaultTdeeForm,
  getDefaultCalorieAdjustment,
  isTdeeInputWithinLimits,
  normalizeStoredTdeeForm,
  recommendActivityBand,
  updateTrainingEvidence,
} from "./tdee.helpers";

const loadStoredTdee = () => {
  const result = {
    form: createDefaultTdeeForm(),
    tdee: null,
    bmr: null,
    adjustedCalories: null,
    tdeeRange: null,
    activityBand: null,
    macroSet: null,
  };

  try {
    const savedForm = localStorage.getItem("tdeeForm");
    if (savedForm) result.form = normalizeStoredTdeeForm(JSON.parse(savedForm));
  } catch {
    localStorage.removeItem("tdeeForm");
  }

  try {
    const savedData = localStorage.getItem("tdeeData");
    if (savedData) {
      const data = JSON.parse(savedData);
      result.bmr = data.bmr ?? null;
      result.tdee = data.tdee ?? null;
      result.adjustedCalories = isTdeeInputWithinLimits(
        "targetCalories",
        data.adjustedCalories,
      )
        ? data.adjustedCalories
        : null;
      result.tdeeRange = data.tdeeRange ?? null;
      result.activityBand = data.activityBand ?? null;
      if (
        !result.tdeeRange ||
        !result.activityBand ||
        result.adjustedCalories == null
      ) {
        result.tdee = null;
        result.bmr = null;
        result.adjustedCalories = null;
        localStorage.removeItem("tdeeData");
        localStorage.removeItem("macroSet");
        result.macroSet = null;
      }
    }
  } catch {
    localStorage.removeItem("tdeeData");
  }

  try {
    const savedMacros = localStorage.getItem("macroSet");
    if (savedMacros && result.tdeeRange && result.activityBand) {
      result.macroSet = JSON.parse(savedMacros);
    }
  } catch {
    localStorage.removeItem("macroSet");
  }

  return result;
};

const TdeeCalculator = () => {
  const { t } = useTranslation("tdee");
  const [storedTdee] = useState(loadStoredTdee);
  const [form, setForm] = useState(storedTdee.form);

  const [calcMode, setCalcMode] = useState("auto"); // "auto" | "manual"
  const [errors, setErrors] = useState({});
  const [tdee, setTdee] = useState(storedTdee.tdee);
  const [bmr, setBmr] = useState(storedTdee.bmr);
  const [adjustedCalories, setAdjustedCalories] = useState(storedTdee.adjustedCalories);
  const [tdeeRange, setTdeeRange] = useState(storedTdee.tdeeRange);
  const [calculatedActivityBand, setCalculatedActivityBand] = useState(
    storedTdee.activityBand,
  );
  const [macroSet, setMacroSet] = useState(storedTdee.macroSet);
  const [goalNotice, setGoalNotice] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (!name) return;
    if (["height", "weight", "age", "bodyfat"].includes(name) && value < 0)
      return;
    
    setForm((prev) => {
      if (name === "goal") {
        if (prev.goal && prev.goal !== value) {
          setGoalNotice(true);
        }
        const newCalorieAdjustment = getDefaultCalorieAdjustment(value) || prev.customCalorieAdjustment;
        return { ...prev, [name]: value, customCalorieAdjustment: newCalorieAdjustment };
      }
      if (["trainingFrequency", "trainingDuration", "trainingIntensity"].includes(name)) {
        return { ...updateTrainingEvidence(prev, name, value), activity: "" };
      }
      return { ...prev, [name]: value };
    });
    setErrors((prev) => ({ ...prev, [name]: "" }));
    if (["dailyMovement", "steps", "trainingFrequency", "trainingDuration", "trainingIntensity"].includes(name)) {
      setErrors((prev) => ({ ...prev, activity: "" }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { gender, height, weight, age, formula, bodyfat, goal } =
      form;
    const activityBand = recommendActivityBand(form);
    let newErrors = {};
    if (!gender) newErrors.gender = t("form.err_gender");
    if (!isTdeeInputWithinLimits("heightCm", height)) {
      newErrors.height = t("form.err_height");
    }
    if (!isTdeeInputWithinLimits("weightKg", weight)) {
      newErrors.weight = t("form.err_weight");
    }
    if (!isTdeeInputWithinLimits("age", age)) {
      newErrors.age = t("form.err_age");
    }
    if (!activityBand) newErrors.activity = t("form.err_activity");
    if (!formula) newErrors.formula = t("form.err_formula");
    if (!goal) newErrors.goal = t("form.err_goal");
    if (
      formula === "Katch-McArdle" &&
      !isTdeeInputWithinLimits("bodyFatPercent", bodyfat)
    ) {
      newErrors.bodyfat = t("form.err_bodyfat");
    }
    if (!isTdeeInputWithinLimits("calorieAdjustment", form.customCalorieAdjustment)) {
      newErrors.calorieAdjustment = t("form.err_calorie_adjustment");
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTdee(null);
      setBmr(null);
      setAdjustedCalories(null);
      setTdeeRange(null);
      setCalculatedActivityBand(null);
      return;
    }
    const rawBmr = calculateBmr({ formula, weight, height, age, gender, bodyfat });
    const estimate = calculateTdeeEstimate(rawBmr, activityBand);
    const rawTdee = estimate.estimate;
    const rawAdjusted = calculateAdjustedCalories(rawTdee, form.customCalorieAdjustment);

    if (rawAdjusted == null) {
      setErrors({ calorieAdjustment: t("form.err_target_calories") });
      setTdee(null);
      setBmr(null);
      setAdjustedCalories(null);
      setTdeeRange(null);
      setCalculatedActivityBand(null);
      setMacroSet(null);
      return;
    }

    const roundedBmr = Math.round(rawBmr);
    const roundedTdee = Math.round(rawTdee);
    const roundedAdjusted = Math.round(rawAdjusted);

    setBmr(roundedBmr);
    setTdee(roundedTdee);
    setTdeeRange(estimate.range);
    setCalculatedActivityBand(activityBand);
    setAdjustedCalories(roundedAdjusted);
    setMacroSet(null);
    setGoalNotice(false);
    const confirmedForm = { ...form, activity: activityBand.key };
    setForm(confirmedForm);
    localStorage.setItem("tdeeForm", JSON.stringify(confirmedForm));
    localStorage.setItem(
      "tdeeData",
      JSON.stringify({
        bmr: roundedBmr,
        tdee: roundedTdee,
        adjustedCalories: roundedAdjusted,
        tdeeRange: estimate.range,
        activityBand,
      }),
    );
  };

  const handleReset = () => {
    setForm(createDefaultTdeeForm());
    setTdee(null);
    setBmr(null);
    setAdjustedCalories(null);
    setTdeeRange(null);
    setCalculatedActivityBand(null);
    setErrors({});
    setMacroSet(null);
    setGoalNotice(false);
    localStorage.removeItem("tdeeForm");
    localStorage.removeItem("tdeeData");
    localStorage.removeItem("macroSet");
  };

  const calculateMacro = () => {
    if (!adjustedCalories) return;
    const results = calculateMacroSet(adjustedCalories);
    setMacroSet(results);
    localStorage.setItem("macroSet", JSON.stringify(results));
  };

  const tdeeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "name": "Công cụ tính TDEE & Macro HTCOACHING",
        "url": "https://htcoachingweb.io.vn/tdee-calculator/",
        "applicationCategory": "HealthApplication",
        "description": "Công cụ ước tính TDEE theo vận động cả ngày, hiển thị khoảng hợp lý và phân bổ Macro tham khảo."
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "TDEE là gì?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "TDEE (Total Daily Energy Expenditure) là tổng năng lượng bạn tiêu hao trong một ngày, bao gồm hoạt động sống cơ bản (BMR), vận động thể chất và tiêu hao do tiêu hóa thức ăn. Biết TDEE giúp bạn điều chỉnh chế độ ăn để giảm mỡ hoặc tăng cơ hiệu quả."
            }
          },
          {
            "@type": "Question",
            "name": "BMR khác TDEE như thế nào?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "BMR là năng lượng cơ thể tiêu hao khi nghỉ ngơi. TDEE là ước tính BMR nhân hệ số phản ánh cả vận động trong ngày, bước chân và tập luyện; số buổi tập đơn lẻ không đủ để chọn hệ số."
            }
          },
          {
            "@type": "Question",
            "name": "Macro là gì và tại sao cần tính Macro?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Macro (Macronutrients) gồm 3 chất dinh dưỡng chính: Protein (Đạm), Carbohydrate (Tinh bột) và Fat (Chất béo). Tính Macro giúp bạn biết cần ăn bao nhiêu gram mỗi loại mỗi ngày để đạt mục tiêu giảm mỡ, tăng cơ hoặc duy trì cân nặng."
            }
          },
          {
            "@type": "Question",
            "name": "Muốn giảm mỡ thì cần ăn bao nhiêu calo?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Để giảm mỡ an toàn, bạn nên ăn ít hơn TDEE khoảng 300-500 kcal/ngày. Ví dụ: TDEE là 2000 kcal thì nên ăn 1500-1700 kcal/ngày. Không nên giảm quá nhanh vì có thể mất cơ và ảnh hưởng sức khỏe."
            }
          }
        ]
      }
    ]
  };

  const handleMealPlanClick = (e) => {
    e.preventDefault();
    navigate("/mealplan");
  };

  return (
    <main className="py-12 md:py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <SEO 
        title={t("seo_title")}
        description={t("seo_desc")}
        canonical="/tdee-calculator"
        jsonLd={tdeeSchema}
      />
      <Header />
      <div className="container-custom mt-10">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
            <Flame className="text-primary w-6 h-6" />
            <span className="font-semibold text-primary tracking-wide">
              TDEE CALCULATOR
            </span>
          </div>
          <h1 className="text-fluid-5xl font-black uppercase">
            <Trans i18nKey="title" ns="tdee" components={[<span className="text-primary" key="0" />]} />
          </h1>
          <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
          <p className="text-gray-400 mt-4 max-w-xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        {/* Toggle Mode */}
        <div className="flex justify-center mb-10">
          <div className="bg-gray-800/80 p-1 rounded-2xl flex border border-gray-700 w-full max-w-md">
            <button
              onClick={() => setCalcMode("auto")}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                calcMode === "auto"
                  ? "bg-primary text-white shadow-lg"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t("mode_auto")}
            </button>
            <button
              onClick={() => setCalcMode("manual")}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                calcMode === "manual"
                  ? "bg-primary text-white shadow-lg"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t("mode_manual")}
            </button>
          </div>
        </div>

        {calcMode === "manual" ? (
          <ManualMacroForm />
        ) : (
          <>
            <TdeeForm
              form={form}
              errors={errors}
              handleChange={handleChange}
              handleSubmit={handleSubmit}
              handleReset={handleReset}
              goalNotice={goalNotice}
            />

        {tdee && bmr && (
          <div className="animate-fade-in-up">
            <TdeeResultBox
              tdee={tdee}
              bmr={bmr}
              adjustedCalories={adjustedCalories}
              goal={form.goal}
              tdeeRange={tdeeRange}
              activityBand={calculatedActivityBand}
            />
          </div>
        )}

        {adjustedCalories && (
          <div className="mt-12 space-y-8 animate-fade-in-up">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10 hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Flame className="text-primary w-5 h-5" />
                </div>
                <h3 className="text-fluid-2xl font-bold text-primary">
                  {t("info.tdee_title")}
                </h3>
              </div>
              <p className="text-gray-300 leading-relaxed mb-4">
                <Trans i18nKey="info.tdee_desc" ns="tdee" components={[<strong className="text-gray-200" key="0" />]} />
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <BarChart3 className="text-primary w-5 h-5" />
                </div>
                <h3 className="text-fluid-2xl font-bold text-primary">
                  {t("info.macro_title")}
                </h3>
              </div>
              <p className="text-gray-300 leading-relaxed mb-6">
                <Trans i18nKey="info.macro_desc" ns="tdee" components={[
                  <strong className="text-gray-200" key="0" />,
                  <strong className="text-gray-200" key="1" />,
                  <strong className="text-gray-200" key="2" />,
                  <strong className="text-gray-200" key="3" />
                ]} />
              </p>
              <button
                onClick={calculateMacro}
                className="btn btn-primary shadow-lg shadow-primary/30 flex items-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                <span>{t("info.btn_macro")}</span>
              </button>

              {macroSet && (
                <>
                  <MacroTable
                    macroSet={macroSet}
                    tdee={tdee}
                    adjustedCalories={adjustedCalories}
                    goal={form.goal}
                  />
                  <div className="mt-8 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Utensils className="text-primary w-5 h-5" />
                      </div>
                      <h3 className="text-fluid-2xl font-bold text-primary">
                        {t("info.meal_title")}
                      </h3>
                    </div>
                    <p className="text-gray-300 leading-relaxed mb-6">
                      <Trans i18nKey="info.meal_desc" ns="tdee" components={[<strong className="text-gray-200" key="0" />, <strong className="text-gray-200" key="1" />]} />
                    </p>
                    <button
                      onClick={handleMealPlanClick}
                      className="btn btn-primary shadow-lg flex items-center gap-2 inline-flex"
                    >
                      <Calendar className="w-5 h-5" />
                      <span>{t("info.btn_meal")}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Internal Links */}
      <section className="max-w-4xl mx-auto mt-16 mb-8 px-4">
        <h2 className="text-center text-2xl font-bold text-white mb-2 uppercase">
          <Trans i18nKey="tools.title" ns="tdee" components={[<span className="text-primary" key="0" />]} />
        </h2>
        <p className="text-center text-sm text-gray-400 mb-10">
          {t("tools.desc")}
        </p>
        <div className="grid gap-8 sm:grid-cols-3">
          <Link
            to="/exercises/"
            className="group border border-gray-700 bg-gray-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
          >
            <Dumbbell className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-bold text-white group-hover:text-primary transition">
              {t("tools.exercises")}
            </h3>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              {t("tools.exercises_desc")}
            </p>
          </Link>
          <Link
            to="/mealplan/"
            className="group border border-gray-700 bg-gray-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
          >
            <Calendar className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-bold text-white group-hover:text-primary transition">
              {t("tools.mealplan")}
            </h3>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              {t("tools.mealplan_desc")}
            </p>
          </Link>
          <Link
            to="/ket-qua-khach-hang/"
            className="group border border-gray-700 bg-gray-800/50 p-5 rounded-xl transition hover:-translate-y-1 hover:border-primary hover:shadow-lg"
          >
            <Flame className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-bold text-white group-hover:text-primary transition">
              {t("tools.stories")}
            </h3>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              {t("tools.stories_desc")}
            </p>
          </Link>
        </div>
      </section>

      <ChatIcons />
    </main>
  );
};

export default TdeeCalculator;
