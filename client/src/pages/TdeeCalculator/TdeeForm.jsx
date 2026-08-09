import React from "react";
import { useTranslation } from "react-i18next";
import {
  Users,
  Ruler,
  Weight,
  Cake,
  Footprints,
  Calculator,
  Target,
  BarChart3,
  RotateCcw,
  AlertTriangle,
  Droplet,
} from "lucide-react";

const TdeeForm = ({
  form,
  errors,
  handleChange,
  handleSubmit,
  handleReset,
  goalNotice,
  setGoalNotice,
}) => {
  const { t } = useTranslation("tdee");
  const inputClasses =
    "w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all";
  const labelClasses =
    "block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2";

  return (
    <form
      onSubmit={handleSubmit}
      onReset={handleReset}
      className="bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-2xl p-6 md:p-10 border border-gray-800 max-w-5xl mx-auto"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Giới tính */}
        <div>
          <label className={labelClasses}>
            <Users className="w-4 h-4" /> {t("form.gender")}
          </label>
          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="">{t("form.select_gender")}</option>
            <option value="Nam">{t("form.male")}</option>
            <option value="Nữ">{t("form.female")}</option>
          </select>
          {errors.gender && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.gender}
            </p>
          )}
        </div>

        {/* Chiều cao */}
        <div>
          <label className={labelClasses}>
            <Ruler className="w-4 h-4" /> {t("form.height")}
          </label>
          <input
            type="number"
            name="height"
            min="0"
            value={form.height}
            onChange={handleChange}
            className={inputClasses}
          />
          {errors.height && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.height}
            </p>
          )}
        </div>

        {/* Cân nặng */}
        <div>
          <label className={labelClasses}>
            <Weight className="w-4 h-4" /> {t("form.weight")}
          </label>
          <input
            type="number"
            name="weight"
            min="0"
            value={form.weight}
            onChange={handleChange}
            className={inputClasses}
          />
          {errors.weight && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.weight}
            </p>
          )}
        </div>

        {/* Tuổi */}
        <div>
          <label className={labelClasses}>
            <Cake className="w-4 h-4" /> {t("form.age")}
          </label>
          <input
            type="number"
            name="age"
            min="0"
            value={form.age}
            onChange={handleChange}
            className={inputClasses}
          />
          {errors.age && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.age}
            </p>
          )}
        </div>

        {/* Hệ số vận động */}
        <div>
          <label className={labelClasses}>
            <Footprints className="w-4 h-4" /> {t("form.activity")}
          </label>
          <select
            name="activity"
            value={form.activity}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="">{t("form.select_activity")}</option>
            <option value="1.2">{t("form.act_1_2")}</option>
            <option value="1.375">{t("form.act_1_375")}</option>
            <option value="1.55">{t("form.act_1_55")}</option>
            <option value="1.725">{t("form.act_1_725")}</option>
            <option value="1.9">{t("form.act_1_9")}</option>
          </select>
          {errors.activity && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.activity}
            </p>
          )}
        </div>

        {/* Công thức */}
        <div>
          <label className={labelClasses}>
            <Calculator className="w-4 h-4" /> {t("form.formula")}
          </label>
          <select
            name="formula"
            value={form.formula}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="">{t("form.select_formula")}</option>
            <option value="Mifflin-St Jeor">Mifflin-St Jeor</option>
            <option value="Katch-McArdle">Katch-McArdle</option>
          </select>
          {errors.formula && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.formula}
            </p>
          )}
        </div>

        {/* Body Fat (chỉ hiện khi chọn Katch-McArdle) */}
        {form.formula === "Katch-McArdle" && (
          <div>
            <label className={labelClasses}>
              <Droplet className="w-4 h-4" /> {t("form.bodyfat")}
            </label>
            <input
              type="number"
              name="bodyfat"
              min="0"
              value={form.bodyfat}
              onChange={handleChange}
              className={inputClasses}
            />
            {errors.bodyfat && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {errors.bodyfat}
              </p>
            )}
          </div>
        )}

        {/* Mục tiêu */}
        <div>
          <label className={labelClasses}>
            <Target className="w-4 h-4" /> {t("form.goal")}
          </label>
          <select
            name="goal"
            value={form.goal}
            onChange={(e) => {
              handleChange(e);
            }}
            className={inputClasses}
          >
            <option value="">{t("form.select_goal")}</option>
            <option value="gain_muscle">{t("form.goal_gain_muscle")}</option>
            <option value="gain_weight">{t("form.goal_gain_weight")}</option>
            <option value="lose_fat">{t("form.goal_lose_fat")}</option>
            <option value="lose_weight">{t("form.goal_lose_weight")}</option>
            <option value="maintain">{t("form.goal_maintain")}</option>
          </select>
          {goalNotice && (
            <p className="text-yellow-400 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Bạn đã thay đổi mục tiêu. Hãy bấm lại vào nút "Xem kết quả" để cập
              nhật.
            </p>
          )}
          {errors.goal && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.goal}
            </p>
          )}
        </div>

        {/* Lượng Calo thay đổi */}
        {form.goal && (
          <div>
            <label className={labelClasses}>
              <BarChart3 className="w-4 h-4" /> {t("form.calorie_adj")}
            </label>
            <div className="relative">
              <input
                type="number"
                name="customCalorieAdjustment"
                value={form.customCalorieAdjustment}
                onChange={handleChange}
                className={`${inputClasses} pr-12`}
                placeholder={t("form.adj_placeholder")}
              />
              <div className="absolute right-0 top-0 bottom-0 flex items-center pr-4 pointer-events-none">
                <span className="text-gray-500 text-sm font-medium">kcal</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {form.goal === "gain_muscle"
                ? t("form.adj_gain_muscle")
                : form.goal === "gain_weight"
                ? t("form.adj_gain_weight")
                : form.goal === "lose_fat"
                ? t("form.adj_lose_fat")
                : form.goal === "lose_weight"
                ? t("form.adj_lose_weight")
                : form.goal === "maintain"
                ? t("form.adj_maintain")
                : t("form.adj_placeholder")}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-5 mt-10">
        <button
          type="submit"
          className="btn btn-primary shadow-lg shadow-primary/30 flex items-center gap-2"
        >
          <BarChart3 className="w-5 h-5" /> {t("form.btn_calc")}
        </button>
        <button
          type="reset"
          className="btn bg-gray-700 hover:bg-gray-600 text-white border-none shadow-md flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5" /> {t("form.btn_reset")}
        </button>
      </div>
    </form>
  );
};

export default TdeeForm;
