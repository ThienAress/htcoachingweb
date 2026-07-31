import { Check, Pencil, Trash2, X } from "lucide-react";
import { commentDisplay } from "./coachingCommentViewModel";

export const CoachingCommentItem = ({
  comment,
  editing,
  setEditing,
  confirming,
  setConfirming,
  disabled,
  onSave,
  onRemove,
  canMutate,
}) => {
  const display = commentDisplay(comment);
  const isEditing = editing?._id === comment._id;
  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-orange-300">
            {display.authorLabel}
          </p>
          {isEditing ? (
            <textarea
              value={editing.body}
              onChange={(event) =>
                setEditing({ ...editing, body: event.target.value })
              }
              maxLength={2000}
              rows="3"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
              aria-label="Chỉnh sửa bình luận"
            />
          ) : (
            <p
              className={
                "mt-1 whitespace-pre-wrap break-words text-sm leading-6 " +
                (display.removed
                  ? "italic text-slate-600"
                  : "text-slate-300")
              }
            >
              {display.body}
            </p>
          )}
        </div>
        {display.canChange && canMutate && (
          <div className="flex shrink-0 gap-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={disabled}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-emerald-300 hover:bg-emerald-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  aria-label="Lưu chỉnh sửa"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  aria-label="Hủy chỉnh sửa"
                >
                  <X size={16} />
                </button>
              </>
            ) : confirming === comment._id ? (
              <>
                <button
                  type="button"
                  onClick={() => onRemove(comment)}
                  disabled={disabled}
                  className="min-h-11 rounded-lg px-3 text-xs font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  Xác nhận gỡ
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="min-h-11 rounded-lg px-3 text-xs text-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  Hủy
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing({ ...comment })}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                  aria-label="Sửa bình luận"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(comment._id)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  aria-label="Gỡ bình luận"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
};
