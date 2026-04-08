import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, BarChart3, Utensils, Calendar } from "lucide-react";
import TdeeForm from "./TdeeForm";
import TdeeResultBox from "./TdeeResultBox";
import MacroTable from "./MacroTable";
import Header from "../../sections/Header/Header";
import ChatIcons from "../../components/ChatIcons";

const TdeeCalculator = () => {
  const [form, setForm] = useState({
    gender: "",
    height: "",
    weight: "",
    age: "",
    activity: "",
    formula: "",
    bodyfat: "",
    goal: "",
  });

  const [errors, setErrors] = useState({});
  const [tdee, setTdee] = useState(null);
  const [bmr, setBmr] = useState(null);
  const [adjustedCalories, setAdjustedCalories] = useState(null);
  const [macroSet, setMacroSet] = useState(null);
  const [goalNotice, setGoalNotice] = useState(false);
  const navigate = useNavigate();

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
    if (name === "goal" && form.goal && form.goal !== value) {
      setGoalNotice(true);
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { gender, height, weight, age, activity, formula, bodyfat, goal } =
      form;
    let newErrors = {};
    if (!gender) newErrors.gender = "Vui lòng chọn giới tính.";
    if (!height || height <= 0) newErrors.height = "Chiều cao phải lớn hơn 0.";
    if (!weight || weight <= 0) newErrors.weight = "Cân nặng phải lớn hơn 0.";
    if (!age || age <= 0) newErrors.age = "Tuổi phải lớn hơn 0.";
    if (!activity) newErrors.activity = "Vui lòng chọn mức độ hoạt động.";
    if (!formula) newErrors.formula = "Vui lòng chọn công thức.";
    if (!goal) newErrors.goal = "Vui lòng chọn mục tiêu.";
    if (formula === "Katch-McArdle" && (!bodyfat || bodyfat <= 0)) {
      newErrors.bodyfat = "Vui lòng nhập body fat (%).";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTdee(null);
      setBmr(null);
      setAdjustedCalories(null);
      return;
    }
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age);
    const act = parseFloat(activity);
    let calculatedBmr = 0;
    if (formula === "Mifflin-St Jeor") {
      calculatedBmr = 10 * w + 6.25 * h - 5 * a + (gender === "Nam" ? 5 : -161);
    } else {
      const bf = parseFloat(bodyfat) / 100;
      const leanMass = w * (1 - bf);
      calculatedBmr = 370 + 21.6 * leanMass;
    }
    const tdeeBase = calculatedBmr * act;
    const roundedBmr = Math.round(calculatedBmr);
    const roundedTdee = Math.round(tdeeBase);
    let adjusted = tdeeBase;
    if (goal === "gain") adjusted += 300;
    else if (goal === "lose") adjusted -= 300;
    const roundedAdjusted = Math.round(adjusted);
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
    const plans = {
      "Low-carb": { protein: 0.4, fat: 0.4, carb: 0.2 },
      "Moderate-carb": { protein: 0.3, fat: 0.35, carb: 0.35 },
      "High-carb": { protein: 0.3, fat: 0.2, carb: 0.5 },
    };
    const results = {};
    for (const [goalName, ratio] of Object.entries(plans)) {
      const pCal = adjustedCalories * ratio.protein;
      const cCal = adjustedCalories * ratio.carb;
      const fCal = adjustedCalories * ratio.fat;
      results[goalName] = {
        protein: Math.round(pCal / 4),
        carb: Math.round(cCal / 4),
        fat: Math.round(fCal / 9),
      };
    }
    setMacroSet(results);
    localStorage.setItem("macroSet", JSON.stringify(results));
  };

  return (
    <section className="py-12 md:py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      <Header />
      <div className="container-custom mt-10">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-3 bg-primary/20 backdrop-blur-sm rounded-full px-5 py-2 mb-4">
            <Flame className="text-primary w-6 h-6" />
            <span className="font-semibold text-primary tracking-wide">
              TDEE CALCULATOR
            </span>
          </div>
          <h2>
            ĐO LƯỢNG <span className="text-primary">CALO ĐỐT CHÁY</span> TRONG 1
            NGÀY
          </h2>
          <div className="w-24 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
          <p className="text-gray-400 mt-4 max-w-xl mx-auto">
            Tính toán chính xác TDEE để tối ưu hóa quá trình tập luyện và dinh
            dưỡng
          </p>
        </div>

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
                <h3 className="text-2xl md:text-3xl font-bold text-primary">
                  1. TDEE là gì?
                </h3>
              </div>
              <p className="text-gray-300 leading-relaxed text-lg">
                <strong className="text-gray-200">
                  TDEE (Total Daily Energy Expenditure)
                </strong>{" "}
                là tổng năng lượng bạn tiêu hao trong một ngày, bao gồm các hoạt
                động sống cơ bản (BMR), vận động và tiêu hao do tiêu hóa thức
                ăn. Biết được TDEE giúp bạn điều chỉnh chế độ ăn và luyện tập để
                đạt được mục tiêu.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <BarChart3 className="text-primary w-5 h-5" />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-primary">
                  2. Tính toán macros
                </h3>
              </div>
              <p className="text-gray-300 leading-relaxed mb-6">
                Khi đã biết được tổng năng lượng bạn cần, bước tiếp theo là xác
                định các chất đa lượng{" "}
                <strong className="text-gray-200">(macros)</strong> bao gồm:{" "}
                <strong className="text-gray-200">Đạm (Protein)</strong>,{" "}
                <strong className="text-gray-200">Tinh bột (Carb)</strong>,{" "}
                <strong className="text-gray-200">Chất béo (Fat)</strong>. Bạn
                muốn mình tính giúp dựa trên thông số trên không?
              </p>
              <button
                onClick={calculateMacro}
                className="btn btn-primary shadow-lg shadow-primary/30 flex items-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                <span>Tính toán macro</span>
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
                      <h3 className="text-2xl md:text-3xl font-bold text-primary">
                        3. Lịch ăn cụ thể sẽ như thế nào?
                      </h3>
                    </div>
                    <p className="text-gray-300 leading-relaxed mb-6">
                      Sau khi đã tính được{" "}
                      <strong className="text-gray-200">macros</strong>, bạn có
                      muốn mình{" "}
                      <strong className="text-gray-200">
                        gợi ý luôn lịch ăn hàng ngày
                      </strong>{" "}
                      dựa trên thông số đó không? Nhấn vào nút dưới để nhận thực
                      đơn mẫu phù hợp với những thực phẩm đa dạng hỗ trợ mục
                      tiêu của bạn được tốt hơn.
                    </p>
                    <button
                      onClick={() => navigate("/mealplan")}
                      className="btn btn-primary shadow-lg flex items-center gap-2"
                    >
                      <Calendar className="w-5 h-5" />
                      <span>Gợi ý lịch ăn</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <ChatIcons />
    </section>
  );
};

export default TdeeCalculator;
