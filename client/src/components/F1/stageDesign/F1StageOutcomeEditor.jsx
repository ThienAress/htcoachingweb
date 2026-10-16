import { useWatch } from "react-hook-form";
import { formatNumber } from "../../../utils/f1PhaseReview";
import { OUTCOME_METRICS } from "../../../utils/f1StageDesign";

const withUnit = (value, unit) => {
  const text = formatNumber(value);
  return text === "--" || !unit ? text : `${text} ${unit}`;
};

// Bảng dự đoán cuối giai đoạn: số hệ thống tính và ô để HLV ghi đè.
const F1StageOutcomeEditor = ({ control, register, setValue, preview, loading }) => {
  const overrides = useWatch({ control, name: "overrides" }) || {};
  const baseline = preview?.baseline || {};
  const system = preview?.systemProjected || {};
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Hệ thống tự tính lại khi đổi giai đoạn, số tuần hoặc số buổi. HLV có thể nhập số dự kiến khác; ô đã nhập có nhãn
        "HLV chỉnh".
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[36rem] text-left text-sm tabular-nums">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {["Chỉ số", "Ban đầu", "Hệ thống đề xuất", "Dự kiến cuối giai đoạn"].map((head) => (
                <th key={head} className="px-4 py-2.5 font-semibold">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {OUTCOME_METRICS.map(([key, label, unit]) => {
              const edited = String(overrides[key] ?? "").trim() !== "";
              return (
                <tr key={key}>
                  <td className="px-4 py-2.5 text-slate-600">{label}</td>
                  <td className="px-4 py-2.5">{withUnit(baseline[key], unit)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{loading ? "Đang tính..." : withUnit(system[key], unit)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        inputMode="decimal"
                        aria-label={`Dự kiến ${label}`}
                        placeholder={formatNumber(system[key])}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                        {...register(`overrides.${key}`)}
                      />
                      {edited && (
                        <>
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">HLV chỉnh</span>
                          <button
                            type="button"
                            onClick={() => setValue(`overrides.${key}`, "", { shouldDirty: true })}
                            className="text-xs font-semibold text-orange-700 hover:underline"
                          >
                            Khôi phục
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default F1StageOutcomeEditor;
