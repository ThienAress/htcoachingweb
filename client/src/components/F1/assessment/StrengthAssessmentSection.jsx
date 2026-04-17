// StrengthAssessmentSection.jsx
import React, { useCallback, useEffect } from "react";
import { Dumbbell, Armchair, Battery } from "lucide-react";

const levelOptions = [
  { label: "Chọn mức", value: "" },
  { label: "Yếu", value: "low" },
  { label: "Dưới trung bình", value: "below_average" },
  { label: "Trung bình", value: "average" },
  { label: "Tốt", value: "good" },
];

const scoreToLevel = (score) => {
  const value = Number(score || 0);
  if (value < 4) return "low";
  if (value < 6) return "below_average";
  if (value < 8) return "average";
  return "good";
};

const round1 = (value) => Math.round(Number(value || 0) * 10) / 10;
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

const parseRange = (value = "") => {
  const cleaned = String(value).trim();
  if (!cleaned) return { min: null, max: null };
  const parts = cleaned.split("-").map((item) => Number(item.trim()));
  if (parts.length === 2 && parts.every(Number.isFinite))
    return { min: parts[0], max: parts[1] };
  const single = Number(cleaned);
  if (Number.isFinite(single)) return { min: single, max: single };
  return { min: null, max: null };
};

const extractProtocolOptions = (suggestion) => {
  if (!suggestion) return [];
  if (
    Array.isArray(suggestion.protocolOptions) &&
    suggestion.protocolOptions.length
  )
    return suggestion.protocolOptions;
  const dosage = String(suggestion.dosage || "");
  if (!dosage) return [];
  const options = [];
  const repsMatch = dosage.match(
    /(\d+(?:-\d+)?)\s*(?:hiệp|set|sets)\s*x\s*(\d+(?:-\d+)?)\s*reps/i,
  );
  if (repsMatch) {
    const sets = parseRange(repsMatch[1]);
    const reps = parseRange(repsMatch[2]);
    options.push({
      label: `${repsMatch[1]} hiệp × ${repsMatch[2]} reps`,
      mode: "reps",
      setsMin: sets.min,
      setsMax: sets.max,
      valueMin: reps.min,
      valueMax: reps.max,
      unit: "reps",
    });
  }
  const timeMatch = dosage.match(
    /(\d+(?:-\d+)?)\s*(?:hiệp|vòng|set|sets)\s*x\s*(\d+(?:-\d+)?)\s*(?:giây|s)\b/i,
  );
  if (timeMatch) {
    const sets = parseRange(timeMatch[1]);
    const seconds = parseRange(timeMatch[2]);
    options.push({
      label: `${timeMatch[1]} hiệp × ${timeMatch[2]} giây`,
      mode: "time",
      setsMin: sets.min,
      setsMax: sets.max,
      valueMin: seconds.min,
      valueMax: seconds.max,
      unit: "seconds",
    });
  }
  return options;
};

const scoreAgainstProtocol = ({
  selectedProtocol,
  sets,
  reps,
  durationSec,
}) => {
  if (!selectedProtocol || !selectedProtocol.mode) return "";
  const setsMin = Number(selectedProtocol.setsMin || 0);
  const setsMax = Number(selectedProtocol.setsMax || setsMin || 0);
  const valueMin = Number(selectedProtocol.valueMin || 0);
  const valueMax = Number(selectedProtocol.valueMax || valueMin || 0);
  const actualSets = Number(sets || 0);
  const actualValue =
    selectedProtocol.mode === "reps"
      ? Number(reps || 0)
      : Number(durationSec || 0);
  if (!setsMin || !valueMin || !actualSets || !actualValue) return "";
  const baselineSetRatio = clamp(actualSets / setsMin, 0, 1);
  const baselineValueRatio = clamp(actualValue / valueMin, 0, 1);
  const setBonusRange = Math.max(setsMax - setsMin, 0);
  const valueBonusRange = Math.max(valueMax - valueMin, 0);
  const setBonusRatio =
    actualSets <= setsMin
      ? 0
      : setBonusRange === 0
        ? 1
        : clamp((actualSets - setsMin) / setBonusRange, 0, 1);
  const valueBonusRatio =
    actualValue <= valueMin
      ? 0
      : valueBonusRange === 0
        ? 1
        : clamp((actualValue - valueMin) / valueBonusRange, 0, 1);
  const setAxisScore = 0.7 * baselineSetRatio + 0.3 * setBonusRatio;
  const valueAxisScore = 0.7 * baselineValueRatio + 0.3 * valueBonusRatio;
  return String(round1(10 * (0.4 * setAxisScore + 0.6 * valueAxisScore)));
};

const SuggestionBlock = ({
  suggestion,
  loading,
  selectedProtocol,
  onChooseProtocol,
}) => {
  if (loading)
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Đang tải gợi ý...
      </div>
    );
  if (!suggestion)
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Chưa có gợi ý bài tập.
      </div>
    );
  const protocolOptions = extractProtocolOptions(suggestion);
  return (
    <div className="rounded-xl border-l-4 border-l-amber-500 bg-amber-50/40 p-4">
      <p className="font-bold text-slate-800 whitespace-pre-line">
        {suggestion.title || suggestion.name}
      </p>
      {suggestion.target && (
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-amber-600">
          {suggestion.target}
        </p>
      )}
      {suggestion.reason && (
        <p className="mt-2 text-sm text-slate-600">{suggestion.reason}</p>
      )}
      {suggestion.dosage && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold">Gợi ý khởi đầu:</span>{" "}
          {suggestion.dosage}
        </div>
      )}
      {protocolOptions.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Chọn nhanh bài test sức mạnh
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {protocolOptions.map((option) => {
              const active =
                selectedProtocol?.label === option.label &&
                selectedProtocol?.mode === option.mode;
              return (
                <button
                  key={`${option.label}-${option.mode}`}
                  type="button"
                  onClick={() => onChooseProtocol(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-amber-600 bg-amber-600 text-white shadow-sm"
                      : "border-amber-200 bg-white text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const MetricCard = ({
  title,
  value = {},
  onChange,
  suggestion,
  loadingSuggestion = false,
}) => {
  const handleChooseProtocol = (option) => {
    onChange("selectedProtocol", option);
    onChange("inputMode", option.mode || "");
    if (option.mode === "reps") onChange("durationSec", "");
    if (option.mode === "time") onChange("reps", "");
  };

  useEffect(() => {
    if (!value?.selectedProtocol || !value?.inputMode) return;
    const nextScore = scoreAgainstProtocol({
      selectedProtocol: value.selectedProtocol,
      sets: value.sets,
      reps: value.reps,
      durationSec: value.durationSec,
    });
    if (nextScore === "") {
      if (value.score !== "") onChange("score", "");
      if (value.level !== "") onChange("level", "");
      return;
    }
    const nextLevel = scoreToLevel(nextScore);
    if (String(value.score ?? "") !== String(nextScore))
      onChange("score", nextScore);
    if (value.level !== nextLevel) onChange("level", nextLevel);
  }, [
    onChange,
    value?.durationSec,
    value?.inputMode,
    value?.level,
    value?.reps,
    value?.score,
    value?.selectedProtocol,
    value?.sets,
  ]);

  const inputMode = value.inputMode || "";
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <div className="flex items-center gap-2">
          <Dumbbell size={18} className="text-amber-600" />
          <h4 className="font-bold text-slate-800">{title}</h4>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <SuggestionBlock
          suggestion={suggestion}
          loading={loadingSuggestion}
          selectedProtocol={value.selectedProtocol}
          onChooseProtocol={handleChooseProtocol}
        />
        <div className="rounded-xl bg-slate-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Đánh giá sức mạnh
          </p>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">
              Số set
            </span>
            <input
              type="number"
              value={value.sets ?? ""}
              onChange={(e) => onChange("sets", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              placeholder="Ví dụ: 3"
            />
          </label>
          {inputMode === "reps" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">
                Số reps
              </span>
              <input
                type="number"
                value={value.reps ?? ""}
                onChange={(e) => onChange("reps", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="Ví dụ: 10"
              />
            </label>
          )}
          {inputMode === "time" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">
                Thời gian (giây)
              </span>
              <input
                type="number"
                value={value.durationSec ?? ""}
                onChange={(e) => onChange("durationSec", e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="Ví dụ: 20"
              />
            </label>
          )}
          {!inputMode && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              Chọn một bài test nhanh ở phía trên để hệ thống hiện đúng ô nhập
              liệu theo reps hoặc theo thời gian.
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">
              Điểm
            </span>
            <input
              type="number"
              value={value.score ?? ""}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-600 outline-none"
              placeholder="Hệ thống tự tính"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">
              Mức đánh giá
            </span>
            <input
              type="text"
              value={
                levelOptions.find((item) => item.value === value.level)
                  ?.label || ""
              }
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-600 outline-none"
              placeholder="Hệ thống tự chọn"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">
              Ghi chú
            </span>
            <textarea
              rows={3}
              value={value.notes || ""}
              onChange={(e) => onChange("notes", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              placeholder="Ví dụ: lực đẩy yếu bên trái, core chưa ổn định."
            />
          </label>
        </div>
      </div>
    </div>
  );
};

const StrengthAssessmentSection = ({
  value,
  onChange,
  suggestions = [],
  loadingSuggestions = false,
}) => {
  const upperPushSuggestion = suggestions[0] || null;
  const lowerBodySuggestion = suggestions[1] || null;
  const upperPullSuggestion = suggestions[2] || null;
  const coreSuggestion = suggestions[3] || null;

  const handleUpperBodyPushChange = useCallback(
    (field, next) => onChange("upperBodyPush", field, next),
    [onChange],
  );

  const handleUpperBodyPullChange = useCallback(
    (field, next) => onChange("upperBodyPull", field, next),
    [onChange],
  );

  const handleLowerBodyChange = useCallback(
    (field, next) => onChange("lowerBody", field, next),
    [onChange],
  );

  const handleCoreStrengthChange = useCallback(
    (field, next) => onChange("coreStrength", field, next),
    [onChange],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
        <Battery size={20} className="text-amber-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">Sức mạnh</h3>
          <p className="text-sm text-slate-500">
            Đánh giá sức mạnh cơ bản theo từng nhóm chính.
          </p>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <MetricCard
          title="Upper Body Push Strength"
          value={value.upperBodyPush}
          suggestion={upperPushSuggestion}
          loadingSuggestion={loadingSuggestions}
          onChange={handleUpperBodyPushChange}
        />
        <MetricCard
          title="Upper Body Pull Strength"
          value={value.upperBodyPull}
          suggestion={upperPullSuggestion}
          loadingSuggestion={loadingSuggestions}
          onChange={handleUpperBodyPullChange}
        />
        <MetricCard
          title="Lower Body Strength"
          value={value.lowerBody}
          suggestion={lowerBodySuggestion}
          loadingSuggestion={loadingSuggestions}
          onChange={handleLowerBodyChange}
        />
        <MetricCard
          title="Core Strength"
          value={value.coreStrength}
          suggestion={coreSuggestion}
          loadingSuggestion={loadingSuggestions}
          onChange={handleCoreStrengthChange}
        />
      </div>
    </div>
  );
};

export default StrengthAssessmentSection;
