import React from "react";
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
            <Users className="w-4 h-4" /> Giới tính
          </label>
          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="">------</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
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
            <Ruler className="w-4 h-4" /> Chiều cao (cm)
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
            <Weight className="w-4 h-4" /> Cân nặng (kg)
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
            <Cake className="w-4 h-4" /> Tuổi
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
            <Footprints className="w-4 h-4" /> Hệ số vận động
          </label>
          <select
            name="activity"
            value={form.activity}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="">-- Chọn mức độ --</option>
            <option value="1.2">Ít vận động</option>
            <option value="1.375">Vận động nhẹ (1–3 buổi/tuần)</option>
            <option value="1.55">Vận động vừa (3–5 buổi/tuần)</option>
            <option value="1.725">Vận động nhiều (6–7 buổi/tuần)</option>
            <option value="1.9">Vận động rất nhiều (2 buổi/ngày)</option>
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
            <Calculator className="w-4 h-4" /> Tính theo công thức
          </label>
          <select
            name="formula"
            value={form.formula}
            onChange={handleChange}
            className={inputClasses}
          >
            <option value="">-- Chọn công thức --</option>
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
              <Droplet className="w-4 h-4" /> Body Fat (%)
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
            <Target className="w-4 h-4" /> Mục tiêu của bạn
          </label>
          <select
            name="goal"
            value={form.goal}
            onChange={(e) => {
              const prev = form.goal;
              handleChange(e);
              if (prev && prev !== e.target.value) setGoalNotice(true);
              else setGoalNotice(false);
            }}
            className={inputClasses}
          >
            <option value="">-- Chọn mục tiêu --</option>
            <option value="gain">Tăng cơ</option>
            <option value="lose">Giảm mỡ</option>
            <option value="maintain">Duy trì</option>
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
      </div>

      <div className="flex flex-wrap justify-center gap-5 mt-10">
        <button
          type="submit"
          className="btn btn-primary shadow-lg shadow-primary/30 flex items-center gap-2"
        >
          <BarChart3 className="w-5 h-5" /> Xem kết quả
        </button>
        <button
          type="reset"
          className="btn bg-gray-700 hover:bg-gray-600 text-white border-none shadow-md flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5" /> Đặt lại
        </button>
      </div>
    </form>
  );
};

export default TdeeForm;
