// ExerciseTestCard.jsx — thẻ chọn bài test dùng chung cho Sức mạnh / Sức bền / Tim mạch
import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  scoreAgainstProtocol,
  scoreToLevel,
} from "../../../utils/assessment.helpers";
import {
  LEVEL_OPTIONS,
  MAX_EXERCISES_PER_METRIC,
  MAX_EXERCISE_NAME_LENGTH,
  TIER_LABELS,
  TIER_OPTIONS,
  aggregateExercises,
  canAddExercise,
  createExercise,
  describeTopResult,
  getSuggestionTiers,
  pickProtocol,
} from "../../../utils/assessmentExercises";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100";
const readOnlyClass =
  "w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 outline-none";

const levelLabel = (level) =>
  LEVEL_OPTIONS.find((item) => item.value === level)?.label || "";

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
    {children}
  </label>
);

const positiveInput = (onChange) => (event) => {
  const next = event.target.value;
  if (next !== "" && Number(next) < 1) return;
  onChange(next);
};

const ExerciseRow = ({
  exercise,
  scoring,
  protocolOptions,
  resultLabel,
  resultPlaceholder,
  onPatch,
  onRemove,
}) => {
  const isCustom = exercise.source === "custom";
  const topResult = describeTopResult(
    pickProtocol(exercise.inputMode, protocolOptions),
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">{exercise.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {isCustom ? "Bài riêng của HLV" : TIER_LABELS[exercise.tier] || "Bài hệ thống"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Bỏ bài ${exercise.name}`}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {scoring === "protocol" && (
          <>
            <Field label="Cách ghi kết quả">
              <select
                className={inputClass}
                value={exercise.inputMode}
                onChange={(e) => onPatch({ inputMode: e.target.value })}
              >
                <option value="">Chọn cách ghi</option>
                <option value="reps">Theo số lần (reps)</option>
                <option value="time">Theo thời gian (giây)</option>
              </select>
            </Field>
            <Field label="Số hiệp (set)">
              <input
                type="number"
                min="1"
                className={inputClass}
                value={exercise.sets ?? ""}
                onChange={positiveInput((sets) => onPatch({ sets }))}
                placeholder="Ví dụ: 3"
              />
            </Field>
            {exercise.inputMode === "reps" && (
              <Field label="Số lần mỗi hiệp (reps)">
                <input
                  type="number"
                  min="1"
                  className={inputClass}
                  value={exercise.reps ?? ""}
                  onChange={positiveInput((reps) => onPatch({ reps }))}
                  placeholder="Ví dụ: 10"
                />
              </Field>
            )}
            {exercise.inputMode === "time" && (
              <Field label="Thời gian mỗi hiệp (giây)">
                <input
                  type="number"
                  min="1"
                  className={inputClass}
                  value={exercise.durationSec ?? ""}
                  onChange={positiveInput((durationSec) => onPatch({ durationSec }))}
                  placeholder="Ví dụ: 20"
                />
              </Field>
            )}
            {topResult && (
              <p className="text-xs text-slate-500 sm:col-span-2">
                Đạt mức Tốt khi hoàn thành {topResult}. Làm ít hơn thì hệ thống
                tự hạ mức.
              </p>
            )}
          </>
        )}

        {scoring === "result" && (
          <Field label={resultLabel}>
            <input
              type="number"
              min="1"
              className={inputClass}
              value={exercise.result ?? ""}
              onChange={positiveInput((result) => onPatch({ result }))}
              placeholder={resultPlaceholder}
            />
          </Field>
        )}

        <Field label="Điểm">
          <input
            readOnly
            className={readOnlyClass}
            value={exercise.score ?? ""}
            placeholder="Hệ thống tự tính"
          />
        </Field>
        <Field label="Mức đánh giá">
          <input
            readOnly
            className={readOnlyClass}
            value={levelLabel(exercise.level)}
            placeholder="Hệ thống tự chọn"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Ghi chú">
            <textarea
              rows={2}
              className={inputClass}
              value={exercise.notes || ""}
              onChange={(e) => onPatch({ notes: e.target.value })}
              placeholder="Ví dụ: lệch bên trái, mất form ở cuối hiệp."
            />
          </Field>
        </div>
      </div>
    </div>
  );
};

const ExerciseTestCard = ({
  title,
  icon: Icon,
  value = {},
  onChange,
  suggestion,
  loadingSuggestion = false,
  scoring = "protocol",
  resultLabel = "Kết quả",
  resultPlaceholder = "",
  computeResultScore,
}) => {
  const [tier, setTier] = useState("");
  const [customName, setCustomName] = useState("");
  const exercises = Array.isArray(value.exercises) ? value.exercises : [];
  const tiers = getSuggestionTiers(suggestion);
  const protocolOptions = suggestion?.protocolOptions || [];
  const chosenNames = new Set(exercises.map((item) => item.name));
  const available = (tiers[tier] || []).filter((name) => !chosenNames.has(name));
  const limitReached = exercises.length >= MAX_EXERCISES_PER_METRIC;

  const commit = (next) => {
    const aggregate = aggregateExercises(next);
    onChange("exercises", next);
    onChange("score", aggregate.score);
    onChange("level", aggregate.level);
  };

  // Hệ thống tự chấm: bài hệ thống và bài riêng của HLV dùng cùng một chuẩn.
  const scoreExercise = (exercise) => {
    if (scoring === "result") {
      const score = computeResultScore ? computeResultScore(exercise.result) : "";
      return { score, level: score === "" ? "" : scoreToLevel(score) };
    }
    const protocol = pickProtocol(exercise.inputMode, protocolOptions);
    const score = protocol
      ? scoreAgainstProtocol({
          selectedProtocol: protocol,
          sets: exercise.sets,
          reps: exercise.reps,
          durationSec: exercise.durationSec,
        })
      : "";
    return {
      score,
      level: score === "" ? "" : scoreToLevel(score),
      selectedProtocol: protocol,
    };
  };

  const addExercise = (name, source, exerciseTier) => {
    if (!canAddExercise(exercises, name)) return false;
    commit([
      ...exercises,
      createExercise({ name, source, tier: source === "custom" ? "" : exerciseTier }),
    ]);
    return true;
  };

  const patchExercise = (index, patch) => {
    commit(
      exercises.map((exercise, i) => {
        if (i !== index) return exercise;
        const merged = { ...exercise, ...patch };
        if (patch.inputMode !== undefined) {
          merged.reps = patch.inputMode === "reps" ? merged.reps : "";
          merged.durationSec = patch.inputMode === "time" ? merged.durationSec : "";
        }
        return { ...merged, ...scoreExercise(merged) };
      }),
    );
  };

  const removeExercise = (index) =>
    commit(exercises.filter((_, i) => i !== index));

  const handleAddCustom = () => {
    if (addExercise(customName, "custom", "")) setCustomName("");
  };

  return (
    <div
      data-testid="f1-exercise-card"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-orange-600" />
          <h4 className="font-bold text-slate-800">{title}</h4>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {loadingSuggestion ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Đang tải gợi ý...
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-dashed border-orange-200 bg-orange-50/30 p-4">
            <Field label="Chọn cấp độ cho bài test">
              <select
                className={inputClass}
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                disabled={limitReached}
              >
                <option value="">Chọn cấp độ</option>
                {TIER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            {tier && (
              <Field label="Chọn bài tập">
                <select
                  className={inputClass}
                  value=""
                  disabled={limitReached || available.length === 0}
                  onChange={(e) => addExercise(e.target.value, "system", tier)}
                >
                  <option value="">
                    {available.length ? "Chọn bài tập" : "Đã chọn hết bài của mức này"}
                  </option>
                  {available.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {tier && (
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Hoặc nhập bài test riêng của HLV
                </span>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={customName}
                    maxLength={MAX_EXERCISE_NAME_LENGTH}
                    disabled={limitReached}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustom();
                      }
                    }}
                    placeholder="Ví dụ: Squat nhảy 30 giây"
                    aria-label="Tên bài test riêng của HLV"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    disabled={limitReached || !canAddExercise(exercises, customName)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
                  >
                    <Plus size={16} />
                    Thêm
                  </button>
                </div>
              </div>
            )}

            {limitReached && (
              <p className="text-xs text-slate-500">
                Đã đủ {MAX_EXERCISES_PER_METRIC} bài. Bỏ bớt một bài để thêm bài khác.
              </p>
            )}
          </div>
        )}

        {exercises.length > 0 && suggestion && (suggestion.reason || suggestion.dosage) && (
          <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 text-sm">
            {suggestion.reason && <p className="text-slate-600">{suggestion.reason}</p>}
            {suggestion.dosage && (
              <p className="mt-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-slate-700">
                <span className="font-semibold">Gợi ý khởi đầu:</span> {suggestion.dosage}
              </p>
            )}
          </div>
        )}

        {exercises.length === 0 && value.level && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Kết quả đã lưu trước đây: {levelLabel(value.level)}. Thêm bài test để cập nhật.
          </p>
        )}

        {exercises.map((exercise, index) => (
          <ExerciseRow
            key={`${exercise.name}-${index}`}
            exercise={exercise}
            scoring={scoring}
            protocolOptions={protocolOptions}
            resultLabel={resultLabel}
            resultPlaceholder={resultPlaceholder}
            onPatch={(patch) => patchExercise(index, patch)}
            onRemove={() => removeExercise(index)}
          />
        ))}

        {exercises.length > 0 && (
          <p className="text-sm font-semibold text-slate-700">
            Tổng hợp:{" "}
            <span className="text-orange-700">
              {levelLabel(value.level) || "Chưa đủ dữ liệu"}
              {value.score !== "" && value.score != null ? ` (${value.score}/10)` : ""}
            </span>
          </p>
        )}
      </div>
    </div>
  );
};

export default ExerciseTestCard;
