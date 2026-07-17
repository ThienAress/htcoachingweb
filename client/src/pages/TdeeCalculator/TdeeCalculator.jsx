import React, { useState, useEffect } from "react";
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
import { useAuth } from "../../context/AuthContext";
import LoginModal from "../MealPlan/LoginModal";
import {
  calculateBmr,
  calculateTdee,
  calculateAdjustedCalories,
  calculateMacroSet,
  getDefaultCalorieAdjustment,
} from "./tdee.helpers";

const TdeeCalculator = () => {
  const { t } = useTranslation("tdee");
  const [form, setForm] = useState({
    gender: "",
    height: "",
    weight: "",
    age: "",
    activity: "",
    formula: "",
    bodyfat: "",
    goal: "",
    customCalorieAdjustment: "",
  });

  const [calcMode, setCalcMode] = useState("auto"); // "auto" | "manual"
  const [errors, setErrors] = useState({});
  const [tdee, setTdee] = useState(null);
  const [bmr, setBmr] = useState(null);
  const [adjustedCalories, setAdjustedCalories] = useState(null);
  const [macroSet, setMacroSet] = useState(null);
  const [goalNotice, setGoalNotice] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const savedForm = localStorage.getItem("tdeeForm");
    const savedData = localStorage.getItem("tdeeData");
    const savedMacros = localStorage.getItem("macroSet");

    if (savedForm) setForm(JSON.parse(savedForm));
    if (savedData) {
      const { bmr, tdee, adjustedCalories } = JSON.parse(savedData);
      setBmr(bmr);
      setTdee(tdee);
      setAdjustedCalories(adjustedCalories);
    }
    if (savedMacros) setMacroSet(JSON.parse(savedMacros));
  }, []);

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
      return { ...prev, [name]: value };
    });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { gender, height, weight, age, activity, formula, bodyfat, goal } =
      form;
    let newErrors = {};
    if (!gender) newErrors.gender = t("form.err_gender");
    if (!height || height <= 0) newErrors.height = t("form.err_height");
    if (!weight || weight <= 0) newErrors.weight = t("form.err_weight");
    if (!age || age <= 0) newErrors.age = t("form.err_age");
    if (!activity) newErrors.activity = t("form.err_activity");
    if (!formula) newErrors.formula = t("form.err_formula");
    if (!goal) newErrors.goal = t("form.err_goal");
    if (formula === "Katch-McArdle" && (!bodyfat || bodyfat <= 0)) {
      newErrors.bodyfat = t("form.err_bodyfat");
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTdee(null);
      setBmr(null);
      setAdjustedCalories(null);
      return;
    }
    const rawBmr = calculateBmr({ formula, weight, height, age, gender, bodyfat });
    const rawTdee = calculateTdee(rawBmr, activity);
    const rawAdjusted = calculateAdjustedCalories(rawTdee, form.customCalorieAdjustment);

    const roundedBmr = Math.round(rawBmr);
    const roundedTdee = Math.round(rawTdee);
    const roundedAdjusted = Math.round(rawAdjusted);

    setBmr(roundedBmr);
    setTdee(roundedTdee);
    setAdjustedCalories(roundedAdjusted);
    setMacroSet(null);
    setGoalNotice(false);
    localStorage.setItem("tdeeForm", JSON.stringify(form));
    localStorage.setItem(
      "tdeeData",
      JSON.stringify({
        bmr: roundedBmr,
        tdee: roundedTdee,
        adjustedCalories: roundedAdjusted,
      }),
    );
  };

  const handleReset = () => {
    setForm({
      gender: "",
      height: "",
      weight: "",
      age: "",
      activity: "",
      formula: "",
      bodyfat: "",
      goal: "",
      customCalorieAdjustment: "",
    });
    setTdee(null);
    setBmr(null);
    setAdjustedCalories(null);
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
        "url": "https://htcoachingweb.io.vn/tdee-calculator",
        "applicationCategory": "HealthApplication",
        "description": "Công cụ tính TDEE chuẩn khoa học, xác định lượng calo cần thiết để giảm mỡ hoặc tăng cơ, kèm theo phân bổ Macro chi tiết."
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
              "text": "BMR (Basal Metabolic Rate) là năng lượng cơ thể tiêu hao khi nghỉ ngơi hoàn toàn. TDEE = BMR × hệ số hoạt động. Ví dụ: nếu BMR là 1500 kcal và bạn tập gym 3-5 ngày/tuần (hệ số 1.55), thì TDEE = 1500 × 1.55 = 2325 kcal/ngày."
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
    if (user) {
      navigate("/mealplan");
    } else {
      setShowLoginModal(true);
    }
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
          <ManualMacroForm setShowLoginModal={setShowLoginModal} />
        ) : (
          <>
            <TdeeForm
              form={form}
              errors={errors}
              handleChange={handleChange}
              handleSubmit={handleSubmit}
              handleReset={handleReset}
              goalNotice={goalNotice}
              setGoalNotice={setGoalNotice}
            />

        {tdee && bmr && (
          <div className="animate-fade-in-up">
            <TdeeResultBox
              tdee={tdee}
              bmr={bmr}
              adjustedCalories={adjustedCalories}
              goal={form.goal}
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
            to="/exercises"
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
            to="/mealplan"
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
            to="/ket-qua-khach-hang"
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
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </main>
  );
};

export default TdeeCalculator;
