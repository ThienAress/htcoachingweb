// StepTrainingGoal.jsx
import {
  Target,
  Dumbbell,
  Clock,
  Calendar,
  TrendingUp,
  RotateCcw,
} from "lucide-react";

const Field = ({ label, helperText, error, registration, icon: Icon, ...props }) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label}
      </span>
      <input
        {...registration}
        {...props}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-100"
            : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
        }`}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-500">{error.message}</p>
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
  registration,
  icon: Icon,
  ...props
}) => {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {Icon && <Icon size={16} className="text-orange-500" />}
        {label}
      </span>
      <select
        {...registration}
        {...props}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:ring-2 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-100"
            : "border-slate-200 focus:border-orange-400 focus:ring-orange-100"
        }`}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-xs text-red-500">{error.message}</p>
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
          {Icon && <Icon size={18} className="mt-0.5 text-orange-500" />}
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
            checked ? "bg-orange-500" : "bg-slate-300"
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

const StepTrainingGoal = ({ register, watch, setValue, errors = {} }) => {
  const isCurrentlyTraining = Boolean(watch("trainingProfileGoal.currentlyTraining"));
  const trainingExperience = watch("trainingProfileGoal.trainingExperience");
  
  const hasPreviousTraining =
    trainingExperience &&
    trainingExperience !== "" &&
    trainingExperience !== "none";
  const isNeverTrained = trainingExperience === "none";

  const handleCurrentlyTrainingChange = (checked) => {
    setValue("trainingProfileGoal.currentlyTraining", checked, { shouldValidate: true });
    if (!checked) {
      setValue("trainingProfileGoal.trainingDaysPerWeek", "");
      setValue("trainingProfileGoal.sessionDurationMinutes", "");
    }
  };

  const handleExperienceChange = (e) => {
    const nextValue = e.target.value;
    setValue("trainingProfileGoal.trainingExperience", nextValue, { shouldValidate: true });
    if (nextValue === "none") {
      setValue("trainingProfileGoal.breakDuration", "");
      setValue("trainingProfileGoal.sportsHistory", "");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
        <Target size={20} className="text-orange-600" />
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
              registration={register("trainingProfileGoal.trainingDaysPerWeek")}
              error={errors?.trainingProfileGoal?.trainingDaysPerWeek}
              helperText="Ví dụ: 3, 4, 5 buổi/tuần"
            />
            <Field
              label="Mỗi buổi tập bao lâu (phút)"
              icon={Clock}
              type="number"
              min="0"
              max="600"
              registration={register("trainingProfileGoal.sessionDurationMinutes")}
              error={errors?.trainingProfileGoal?.sessionDurationMinutes}
              helperText="Ví dụ: 60 phút"
            />
            <SelectField
              label="Kinh nghiệm tập luyện"
              icon={TrendingUp}
              registration={register("trainingProfileGoal.trainingExperience")}
              onChange={handleExperienceChange}
              options={experienceOptions}
              error={errors?.trainingProfileGoal?.trainingExperience}
              helperText="Chọn mức kinh nghiệm hiện tại gần đúng nhất"
            />
            <Field
              label="Các môn đã từng tập"
              icon={Dumbbell}
              registration={register("trainingProfileGoal.sportsHistory")}
              error={errors?.trainingProfileGoal?.sportsHistory}
              placeholder="Gym, chạy bộ, boxing..."
              helperText="Có thể nhập nhiều môn, cách nhau bằng dấu phẩy"
            />
          </>
        ) : (
          <>
            <SelectField
              label="Trước đây đã từng tập chưa?"
              icon={RotateCcw}
              registration={register("trainingProfileGoal.trainingExperience")}
              onChange={handleExperienceChange}
              options={experienceOptions}
              error={errors?.trainingProfileGoal?.trainingExperience}
              helperText="Nếu khách chưa từng tập, chọn 'Chưa từng tập'"
            />
            {hasPreviousTraining ? (
              <>
                <Field
                  label="Đã nghỉ tập bao lâu"
                  icon={Clock}
                  registration={register("trainingProfileGoal.breakDuration")}
                  error={errors?.trainingProfileGoal?.breakDuration}
                  placeholder="Ví dụ: 6 tháng"
                  helperText="Chỉ nhập khi khách đã từng tập nhưng hiện đang nghỉ"
                />
                <Field
                  label="Các môn đã từng tập"
                  icon={Dumbbell}
                  registration={register("trainingProfileGoal.sportsHistory")}
                  error={errors?.trainingProfileGoal?.sportsHistory}
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
          registration={register("trainingProfileGoal.primaryGoal")}
          error={errors?.trainingProfileGoal?.primaryGoal}
          options={goalOptions}
        />

        <Field
          label="Cân nặng mong muốn (kg)"
          icon={TrendingUp}
          type="number"
          min="0"
          registration={register("trainingProfileGoal.targetWeightKg")}
          error={errors?.trainingProfileGoal?.targetWeightKg}
          helperText="Có thể để trống nếu khách chưa xác định rõ"
        />

        <Field
          label="Thời gian mong muốn"
          icon={Calendar}
          type="date"
          registration={register("trainingProfileGoal.targetDeadline")}
          error={errors?.trainingProfileGoal?.targetDeadline}
          helperText="Có thể để trống nếu khách chưa có deadline cụ thể"
        />
      </div>
    </div>
  );
};

export default StepTrainingGoal;
