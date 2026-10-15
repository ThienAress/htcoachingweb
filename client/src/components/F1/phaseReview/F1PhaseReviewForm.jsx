import { Controller, useForm, useWatch } from "react-hook-form";
import RoundedSelect from "../assessment/RoundedSelect";
import F1PhaseReviewSquat from "./F1PhaseReviewSquat";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TIER_LABELS } from "../../../utils/assessmentExercises";
import {
  LEVEL_LABELS,
  QUALITY_OPTIONS,
  STATUS_OPTIONS,
  buildFormDefaults,
  RESULT_LABELS,
  canAutoScore,
  computeBmi,
  describePrevious,
  retestLevel,
  retestMode,
} from "../../../utils/f1PhaseReview";

const numberField = (label, { min, max, required = false, integer = false }) =>
  z.string().trim().superRefine((value, ctx) => {
    if (!value) {
      if (required) ctx.addIssue({ code: "custom", message: `Nhập ${label}` });
      return;
    }
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
      ctx.addIssue({ code: "custom", message: `${label} không hợp lệ` });
    }
  });

const schema = z
  .object({
    measuredAt: z.string().min(1, "Chọn ngày đo"),
    actual: z.object({
      weightKg: numberField("Cân nặng", { min: 10, max: 300, required: true }),
      waistCm: numberField("Vòng eo", { min: 30, max: 250 }),
      hipCm: numberField("Vòng hông", { min: 30, max: 250 }),
      bodyFatPercent: numberField("Tỷ lệ mỡ", { min: 2, max: 70 }),
      restingHeartRate: numberField("Nhịp tim nghỉ", { min: 30, max: 220, integer: true }),
    }),
    adherence: z.object({
      plannedSessions: numberField("Số buổi theo kế hoạch", { min: 1, max: 400, required: true, integer: true }),
      completedSessions: numberField("Số buổi đã tập", { min: 0, max: 400, required: true, integer: true }),
      nutrition: z.string(),
      sleep: z.string(),
    }),
    recommendationChecks: z.array(
      z.object({ text: z.string(), status: z.string().min(1, "Chọn mức đã làm") }),
    ),
    retests: z.array(z.any()),
    ohsa: z.object({
      items: z.array(
        z
          .object({
            view: z.string(),
            key: z.string(),
            label: z.string(),
            status: z.string(),
            fixed: z.boolean(),
          })
          .superRefine((item, ctx) => {
            if (item.status !== "new") return;
            if (!item.view) ctx.addIssue({ code: "custom", path: ["view"], message: "Chọn góc nhìn" });
            if (!item.label.trim()) ctx.addIssue({ code: "custom", path: ["label"], message: "Nhập biểu hiện" });
          }),
      ),
    }),
    safety: z.object({
      newPain: z.boolean(),
      newInjury: z.boolean(),
      warningSigns: z.boolean(),
      note: z.string().max(200, "Tối đa 200 ký tự"),
    }),
  })
  .refine(
    (values) => Number(values.adherence.completedSessions) <= Number(values.adherence.plannedSessions) * 2,
    { path: ["adherence", "completedSessions"], message: "Số buổi đã tập lớn bất thường" },
  );

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";

const Field = ({ id, label, error, children }) => (
  <label htmlFor={id} className="grid gap-1 text-xs font-medium text-slate-500">
    {label}
    {children}
    {error && <span className="text-xs font-medium text-red-600">{error}</span>}
  </label>
);

const Group = ({ title, children }) => (
  <fieldset className="min-w-0 rounded-xl border border-slate-200 p-4">
    <legend className="px-1 text-sm font-bold text-slate-800">{title}</legend>
    {children}
  </fieldset>
);

const Check = ({ id, label, register, name }) => (
  <label htmlFor={id} className="flex items-center gap-2 py-1.5 text-sm text-slate-700">
    <input id={id} type="checkbox" className="h-4 w-4 accent-orange-600" {...register(name)} />
    {label}
  </label>
);

const F1PhaseReviewForm = ({ stageOrder, context, review, saving, onSubmit, onCancel }) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: buildFormDefaults(context, review),
    resolver: zodResolver(schema),
  });
  const retests = useWatch({ control, name: "retests" });
  const weight = useWatch({ control, name: "actual.weightKg" });
  const bmi = computeBmi(weight, context.heightCm);
  const id = (name) => `phase-review-${stageOrder}-${name}`;
  const metricInput = (name, label, unit) => (
    <Field id={id(name)} label={`${label}${unit ? ` (${unit})` : ""}`} error={errors.actual?.[name]?.message}>
      <input id={id(name)} inputMode="decimal" className={inputClass} {...register(`actual.${name}`)} />
    </Field>
  );

  return (
    <form id="f1-phase-review-form" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Group title="1. Chỉ số đo lại">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id={id("date")} label="Ngày đo" error={errors.measuredAt?.message}>
            <input id={id("date")} type="date" className={inputClass} {...register("measuredAt")} />
          </Field>
          {metricInput("weightKg", "Cân nặng", "kg")}
          <Field id={id("bmi")} label="BMI (tự tính theo cân nặng mới)">
            <input id={id("bmi")} readOnly value={bmi ?? ""} placeholder="Nhập cân nặng để tính" className={`${inputClass} bg-slate-50 text-slate-600`} />
          </Field>
          {metricInput("waistCm", "Vòng eo", "cm")}
          {metricInput("hipCm", "Vòng hông", "cm")}
          {metricInput("bodyFatPercent", "Tỷ lệ mỡ", "%")}
          {metricInput("restingHeartRate", "Nhịp tim nghỉ", "bpm")}
        </div>
      </Group>

      <Group title="2. Tuân thủ">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field id={id("planned")} label="Buổi theo kế hoạch" error={errors.adherence?.plannedSessions?.message}>
            <input id={id("planned")} inputMode="numeric" className={inputClass} {...register("adherence.plannedSessions")} />
          </Field>
          <Field id={id("completed")} label="Buổi đã tập" error={errors.adherence?.completedSessions?.message}>
            <input id={id("completed")} inputMode="numeric" className={inputClass} {...register("adherence.completedSessions")} />
          </Field>
          {[
            ["nutrition", "Ăn uống theo hướng dẫn"],
            ["sleep", "Giấc ngủ"],
          ].map(([name, label]) => (
            <Field key={name} id={id(name)} label={label}>
              <Controller
                control={control}
                name={`adherence.${name}`}
                render={({ field }) => (
                  <RoundedSelect label={label} value={field.value} onChange={field.onChange} options={QUALITY_OPTIONS} />
                )}
              />
            </Field>
          ))}
        </div>
      </Group>

      {context.recommendations?.length > 0 && (
        <Group title={`3. Lời khuyên giai đoạn ${stageOrder}`}>
          <div className="divide-y divide-slate-100">
            {context.recommendations.map((text, index) => (
              <div key={text} className="grid gap-2 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="text-sm text-slate-700">{text}</span>
                <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={text}>
                  {STATUS_OPTIONS.map((option) => (
                    <label key={option.value} className="cursor-pointer">
                      <input
                        type="radio"
                        value={option.value}
                        className="peer sr-only"
                        {...register(`recommendationChecks.${index}.status`)}
                      />
                      <span className="inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 peer-checked:border-orange-300 peer-checked:bg-orange-50 peer-checked:text-orange-800 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-300">
                        {option.label}
                      </span>
                    </label>
                  ))}
                  {errors.recommendationChecks?.[index]?.status && (
                    <span className="ml-1 text-xs font-medium text-red-600">Chọn mức đã làm</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Group>
      )}

      {retests?.length > 0 && (
        <Group title={`4. Test lại các bài của giai đoạn ${stageOrder}`}>
          <div className="divide-y divide-slate-100">
            {retests.map((item, index) => {
              const mode = retestMode(item);
              const previous = describePrevious(item);
              const level = retestLevel(item);
              return (
                <div key={`${item.metricKey}-${item.name}`} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.6fr))_minmax(0,1fr)] sm:items-end">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {[item.metricLabel, TIER_LABELS[item.tier]].filter(Boolean).join(" · ")}
                    </p>
                    {previous && <p className="text-xs text-slate-500">Lần trước: {previous}</p>}
                  </div>
                  {mode === "result" ? (
                    <div className="sm:col-span-2">
                      <Field id={id(`result-${index}`)} label={RESULT_LABELS[item.resultKind]}>
                        <input id={id(`result-${index}`)} inputMode="decimal" className={inputClass} {...register(`retests.${index}.result`)} />
                      </Field>
                    </div>
                  ) : (
                    <>
                      <Field id={id(`sets-${index}`)} label="Số hiệp">
                        <input id={id(`sets-${index}`)} inputMode="numeric" className={inputClass} {...register(`retests.${index}.sets`)} />
                      </Field>
                      {mode === "time" ? (
                        <Field id={id(`time-${index}`)} label="Giây mỗi hiệp">
                          <input id={id(`time-${index}`)} inputMode="numeric" className={inputClass} {...register(`retests.${index}.durationSec`)} />
                        </Field>
                      ) : (
                        <Field id={id(`reps-${index}`)} label="Reps mỗi hiệp">
                          <input id={id(`reps-${index}`)} inputMode="numeric" className={inputClass} {...register(`retests.${index}.reps`)} />
                        </Field>
                      )}
                    </>
                  )}
                  {canAutoScore(item) ? (
                    <p className="text-xs text-slate-500">
                      Nay: <b className="text-slate-800">{LEVEL_LABELS[level] || "Chưa nhập"}</b>
                    </p>
                  ) : (
                    <Field id={id(`level-${index}`)} label={`Mức hiện tại (trước: ${LEVEL_LABELS[item.previousLevel] || "chưa có"})`}>
                      <Controller
                        control={control}
                        name={`retests.${index}.manualLevel`}
                        render={({ field }) => (
                          <RoundedSelect
                            label={`Mức hiện tại của ${item.name}`}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Chưa test lại"
                            options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))}
                          />
                        )}
                      />
                    </Field>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Mức được chấm theo cùng chuẩn với lần đánh giá ban đầu. Bài để trống sẽ không tính điểm.
          </p>
        </Group>
      )}

      <Group title="5. Squat tay qua đầu (Overhead Squat)">
        <F1PhaseReviewSquat control={control} errors={errors} idPrefix={id("ohsa")} />
      </Group>

      <Group title="6. An toàn">
        <div>
          <div>
            <p className="text-xs font-medium text-slate-500">Trong giai đoạn vừa qua, khách có</p>
            <Check id={id("pain")} label="Đau mới xuất hiện" register={register} name="safety.newPain" />
            <Check id={id("injury")} label="Chấn thương mới" register={register} name="safety.newInjury" />
            <Check id={id("warning")} label="Dấu hiệu cảnh báo (chóng mặt, đau ngực, khó thở bất thường)" register={register} name="safety.warningSigns" />
          </div>
        </div>
        <div className="mt-2">
          <Field id={id("note")} label="Ghi chú an toàn (nếu có)" error={errors.safety?.note?.message}>
            <input id={id("note")} maxLength={200} className={inputClass} {...register("safety.note")} />
          </Field>
        </div>
      </Group>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          Huỷ
        </button>
        <button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-2.5 font-bold text-white shadow-md disabled:opacity-60">
          {saving ? "Đang lưu..." : "Lưu và đánh giá"}
        </button>
      </div>
    </form>
  );
};

export default F1PhaseReviewForm;
