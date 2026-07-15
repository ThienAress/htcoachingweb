// EnduranceAssessmentSection.jsx
import React, { useCallback, useEffect } from "react";
import { Gauge, Timer, Zap } from "lucide-react";
import {
  scoreToLevel,
  round1,
  clamp,
  parseRange,
  extractProtocolOptions,
  scoreAgainstProtocol,
} from "../../../utils/assessment.helpers";

const levelOptions = [
  { label: "Chọn mức", value: "" },
  { label: "Yếu", value: "low" },
  { label: "Dưới trung bình", value: "below_average" },
  { label: "Trung bình", value: "average" },
  { label: "Tốt", value: "good" },
];


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
    <div className="rounded-xl border-l-4 border-l-orange-500 bg-orange-50/40 p-4">
      <p className="font-bold text-slate-800 whitespace-pre-line">
        {suggestion.title || suggestion.name}
      </p>
      {suggestion.target && (
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-orange-600">
          {suggestion.target}
        </p>
      )}
      {suggestion.reason && (
        <p className="mt-2 text-sm text-slate-600">{suggestion.reason}</p>
      )}
      {suggestion.dosage && (
        <div className="mt-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold">Gợi ý khởi đầu:</span>{" "}
          {suggestion.dosage}
        </div>
      )}
      {protocolOptions.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
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
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-orange-600 bg-orange-600 text-white shadow-sm"
                      : "border-orange-200 bg-white text-orange-700 hover:bg-orange-100"
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
          <Timer size={18} className="text-orange-600" />
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
            Đánh giá sức bền
          </p>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-600">
              Số set
            </span>
            <input
              type="number"
              min="1"
              value={value.sets ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "" && Number(val) < 1) return;
                onChange("sets", val);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                min="1"
                value={value.reps ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== "" && Number(val) < 1) return;
                  onChange("reps", val);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
                min="1"
                value={value.durationSec ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== "" && Number(val) < 1) return;
                  onChange("durationSec", val);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
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
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              placeholder="Ví dụ: hụt sức nhanh, sức bền core thấp."
            />
          </label>
        </div>
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
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-3">
        <Gauge size={20} className="text-orange-600" />
        <div>
          <h3 className="text-xl font-bold text-slate-800">Sức bền</h3>
          <p className="text-sm text-slate-500">
            Đánh giá sức bền cơ bắp và khả năng chịu tải.
          </p>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
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
