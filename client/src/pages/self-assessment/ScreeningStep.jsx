import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { CardSection, CheckboxGroup, InputField, StepActions } from "./FormControls";
import { PAIN_AREA_OPTIONS, WARNING_SIGN_OPTIONS } from "./constants";
import { screeningDefaults, screeningSchema, screeningToPayload } from "./formModel";

const ScreeningStep = ({ draft, onSubmit, pending }) => {
  const { control, register, handleSubmit, formState } = useForm({
    resolver: zodResolver(screeningSchema),
    defaultValues: screeningDefaults(draft),
  });
  const { errors } = formState;
  const hasPain = Number(useWatch({ control, name: "painLevel" }) || 0) > 0;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onSubmit(screeningToPayload(values)))}
      className="space-y-5"
    >
      <CardSection
        title="Quyền lưu dữ liệu"
        description="Đánh giá cần lưu thông tin sức khỏe của bạn. Chỉ bạn xem được dữ liệu này; huấn luyện viên và quản trị viên không đọc được."
      >
        <Controller
          control={control}
          name="allowDataStorage"
          render={({ field }) => (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
                className="mt-1 h-4 w-4 accent-orange-500"
              />
              <span>Tôi đồng ý cho phép lưu thông tin sức khỏe để phục vụ đánh giá và gợi ý tập luyện.</span>
            </label>
          )}
        />
        {errors.allowDataStorage && (
          <p role="alert" className="text-xs text-red-300">
            {errors.allowDataStorage.message}
          </p>
        )}
      </CardSection>

      <CardSection
        title="Dấu hiệu cần lưu ý"
        description="Chọn các dấu hiệu bạn đang gặp. Nếu có, hệ thống sẽ khuyên bạn gặp bác sĩ trước khi tự kiểm tra thể lực."
      >
        <CheckboxGroup legend="Bạn có gặp dấu hiệu nào dưới đây không?" name="warningSigns" control={control} options={WARNING_SIGN_OPTIONS} />
        <InputField
          label="Bác sĩ có dặn hạn chế vận động không?"
          name="doctorRestrictions"
          register={register}
          error={errors.doctorRestrictions?.message}
          hint="Để trống nếu không có."
          maxLength={500}
        />
      </CardSection>

      <CardSection title="Đau và chấn thương" description="Giúp hệ thống chọn bài tập phù hợp và tránh vùng đang đau.">
        <InputField
          label="Mức độ đau hiện tại (0 là không đau, 10 là đau nhất)"
          name="painLevel"
          type="number"
          inputMode="numeric"
          register={register}
          error={errors.painLevel?.message}
        />
        {hasPain && (
          <CheckboxGroup legend="Vùng đang đau" name="painLocation" control={control} options={PAIN_AREA_OPTIONS} />
        )}
        <InputField label="Chấn thương từng gặp" name="injuries" register={register} error={errors.injuries?.message} maxLength={500} />
        <InputField label="Bệnh lý hiện tại" name="currentConditions" register={register} error={errors.currentConditions?.message} maxLength={500} />
        <InputField label="Phẫu thuật từng có" name="surgeries" register={register} error={errors.surgeries?.message} maxLength={500} />
        <InputField label="Thuốc đang dùng" name="medications" register={register} error={errors.medications?.message} maxLength={500} />
      </CardSection>

      <StepActions submitLabel="Tiếp tục" pending={pending} />
    </form>
  );
};

export default ScreeningStep;
