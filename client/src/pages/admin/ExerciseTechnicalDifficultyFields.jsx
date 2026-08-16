const CRITERIA = [
  {
    key: "coordination",
    label: "Phối hợp kỹ thuật",
    help: "Số bước kỹ thuật và mức phối hợp toàn thân.",
  },
  {
    key: "stability",
    label: "Thăng bằng / ổn định",
    help: "Yêu cầu giữ thăng bằng và kiểm soát thân người.",
  },
  {
    key: "mobility",
    label: "Mobility / biên độ",
    help: "Yêu cầu mobility và biên độ vận động để thực hiện đúng.",
  },
  {
    key: "setup",
    label: "Setup / thiết bị",
    help: "Độ phức tạp khi chuẩn bị thiết bị hoặc nhu cầu spotter.",
  },
  {
    key: "errorConsequence",
    label: "Hậu quả khi sai",
    help: "Mức rủi ro và khả năng tự dừng an toàn khi sai kỹ thuật.",
  },
];

const ExerciseTechnicalDifficultyFields = ({ value = {}, onChange }) => {
  const rubric = value || {};
  const updateField = (field, fieldValue) => {
    const nextRubric = { ...rubric };
    if (fieldValue === undefined || fieldValue === "") {
      delete nextRubric[field];
    } else {
      nextRubric[field] = fieldValue;
    }
    onChange(Object.keys(nextRubric).length > 0 ? nextRubric : undefined);
  };

  return (
    <fieldset className="space-y-4 border-t border-gray-200 pt-5">
      <legend className="text-sm font-semibold text-gray-800">
        Độ phức tạp kỹ thuật
      </legend>
      <p className="text-xs leading-5 text-gray-500">
        Chấm đủ năm tiêu chí từ 0–2. Số sao không bao gồm sets, reps, mức tạ,
        RPE/RIR hoặc mức phù hợp với từng khách.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {CRITERIA.map((criterion) => (
          <label key={criterion.key} className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {criterion.label}
            </span>
            <select
              value={rubric[criterion.key] ?? ""}
              onChange={(event) =>
                updateField(
                  criterion.key,
                  event.target.value === "" ? undefined : Number(event.target.value),
                )
              }
              className="w-full rounded-xl border border-gray-300 bg-white p-2.5 text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              aria-describedby={`technical-difficulty-${criterion.key}-help`}
            >
              <option value="">Chưa chấm</option>
              <option value="0">0 — Thấp</option>
              <option value="1">1 — Vừa</option>
              <option value="2">2 — Cao</option>
            </select>
            <span
              id={`technical-difficulty-${criterion.key}-help`}
              className="mt-1 block text-xs leading-5 text-gray-500"
            >
              {criterion.help}
            </span>
          </label>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">
          Lý do đánh giá
        </span>
        <textarea
          rows={2}
          maxLength={1000}
          value={rubric.rationale || ""}
          onChange={(event) => updateField("rationale", event.target.value)}
          placeholder="Giải thích ngắn để HLV/admin khác có thể kiểm tra rubric."
          className="w-full rounded-xl border border-gray-300 p-2.5 text-gray-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
        />
      </label>
      {Object.keys(rubric).length > 0 && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-sm font-medium text-red-600 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          Xóa đánh giá kỹ thuật
        </button>
      )}
    </fieldset>
  );
};

export default ExerciseTechnicalDifficultyFields;
