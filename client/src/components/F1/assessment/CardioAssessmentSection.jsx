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

const computeCardioCapacityScore = (resultMinutes) => {
  const value = Number(resultMinutes || 0);
  if (!value) return "";
  const minTarget = 20;
  const maxTarget = 30;
  const baselineRatio = clamp(value / minTarget, 0, 1);
  const bonusRatio =
    value <= minTarget
      ? 0
      : clamp((value - minTarget) / (maxTarget - minTarget), 0, 1);
  return String(round1(10 * (0.7 * baselineRatio + 0.3 * bonusRatio)));
};

const computeRecoveryScore = (hrDrop) => {
  const value = Number(hrDrop || 0);
  if (!value) return "";
  const minTarget = 12;
  const maxTarget = 25;
  const baselineRatio = clamp(value / minTarget, 0, 1);
  const bonusRatio =
    value <= minTarget
      ? 0
      : clamp((value - minTarget) / (maxTarget - minTarget), 0, 1);
  return String(round1(10 * (0.7 * baselineRatio + 0.3 * bonusRatio)));
};

const SuggestionBlock = ({ suggestion, loading }) => {
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
    </div>
  );
};

const MetricCard = ({
  title,
  value = {},
  onChange,
  suggestion,
  loadingSuggestion = false,
  placeholder = "Ví dụ: 24",
  resultLabel = "Kết quả",
  computeScore,
}) => {
  useEffect(() => {
    const nextScore = computeScore(value.result);
    if (nextScore === "") {
      if (value.score !== "") onChange("score", "");
      if (value.level !== "") onChange("level", "");
      return;
    }
    const nextLevel = scoreToLevel(nextScore);
    if (String(value.score ?? "") !== String(nextScore))
      onChange("score", nextScore);
    if (value.level !== nextLevel) onChange("level", nextLevel);
  }, [computeScore, onChange, value.level, value.result, value.score]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <h4 className="font-semibold text-slate-800">{title}</h4>
      <SuggestionBlock suggestion={suggestion} loading={loadingSuggestion} />
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p className="font-semibold text-slate-800">Đánh giá tim mạch</p>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">
            {resultLabel}
          </span>
          <input
            type="number"
            value={value.result ?? ""}
            onChange={(e) => onChange("result", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400 bg-white"
            placeholder={placeholder}
          />
        </label>
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
            placeholder="Ví dụ: hồi phục nhịp tim chậm, nền tim mạch thấp."
          />
        </label>
      </div>
    </div>
  );
};

const CardioAssessmentSection = ({
  value,
  onMetricChange,
  suggestions = [],
  loadingSuggestions = false,
}) => {
  const cardioCapacitySuggestion = suggestions[0] || null;
  const recoveryHeartRateSuggestion = suggestions[1] || null;

  const handleCardioCapacityChange = useCallback(
    (field, next) => onMetricChange("cardioCapacity", field, next),
    [onMetricChange],
  );

  const handleRecoveryHeartRateChange = useCallback(
    (field, next) => onMetricChange("recoveryHeartRate", field, next),
    [onMetricChange],
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Tim mạch</h3>
        <p className="text-sm text-slate-500 mt-1">
          Nhịp tim nghỉ được lấy tự động từ intake. Phần này chỉ đánh giá năng
          lực tim mạch và khả năng hồi phục.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <MetricCard
          title="Năng lực tim mạch"
          value={value.cardioCapacity}
          suggestion={cardioCapacitySuggestion}
          loadingSuggestion={loadingSuggestions}
          onChange={handleCardioCapacityChange}
          resultLabel="Kết quả (phút)"
          placeholder="Ví dụ: 24"
          computeScore={computeCardioCapacityScore}
        />
        <MetricCard
          title="Khả năng hồi phục nhịp tim"
          value={value.recoveryHeartRate}
          suggestion={recoveryHeartRateSuggestion}
          loadingSuggestion={loadingSuggestions}
          onChange={handleRecoveryHeartRateChange}
          resultLabel="Kết quả (HR drop sau 1 phút)"
          placeholder="Ví dụ: 15"
          computeScore={computeRecoveryScore}
        />
      </div>
    </div>
  );
};

export default CardioAssessmentSection;
