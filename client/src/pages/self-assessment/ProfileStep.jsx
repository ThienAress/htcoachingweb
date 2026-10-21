import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { CardSection, ChoiceField, InputField, StepActions } from "./FormControls";
import {
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  STRESS_OPTIONS,
  TRAINING_NOW_OPTIONS,
  WORK_ACTIVITY_OPTIONS,
} from "./constants";
import { profileDefaults, profileSchema, profileToPayload } from "./formModel";

const ProfileStep = ({ source, onSubmit, onBack, pending }) => {
  const { control, register, handleSubmit, formState } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: profileDefaults(source),
  });
  const { errors } = formState;
  const err = (name) => errors[name]?.message;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onSubmit(profileToPayload(values)))}
      className="space-y-5"
    >
      <CardSection title="Số đo cơ bản" description="Dùng để tra bảng chuẩn, tính chỉ số cơ thể và vùng nhịp tim.">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Tuổi" name="age" type="number" inputMode="numeric" register={register} error={err("age")} />
          <ChoiceField
            label="Giới tính sinh học"
            name="gender"
            control={control}
            options={GENDER_OPTIONS}
            error={err("gender")}
            hint="Dùng để đối chiếu bảng chuẩn thể lực."
          />
          <InputField label="Chiều cao (cm)" name="heightCm" type="number" inputMode="decimal" register={register} error={err("heightCm")} />
          <InputField label="Cân nặng (kg)" name="weightKg" type="number" inputMode="decimal" register={register} error={err("weightKg")} />
          <InputField label="Vòng eo (cm)" name="waistCm" type="number" inputMode="decimal" register={register} error={err("waistCm")} hint="Không bắt buộc." />
          <InputField label="Vòng hông (cm)" name="hipCm" type="number" inputMode="decimal" register={register} error={err("hipCm")} hint="Không bắt buộc." />
          <InputField
            label="Nhịp tim nghỉ (lần/phút)"
            name="restingHeartRate"
            type="number"
            inputMode="numeric"
            register={register}
            error={err("restingHeartRate")}
            hint="Đo lúc vừa thức dậy; không bắt buộc nhưng giúp tính vùng nhịp tim."
          />
          <InputField label="Số giờ ngủ mỗi đêm" name="sleepHours" type="number" inputMode="decimal" register={register} error={err("sleepHours")} hint="Không bắt buộc." />
          <ChoiceField label="Mức căng thẳng" name="stressLevel" control={control} options={STRESS_OPTIONS} error={err("stressLevel")} />
          <ChoiceField label="Tính chất công việc" name="workActivityLevel" control={control} options={WORK_ACTIVITY_OPTIONS} error={err("workActivityLevel")} />
        </div>
      </CardSection>

      <CardSection title="Hồ sơ tập luyện" description="Giúp chọn giai đoạn bắt đầu và số buổi tập phù hợp.">
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField label="Tình trạng hiện tại" name="currentlyTraining" control={control} options={TRAINING_NOW_OPTIONS} error={err("currentlyTraining")} />
          <ChoiceField label="Kinh nghiệm tập" name="trainingExperience" control={control} options={EXPERIENCE_OPTIONS} error={err("trainingExperience")} />
          <InputField label="Số buổi tập mỗi tuần" name="trainingDaysPerWeek" type="number" inputMode="numeric" register={register} error={err("trainingDaysPerWeek")} hint="Không bắt buộc." />
          <InputField label="Thời lượng mỗi buổi (phút)" name="sessionDurationMinutes" type="number" inputMode="numeric" register={register} error={err("sessionDurationMinutes")} hint="Không bắt buộc." />
          <InputField label="Đã nghỉ tập bao lâu?" name="breakDuration" register={register} error={err("breakDuration")} hint="Ví dụ: 3 tháng. Để trống nếu không nghỉ." maxLength={60} />
          <ChoiceField label="Mục tiêu chính" name="primaryGoal" control={control} options={GOAL_OPTIONS} error={err("primaryGoal")} />
          <ChoiceField label="Dụng cụ có sẵn" name="equipment" control={control} options={EQUIPMENT_OPTIONS} error={err("equipment")} />
        </div>
      </CardSection>

      <StepActions onBack={onBack} submitLabel="Tiếp tục" pending={pending} />
    </form>
  );
};

export default ProfileStep;
