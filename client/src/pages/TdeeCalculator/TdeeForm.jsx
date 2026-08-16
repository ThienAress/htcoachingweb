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
}) => {
  const { t } = useTranslation("tdee");
  const inputClasses =
    "w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200 motion-reduce:transition-none";
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
          <label htmlFor="tdee-gender" className={labelClasses}>
            <Users className="w-4 h-4" /> {t("form.gender")}
          </label>
          <select
            id="tdee-gender"
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
          <label htmlFor="tdee-height" className={labelClasses}>
            <Ruler className="w-4 h-4" /> {t("form.height")}
          </label>
          <input
            id="tdee-height"
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
          <label htmlFor="tdee-weight" className={labelClasses}>
            <Weight className="w-4 h-4" /> {t("form.weight")}
          </label>
          <input
            id="tdee-weight"
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
          <label htmlFor="tdee-age" className={labelClasses}>
            <Cake className="w-4 h-4" /> {t("form.age")}
          </label>
          <input
            id="tdee-age"
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

        <fieldset className="md:col-span-2 rounded-2xl border border-gray-700 p-4 md:p-6">
          <legend className="px-2 text-sm font-semibold text-gray-200">
            <span className="inline-flex items-center gap-2">
              <Footprints className="h-4 w-4" /> {t("form.activity")}
            </span>
          </legend>
          <p className="mb-4 text-sm leading-6 text-gray-400">
            {t("form.activity_help")}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="tdee-daily-movement" className={labelClasses}>{t("form.daily_movement")}</label>
              <select id="tdee-daily-movement" name="dailyMovement" value={form.dailyMovement} onChange={handleChange} className={inputClasses}>
                <option value="">{t("form.select_evidence")}</option>
                <option value="mostly_seated">{t("form.movement_seated")}</option>
                <option value="mixed">{t("form.movement_mixed")}</option>
                <option value="mostly_moving">{t("form.movement_active")}</option>
                <option value="physical_work">{t("form.movement_physical")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="tdee-steps" className={labelClasses}>{t("form.steps")}</label>
              <select id="tdee-steps" name="steps" value={form.steps} onChange={handleChange} className={inputClasses}>
                <option value="">{t("form.select_evidence")}</option>
                <option value="under_5000">{t("form.steps_under_5000")}</option>
                <option value="between_5000_7999">{t("form.steps_5000_7999")}</option>
                <option value="between_8000_11999">{t("form.steps_8000_11999")}</option>
                <option value="at_least_12000">{t("form.steps_12000")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="tdee-training-frequency" className={labelClasses}>{t("form.training_frequency")}</label>
              <select id="tdee-training-frequency" name="trainingFrequency" value={form.trainingFrequency} onChange={handleChange} className={inputClasses}>
                <option value="">{t("form.select_evidence")}</option>
                <option value="none">{t("form.frequency_none")}</option>
                <option value="one_two">{t("form.frequency_1_2")}</option>
                <option value="three_four">{t("form.frequency_3_4")}</option>
                <option value="five_plus">{t("form.frequency_5_plus")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="tdee-training-duration" className={labelClasses}>{t("form.training_duration")}</label>
              <select
                id="tdee-training-duration"
                name="trainingDuration"
                value={form.trainingDuration}
                onChange={handleChange}
                disabled={form.trainingFrequency === "none"}
                className={`${inputClasses} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="">{t("form.select_evidence")}</option>
                <option value="none">{t("form.duration_none")}</option>
                <option value="under_30">{t("form.duration_under_30")}</option>
                <option value="between_30_45">{t("form.duration_30_45")}</option>
                <option value="between_45_60">{t("form.duration_45_60")}</option>
                <option value="over_60">{t("form.duration_over_60")}</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="tdee-training-intensity" className={labelClasses}>{t("form.training_intensity")}</label>
              <select
                id="tdee-training-intensity"
                name="trainingIntensity"
                value={form.trainingIntensity}
                onChange={handleChange}
                disabled={form.trainingFrequency === "none"}
                className={`${inputClasses} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="">{t("form.select_evidence")}</option>
                <option value="none">{t("form.intensity_none")}</option>
                <option value="easy">{t("form.intensity_easy")}</option>
                <option value="moderate">{t("form.intensity_moderate")}</option>
                <option value="vigorous">{t("form.intensity_vigorous")}</option>
              </select>
            </div>
          </div>
          <input type="hidden" name="activity" value={form.activity} readOnly />
          {errors.activity && (
            <p className="mt-3 flex items-center gap-1 text-sm text-red-400">
              <AlertTriangle className="h-3 w-3" /> {errors.activity}
            </p>
          )}
        </fieldset>
        {/* Công thức */}
        <div>
          <label htmlFor="tdee-formula" className={labelClasses}>
            <Calculator className="w-4 h-4" /> {t("form.formula")}
          </label>
          <select
            id="tdee-formula"
            name="formula"
            value={form.formula}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="">{t("form.select_formula")}</option>
            <option value="Mifflin-St Jeor">Mifflin-St Jeor</option>
            <option value="Katch-McArdle">Katch-McArdle</option>
          </select>
          {form.formula === "Mifflin-St Jeor" && !errors.formula && (
            <p className="mt-1.5 text-xs leading-5 text-gray-400">
              {t("form.formula_recommended")}
            </p>
          )}
          {errors.formula && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errors.formula}
            </p>
          )}
        </div>

        {/* Body Fat (chỉ hiện khi chọn Katch-McArdle) */}
        {form.formula === "Katch-McArdle" && (
          <div>
            <label htmlFor="tdee-bodyfat" className={labelClasses}>
              <Droplet className="w-4 h-4" /> {t("form.bodyfat")}
            </label>
            <input
              id="tdee-bodyfat"
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
          <label htmlFor="tdee-goal" className={labelClasses}>
            <Target className="w-4 h-4" /> {t("form.goal")}
          </label>
          <select
            id="tdee-goal"
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
            <label htmlFor="tdee-calorie-adjustment" className={labelClasses}>
              <BarChart3 className="w-4 h-4" /> {t("form.calorie_adj")}
            </label>
            <div className="relative">
              <input
                id="tdee-calorie-adjustment"
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
