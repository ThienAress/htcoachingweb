import { AlertTriangle } from "lucide-react";
import { attentionRows } from "./trainerOverviewPresentation";

export const TrainerAttentionPanel = ({ items }) => {
  const rows = attentionRows(items);
  return (
    <section className="rounded-2xl border border-gray-700/50 bg-gray-950/40 p-5">
      <h3 className="flex items-center gap-2 font-bold text-white">
        <AlertTriangle size={18} className="text-amber-400" aria-hidden="true" />
        Cần chú ý
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">
          Không có mục cần ưu tiên trong phạm vi hiện tại.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-800">
          {rows.map((row) => (
            <li key={row.code} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-200">
                    {row.label}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{row.detail}</p>
                </div>
                <span className="rounded-full border border-gray-700 px-2 py-1 text-xs text-gray-400">
                  {row.count}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
