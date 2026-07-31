import { AlertTriangle } from "lucide-react";
import { attentionRows } from "./trainerOverviewPresentation";

export const TrainerAttentionPanel = ({ items }) => {
  const rows = attentionRows(items);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
          <AlertTriangle className="h-4 w-4 text-amber-300" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-50">Cần chú ý</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Những việc nên được HLV ưu tiên xử lý
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">
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
