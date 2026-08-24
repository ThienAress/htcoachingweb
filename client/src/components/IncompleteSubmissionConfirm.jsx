import { AlertTriangle, Send } from "lucide-react";
import { useId } from "react";

export const IncompleteSubmissionConfirm = ({
  missingFields = [],
  onCancel,
  onConfirm,
  isPending = false,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  if (missingFields.length === 0) return null;

  return (
    <div
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="border-y border-amber-500/40 bg-amber-500/5 px-4 py-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h3
            id={titleId}
            className="text-base font-bold text-amber-100"
          >
            Còn {missingFields.length} mục bạn chưa điền
          </h3>
          <p
            id={descriptionId}
            className="mt-1 text-sm leading-6 text-slate-300"
          >
            {missingFields.join(", ")}. Bạn muốn gửi luôn không?
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              autoFocus
              className="min-h-11 rounded-lg border border-slate-600 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50"
            >
              Tiếp tục điền
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-bold text-slate-950 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              {isPending ? "Đang gửi..." : "Vẫn gửi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
