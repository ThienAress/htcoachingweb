import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useModalScrollLock } from "../../hooks/useModalScrollLock";

export default function MealPlanSaveConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
}) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      if (event.shiftKey && document.activeElement === cancelRef.current) {
        event.preventDefault();
        confirmRef.current?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === confirmRef.current
      ) {
        event.preventDefault();
        cancelRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="z-50 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-plan-saved-dialog-title"
        aria-describedby="meal-plan-saved-dialog-description"
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
          <CheckCircle2 size={22} aria-hidden="true" />
        </span>
        <h2 id="meal-plan-saved-dialog-title" className="mt-4 text-xl font-black text-white">
          Đã lưu thực đơn
        </h2>
        <p
          id="meal-plan-saved-dialog-description"
          className="mt-2 text-sm leading-6 text-gray-300"
        >
          Bạn có muốn chuyển đến mục Dinh dưỡng trong Dashboard để áp dụng thực đơn không?
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-gray-300 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Ở lại
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Đến mục Dinh dưỡng <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
