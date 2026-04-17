// StepTrainingGoal.jsx
import {
  Target,
  Dumbbell,
  Clock,
  Calendar,
  TrendingUp,
  RotateCcw,
} from "lucide-react";

const Field = ({ label, helperText, error, icon: Icon, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-amber-500" />}
        {label}
      </span>
      <input
        {...props}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-100"
            : "border-slate-200 focus:border-amber-400 focus:ring-amber-100"
        }`}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </label>
  );
};

const SelectField = ({
  label,
  options = [],
  helperText,
  error,
  icon: Icon,
  ...props
}) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-amber-500" />}
        {label}
      </span>
      <select
        {...props}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-100"
            : "border-slate-200 focus:border-amber-400 focus:ring-amber-100"
        }`}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </label>
  );
};

const SwitchRow = ({ label, checked, onChange, icon: Icon }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md md:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon && <Icon size={18} className="mt-0.5 text-amber-500" />}
          <div>
            <span className="text-sm font-bold text-slate-800">{label}</span>
            <p className="mt-1 text-xs text-slate-500">
              Chọn đúng tình trạng tập luyện hiện tại của khách hàng
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative h-7 w-14 shrink-0 rounded-full transition ${
            checked ? "bg-amber-500" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
              checked ? "left-8" : "left-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
};

const experienceOptions = [
  { label: "Chọn mức kinh nghiệm", value: "" },
  { label: "Chưa từng tập", value: "none" },
  { label: "Mới", value: "beginner" },
  { label: "Trung bình", value: "intermediate" },
  { label: "Lâu năm", value: "advanced" },
];

const goalOptions = [
  { label: "Chọn mục tiêu", value: "" },
  { label: "Giảm mỡ", value: "fat_loss" },
  { label: "Tăng cân", value: "weight_gain" },
  { label: "Tăng cơ", value: "muscle_gain" },
  { label: "Duy trì", value: "maintenance" },
];

const StepTrainingGoal = ({ value, onChange, errors = {} }) => {
  const isCurrentlyTraining = Boolean(value.currentlyTraining);
  const hasPreviousTraining =
    value.trainingExperience &&
    value.trainingExperience !== "" &&
    value.trainingExperience !== "none";
  const isNeverTrained = value.trainingExperience === "none";

  const handleCurrentlyTrainingChange = (checked) => {
    onChange("currentlyTraining", checked);
    if (!checked) {
      onChange("trainingDaysPerWeek", 0);
      onChange("sessionDurationMinutes", 0);
    }
  };

  const handleExperienceChange = (nextValue) => {
    onChange("trainingExperience", nextValue);
    if (nextValue === "none") {
      onChange("breakDuration", "");
      onChange("sportsHistory", "");
    }
  };

  const handleNumberInput = (field, rawValue) => {
    const onlyNumber = rawValue.replace(/\D/g, "");
    onChange(field, onlyNumber === "" ? "" : Number(onlyNumber));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
        <Target size={20} className="text-amber-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">
            Tập luyện & Mục tiêu
          </h3>
          <p className="text-sm text-slate-500">
            Thông tin về thói quen tập luyện và mục tiêu của khách hàng.
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SwitchRow
          label="Hiện tại có đang tập không?"
          icon={Dumbbell}
          checked={isCurrentlyTraining}
          onChange={handleCurrentlyTrainingChange}
        />

        {isCurrentlyTraining ? (
          <>
            <Field
              label="Số ngày tập/tuần"
              icon={Calendar}
              type="number"
              min="0"
              max="14"
              value={value.trainingDaysPerWeek ?? ""}
              onChange={(e) =>
                handleNumberInput("trainingDaysPerWeek", e.target.value)
              }
              helperText="Ví dụ: 3, 4, 5 buổi/tuần"
              error={errors.trainingDaysPerWeek}
            />
            <Field
              label="Mỗi buổi tập bao lâu (phút)"
              icon={Clock}
              type="number"
              min="0"
              max="600"
              value={value.sessionDurationMinutes ?? ""}
              onChange={(e) =>
                handleNumberInput("sessionDurationMinutes", e.target.value)
              }
              helperText="Ví dụ: 60 phút"
              error={errors.sessionDurationMinutes}
            />
            <SelectField
              label="Kinh nghiệm tập luyện"
              icon={TrendingUp}
              value={value.trainingExperience || ""}
              onChange={(e) => handleExperienceChange(e.target.value)}
              options={experienceOptions}
              helperText="Chọn mức kinh nghiệm hiện tại gần đúng nhất"
              error={errors.trainingExperience}
            />
            <Field
              label="Các môn đã từng tập"
              icon={Dumbbell}
              value={value.sportsHistory || ""}
              onChange={(e) => onChange("sportsHistory", e.target.value)}
              placeholder="Gym, chạy bộ, boxing..."
              helperText="Có thể nhập nhiều môn, cách nhau bằng dấu phẩy"
            />
          </>
        ) : (
          <>
            <SelectField
              label="Trước đây đã từng tập chưa?"
              icon={RotateCcw}
              value={value.trainingExperience || ""}
              onChange={(e) => handleExperienceChange(e.target.value)}
              options={experienceOptions}
              helperText="Nếu khách chưa từng tập, chọn 'Chưa từng tập'"
              error={errors.trainingExperience}
            />
            {hasPreviousTraining ? (
              <>
                <Field
                  label="Đã nghỉ tập bao lâu"
                  icon={Clock}
                  value={value.breakDuration || ""}
                  onChange={(e) => onChange("breakDuration", e.target.value)}
                  placeholder="Ví dụ: 6 tháng"
                  helperText="Chỉ nhập khi khách đã từng tập nhưng hiện đang nghỉ"
                  error={errors.breakDuration}
                />
                <Field
                  label="Các môn đã từng tập"
                  icon={Dumbbell}
                  value={value.sportsHistory || ""}
                  onChange={(e) => onChange("sportsHistory", e.target.value)}
                  placeholder="Gym, chạy bộ, boxing..."
                  helperText="Giúp AI hiểu nền vận động trước đây của khách"
                />
              </>
            ) : isNeverTrained ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:col-span-1">
                Khách chưa từng tập luyện trước đây, nên không cần nhập thêm
                lịch sử tập cũ.
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-1">
                Vui lòng chọn khách chưa từng tập hay đã từng tập để tiếp tục.
              </div>
            )}
          </>
        )}

        <SelectField
          label="Mục tiêu chính"
          icon={Target}
          value={value.primaryGoal || ""}
          onChange={(e) => onChange("primaryGoal", e.target.value)}
          options={goalOptions}
          error={errors.primaryGoal}
        />

        <Field
          label="Cân nặng mong muốn (kg)"
          icon={TrendingUp}
          type="number"
          min="0"
          value={value.targetWeightKg ?? ""}
          onChange={(e) => handleNumberInput("targetWeightKg", e.target.value)}
          helperText="Có thể để trống nếu khách chưa xác định rõ"
          error={errors.targetWeightKg}
        />

        <Field
          label="Thời gian mong muốn"
          icon={Calendar}
          type="date"
          value={value.targetDeadline || ""}
          onChange={(e) => onChange("targetDeadline", e.target.value)}
          helperText="Có thể để trống nếu khách chưa có deadline cụ thể"
          error={errors.targetDeadline}
        />
      </div>
    </div>
  );
};

export default StepTrainingGoal;
