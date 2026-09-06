import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function MealScanAnalyzeDialog({
  open,
  accepted,
  onAcceptedChange,
  onCancel,
  onConfirm,
}) {
  const { t } = useTranslation("mealScan");
  const consentRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const acceptedRef = useRef(accepted);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    acceptedRef.current = accepted;
    onCancelRef.current = onCancel;
  }, [accepted, onCancel]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    consentRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const lastRef = acceptedRef.current ? confirmRef : cancelRef;
      if (event.shiftKey && document.activeElement === consentRef.current) {
        event.preventDefault();
        lastRef.current?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastRef.current
      ) {
        event.preventDefault();
        consentRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="z-50 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-scan-confirm-title"
        aria-describedby="meal-scan-confirm-description"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <AlertTriangle size={21} aria-hidden="true" />
        </span>
        <h2
          id="meal-scan-confirm-title"
          className="mt-4 text-xl font-black text-slate-950"
        >
          {t("confirm_analysis.title")}
        </h2>
        <p
          id="meal-scan-confirm-description"
          className="mt-2 text-sm leading-6 text-slate-600"
        >
          {t("confirm_analysis.description")}
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <input
            ref={consentRef}
            type="checkbox"
            checked={accepted}
            onChange={(event) => onAcceptedChange(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
          />
          <span>{t("confirm_analysis.provider_consent")}</span>
        </label>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("confirm_analysis.cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={!accepted}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {t("confirm_analysis.confirm")}
          </button>
        </div>
      </section>
    </div>
  );
}
