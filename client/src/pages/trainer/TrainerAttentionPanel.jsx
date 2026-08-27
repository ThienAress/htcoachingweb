import { AlertTriangle } from "lucide-react";
import { attentionRows } from "./trainerOverviewPresentation";

export const TrainerAttentionPanel = ({ items }) => {
  const rows = attentionRows(items);
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm"
      aria-labelledby="trainer-attention-title"
    >
      <div className="flex items-start gap-4 border-b border-slate-800 p-5 sm:p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
          <AlertTriangle className="h-6 w-6 text-amber-300" aria-hidden="true" />
        </div>
        <div>
          <h2
            id="trainer-attention-title"
            className="text-2xl font-bold text-slate-50 sm:text-3xl"
          >
            Cần chú ý
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Những việc nên được HLV ưu tiên xử lý
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-5 text-sm text-slate-400 sm:px-6">
          Không có mục cần ưu tiên trong phạm vi hiện tại.
        </p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {rows.map((row) => (
            <li
              key={row.code}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100">
                  {row.label}
                </p>
                <p className="mt-1 text-xs text-slate-400">{row.detail}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-200">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
