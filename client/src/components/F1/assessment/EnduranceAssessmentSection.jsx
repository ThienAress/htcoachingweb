import React, { useCallback, useEffect } from "react";

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
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <p className="font-semibold text-slate-900">
        {suggestion.title || suggestion.name}
      </p>
      {suggestion.target ? (
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
          {suggestion.target}
        </p>
      ) : null}
      {suggestion.reason ? (
        <p className="mt-2 text-sm text-slate-700">{suggestion.reason}</p>
      ) : null}
      {suggestion.dosage ? (
        <div className="mt-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold">Gợi ý khởi đầu:</span>{" "}
          {suggestion.dosage}
        </div>
      ) : null}
      {protocolOptions.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Chọn nhanh bài test sức bền
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
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${active ? "border-violet-700 bg-violet-700 text-white" : "border-violet-200 bg-white text-violet-700 hover:bg-violet-100"}`}
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

    if (option.mode === "reps") {
      onChange("durationSec", "");
    }

    if (option.mode === "time") {
      onChange("reps", "");
    }
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <h4 className="font-semibold text-slate-800">{title}</h4>
      <SuggestionBlock
        suggestion={suggestion}
        loading={loadingSuggestion}
        selectedProtocol={value.selectedProtocol}
        onChooseProtocol={handleChooseProtocol}
      />
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="font-semibold text-slate-800">Đánh giá sức bền</p>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Số set
          </span>
          <input
            type="number"
            value={value.sets ?? ""}
            onChange={(e) => onChange("sets", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400 bg-white"
            placeholder="Ví dụ: 3"
          />
        </label>
        {inputMode === "reps" ? (
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Số reps
            </span>
            <input
              type="number"
              value={value.reps ?? ""}
              onChange={(e) => onChange("reps", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400 bg-white"
              placeholder="Ví dụ: 10"
            />
          </label>
        ) : null}
        {inputMode === "time" ? (
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Thời gian (giây)
            </span>
            <input
              type="number"
              value={value.durationSec ?? ""}
              onChange={(e) => onChange("durationSec", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400 bg-white"
              placeholder="Ví dụ: 20"
            />
          </label>
        ) : null}
        {!inputMode ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            Chọn một bài test nhanh ở phía trên để hệ thống hiện đúng ô nhập
            liệu theo reps hoặc theo thời gian.
          </div>
        ) : null}
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Điểm
          </span>
          <input
            type="number"
            value={value.score ?? ""}
            readOnly
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none bg-slate-100 text-slate-700"
            placeholder="Hệ thống tự tính"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Mức đánh giá
          </span>
          <input
            type="text"
            value={
              levelOptions.find((item) => item.value === value.level)?.label ||
              ""
            }
            readOnly
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none bg-slate-100 text-slate-700"
            placeholder="Hệ thống tự chọn"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            Ghi chú
          </span>
          <textarea
            rows={3}
            value={value.notes || ""}
            onChange={(e) => onChange("notes", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400 bg-white"
            placeholder="Ví dụ: hụt sức nhanh, sức bền core thấp."
          />
        </label>
      </div>
    </div>
  );
};

const EnduranceAssessmentSection = ({
  value,
  onChange,
  suggestions = [],
  loadingSuggestions = false,
}) => {
  const muscularEnduranceSuggestion = suggestions[1] || suggestions[0] || null;
  const coreEnduranceSuggestion = suggestions[2] || suggestions[1] || null;

  const handleMuscularEnduranceChange = useCallback(
    (field, next) => onChange("muscularEndurance", field, next),
    [onChange],
  );

  const handleCoreEnduranceChange = useCallback(
    (field, next) => onChange("coreEndurance", field, next),
    [onChange],
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Sức bền</h3>
        <p className="text-sm text-slate-500 mt-1">
          Đánh giá sức bền cơ bắp và khả năng chịu tải.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <MetricCard
          title="Muscular Endurance (Sức bền cơ bắp)"
          value={value.muscularEndurance}
          suggestion={muscularEnduranceSuggestion}
          loadingSuggestion={loadingSuggestions}
          onChange={handleMuscularEnduranceChange}
        />
        <MetricCard
          title="Core Endurance (Sức bền core)"
          value={value.coreEndurance}
          suggestion={coreEnduranceSuggestion}
          loadingSuggestion={loadingSuggestions}
          onChange={handleCoreEnduranceChange}
        />
      </div>
    </div>
  );
};

export default EnduranceAssessmentSection;
