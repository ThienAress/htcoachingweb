import { useEffect, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { useModalScrollLock } from "../../../hooks/useModalScrollLock";
import RoundedSelect from "../assessment/RoundedSelect";
import { PHASE_EXPLANATIONS, PHASE_NAMES } from "../../../constants/f1Phases";
import {
  SPLIT_OPTIONS,
  WEEK_DAYS,
  applySuggestion,
  buildDesignDefaults,
  toCustomStage,
  toPreviewStage,
} from "../../../utils/f1StageDesign";
import F1StageListEditor from "./F1StageListEditor";
import F1StageOutcomeEditor from "./F1StageOutcomeEditor";

const PHASE_OPTIONS = Object.entries(PHASE_NAMES).map(([value, label]) => ({ value, label }));
const PHASE_TITLES = {
  phase_1: "Stabilization Endurance",
  phase_2: "Strength Endurance",
  phase_3: "Hypertrophy",
  phase_4: "Maximal Strength",
  phase_5: "Power",
};

const numberText = (label, min, max) =>
  z.string().trim().refine((value) => {
    const parsed = Number(value.replace(",", "."));
    return value !== "" && Number.isInteger(parsed) && parsed >= min && parsed <= max;
  }, `${label} từ ${min} đến ${max}`);

const schema = z.object({
  phaseKey: z.string().min(1),
  durationWeeks: numberText("Số tuần", 4, 16),
  objective: z.string().max(500, "Tối đa 500 ký tự"),
  entryReason: z.string().max(500, "Tối đa 500 ký tự"),
  keyFocus: z.array(z.object({ value: z.string().max(200) })),
  expectedChanges: z.array(z.object({ value: z.string().max(200) })),
  exitCriteria: z.array(z.object({ value: z.string().max(200) })),
  weeklySchedule: z.object({
    days: z.array(z.boolean()).refine((days) => days.some(Boolean), "Chọn ít nhất 1 buổi tập"),
    sessionMinutes: numberText("Thời lượng mỗi buổi", 15, 240),
    split: z.string(),
    note: z.string().max(200, "Tối đa 200 ký tự"),
  }),
  overrides: z.record(z.string(), z.string()),
});

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100";

const Section = ({ title, children, action = null }) => (
  <fieldset className="min-w-0 rounded-xl border border-slate-200 p-4">
    <legend className="px-1 text-sm font-bold text-slate-800">{title}</legend>
    {action && <div className="mb-3 flex justify-end">{action}</div>}
    {children}
  </fieldset>
);

const FieldError = ({ message }) => (message ? <p className="mt-1 text-xs font-medium text-red-600">{message}</p> : null);

// Bảng HLV tự thiết kế một giai đoạn: nội dung, lịch tập mỗi tuần và số dự kiến cuối giai đoạn.
const F1StageDesignDialog = ({ customer, stageOrder, plan, overrides, fetchPreview, previewKey, saving, onSave, onClose }) => {
  const closeRef = useRef(null);
  const filledRef = useRef(Boolean(plan));
  useModalScrollLock(true);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: buildDesignDefaults({ plan, overrides }),
  });

  const phaseKey = useWatch({ control, name: "phaseKey" });
  const weeks = useWatch({ control, name: "durationWeeks" });
  const days = useWatch({ control, name: "weeklySchedule.days" });
  const previewStage = toPreviewStage({ phaseKey, durationWeeks: weeks, days });
  const previewQuery = useQuery({
    queryKey: [...previewKey, previewStage],
    queryFn: () => fetchPreview(previewStage),
    staleTime: 60_000,
  });
  const preview = previewQuery.data?.data || null;

  // Lần đầu thiết kế: điền sẵn gợi ý của hệ thống để HLV sửa từ đó.
  useEffect(() => {
    if (filledRef.current || !preview?.suggestion) return;
    filledRef.current = true;
    reset(applySuggestion(getValues(), preview.suggestion));
  }, [preview, reset, getValues]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const sessions = (days || []).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 p-3 md:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="f1-stage-design-title" className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">
              {customer?.fullName} · {customer?.code || "--"}
            </p>
            <h2 id="f1-stage-design-title" className="text-2xl font-extrabold text-slate-800">
              Thiết kế giai đoạn {stageOrder}: {PHASE_TITLES[phaseKey]}
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={saving} aria-label="Đóng" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            <X size={18} />
          </button>
        </header>

        <form id="f1-stage-design-form" noValidate onSubmit={handleSubmit((values) => onSave(toCustomStage(values)))} className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
          <Section title="1. Giai đoạn và thời lượng">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Giai đoạn NASM</p>
                <Controller
                  control={control}
                  name="phaseKey"
                  render={({ field }) => (
                    <RoundedSelect label="Giai đoạn NASM" value={field.value} onChange={field.onChange} options={PHASE_OPTIONS} />
                  )}
                />
              </div>
              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Số tuần (4–16)
                <input inputMode="numeric" className={inputClass} {...register("durationWeeks")} />
                <FieldError message={errors.durationWeeks?.message} />
              </label>
            </div>
            <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-sm text-slate-700">
              <b className="text-orange-800">{PHASE_NAMES[phaseKey]}</b> · {PHASE_EXPLANATIONS[phaseKey]}
            </p>
          </Section>

          <Section title="2. Giải thích mục tiêu giai đoạn">
            <textarea rows={3} maxLength={500} aria-label="Giải thích mục tiêu giai đoạn" className={inputClass} {...register("objective")} />
            <FieldError message={errors.objective?.message} />
          </Section>

          <Section
            title="3. Nội dung giai đoạn"
            action={
              <button
                type="button"
                disabled={!preview?.suggestion}
                onClick={() => reset(applySuggestion(getValues(), preview.suggestion))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Sparkles size={14} aria-hidden="true" />
                Dùng gợi ý của hệ thống
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <F1StageListEditor control={control} register={register} name="keyFocus" label="Trọng tâm chính" />
              <F1StageListEditor control={control} register={register} name="expectedChanges" label="Thay đổi có thể thấy" />
              <F1StageListEditor control={control} register={register} name="exitCriteria" label="Khi nào nên chuyển tiếp" />
            </div>
          </Section>

          <Section title="4. Vì sao xếp như vậy">
            <textarea rows={3} maxLength={500} aria-label="Vì sao xếp như vậy" className={inputClass} {...register("entryReason")} />
            <FieldError message={errors.entryReason?.message} />
          </Section>

          <Section title="5. Lịch tập mỗi tuần">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Số buổi mỗi tuần
                <input readOnly value={sessions} className={`${inputClass} bg-slate-50`} />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-500">
                Thời lượng mỗi buổi (phút)
                <input inputMode="numeric" className={inputClass} {...register("weeklySchedule.sessionMinutes")} />
                <FieldError message={errors.weeklySchedule?.sessionMinutes?.message} />
              </label>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Cách chia buổi</p>
                <Controller
                  control={control}
                  name="weeklySchedule.split"
                  render={({ field }) => (
                    <RoundedSelect label="Cách chia buổi" value={field.value} onChange={field.onChange} options={SPLIT_OPTIONS} />
                  )}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Bấm từng ngày để chọn buổi tập hoặc nghỉ. Số buổi mỗi tuần tự tính theo số ngày đã chọn.</p>
            <Controller
              control={control}
              name="weeklySchedule.days"
              render={({ field }) => (
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Các ngày tập trong tuần">
                  {WEEK_DAYS.map((day, index) => {
                    const on = Boolean(field.value?.[index]);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        onClick={() => field.onChange(field.value.map((value, i) => (i === index ? !value : value)))}
                        className={`rounded-lg border px-2 py-2 text-center text-xs transition-colors ${
                          on ? "border-orange-300 bg-orange-50 text-orange-800" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{day}</span>
                        {on ? "Buổi tập" : "Nghỉ"}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            <FieldError message={errors.weeklySchedule?.days?.message} />
            <label className="mt-3 grid gap-1 text-xs font-medium text-slate-500">
              Ghi chú lịch tập
              <input maxLength={200} className={inputClass} {...register("weeklySchedule.note")} />
            </label>
          </Section>

          <Section title="6. Dự đoán cuối giai đoạn">
            <F1StageOutcomeEditor control={control} register={register} setValue={setValue} preview={preview} loading={previewQuery.isFetching} />
            {previewQuery.isError && (
              <p className="mt-2 text-xs font-medium text-red-600">Không tính được bảng dự đoán. Kiểm tra lại số tuần và lịch tập.</p>
            )}
          </Section>
        </form>

        <footer className="flex flex-wrap justify-between gap-3 border-t border-slate-200 px-6 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            Huỷ
          </button>
          <button type="submit" form="f1-stage-design-form" disabled={saving} className="rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-5 py-2.5 font-bold text-white shadow-md disabled:opacity-60">
            {saving ? "Đang lưu..." : `Lưu lộ trình giai đoạn ${stageOrder}`}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default F1StageDesignDialog;
