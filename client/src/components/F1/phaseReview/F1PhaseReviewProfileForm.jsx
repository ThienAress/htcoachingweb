import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  healthScreeningSchema,
  lifestyleNutritionSchema,
  trainingGoalSchema,
} from "../intake/schema";
import StepHealthScreening from "../intake/StepHealthScreening";
import StepLifestyleNutrition from "../intake/StepLifestyleNutrition";
import StepTrainingGoal from "../intake/StepTrainingGoal";
import { SelectControlContext } from "../intake/selectControlContext";

const schema = z.object({
  healthScreening: healthScreeningSchema,
  lifestyleNutrition: lifestyleNutritionSchema,
  trainingProfileGoal: trainingGoalSchema,
});

const joined = (value) => (Array.isArray(value) ? value.join(", ") : value || "");

// Giá trị gợi ý lấy từ lần khảo sát hoặc lần cập nhật gần nhất để HLV chỉ sửa chỗ đổi.
const toDefaults = (profile = {}) => {
  const health = profile.healthScreening || {};
  const life = profile.lifestyleNutrition || {};
  const goal = profile.trainingProfileGoal || {};
  return {
    healthScreening: {
      hasPainNow: Boolean(health.hasPainNow),
      painLocation: joined(health.painLocation),
      painLevel: health.painLevel ?? 0,
      injuries: health.injuries || "",
      currentConditions: health.currentConditions || "",
      surgeries: health.surgeries || "",
      medications: health.medications || "",
      doctorRestrictions: health.doctorRestrictions || "",
      warningSigns: health.warningSigns || [],
    },
    lifestyleNutrition: {
      mealsPerDay: life.mealsPerDay ?? "",
      usuallyEatOut: Boolean(life.usuallyEatOut),
      foodAllergies: life.foodAllergies || "",
      drinkEnoughWater: Boolean(life.drinkEnoughWater),
      sleepHours: life.sleepHours ?? "",
      stressLevel: life.stressLevel || "",
      workActivityLevel: life.workActivityLevel || "",
    },
    trainingProfileGoal: {
      currentlyTraining: Boolean(goal.currentlyTraining),
      trainingDaysPerWeek: goal.trainingDaysPerWeek ?? "",
      sessionDurationMinutes: goal.sessionDurationMinutes ?? "",
      sportsHistory: joined(goal.sportsHistory),
      trainingExperience: goal.trainingExperience || "",
      breakDuration: goal.breakDuration || "",
      primaryGoal: goal.primaryGoal || "",
      targetWeightKg: goal.targetWeightKg ?? "",
      targetTimeframe: goal.targetTimeframe || "",
    },
  };
};

const F1PhaseReviewProfileForm = ({ stageOrder, defaults, saving, onSubmit, onCancel }) => {
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(defaults),
  });

  return (
    <form id="f1-phase-profile-form" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-slate-700">
        Cập nhật lại mục tiêu, sức khỏe và lối sống của khách cho giai đoạn {stageOrder}. Hệ thống dựa vào các thông tin
        này để dựng lộ trình và dự đoán giai đoạn {stageOrder}.
      </p>
      <SelectControlContext.Provider value={control}>
        <StepTrainingGoal register={register} watch={watch} setValue={setValue} errors={errors} />
        <StepHealthScreening register={register} watch={watch} setValue={setValue} errors={errors} />
        <StepLifestyleNutrition register={register} watch={watch} setValue={setValue} errors={errors} />
      </SelectControlContext.Provider>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          Quay lại
        </button>
        <button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-2.5 font-bold text-white shadow-md disabled:opacity-60">
          {saving ? "Đang lưu..." : `Lưu và dựng giai đoạn ${stageOrder}`}
        </button>
      </div>
    </form>
  );
};

export default F1PhaseReviewProfileForm;
