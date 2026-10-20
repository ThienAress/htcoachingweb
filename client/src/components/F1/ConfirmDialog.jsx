// ConfirmDialog.jsx — hộp xác nhận giữa màn hình, thay cho window.confirm
import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useModalScrollLock } from "../../hooks/useModalScrollLock";

const TONES = {
  default: {
    icon: "bg-orange-100 text-orange-600",
    button: "from-orange-600 to-orange-500",
  },
  danger: {
    icon: "bg-red-100 text-red-600",
    button: "from-red-600 to-red-500",
  },
};

const ConfirmDialog = ({
  title,
  message,
  details = [],
  confirmLabel = "Xác nhận",
  cancelLabel = "Huỷ",
  tone = "default",
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef(null);
  const palette = TONES[tone] || TONES.default;
  useModalScrollLock(true);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        data-testid="confirm-dialog"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${palette.icon}`}
          >
            <AlertTriangle size={22} />
          </span>
          <div className="min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-lg font-extrabold text-slate-800"
            >
              {title}
            </h2>
            <p id="confirm-dialog-message" className="mt-1.5 text-sm text-slate-600">
              {message}
            </p>
            {details.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                {details.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`rounded-xl bg-gradient-to-r px-5 py-2.5 font-bold text-white shadow-md transition hover:shadow-lg ${palette.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
