import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../../context/AuthContext";
import { selfAssessmentHistoryQueryOptions } from "../../queries/fitnessSelfAssessment.queries";
import { LEVEL_TONES } from "./constants";
import { formatDate } from "./format";

// Danh sách các lần đánh giá trước; chỉ để xem lại, không có thao tác sửa hoặc xóa.
const AssessmentHistory = ({ excludeId, onSelect }) => {
  const { user } = useAuth();
  const query = useQuery(selfAssessmentHistoryQueryOptions({ userId: user?._id }));
  const items = (query.data?.items || []).filter((item) => item.id !== excludeId);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="self-assessment-history-title" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <h3 id="self-assessment-history-title" className="text-base font-bold text-white">
        Các lần đánh giá trước
      </h3>
      <ul className="mt-3 divide-y divide-slate-800">
        {items.map((item) => {
          const scoring = item.result?.scoring;
          return (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="text-slate-300">{formatDate(item.completedAt)}</span>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  LEVEL_TONES[scoring?.overallLevel] || "border-slate-600 text-slate-300"
                }`}
              >
                {scoring?.overallLevelLabel || "Chưa xếp mức"}
              </span>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="min-h-11 rounded-lg px-3 font-semibold text-orange-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                Xem lại
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default AssessmentHistory;
