import { useEffect, useRef } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

const CONTENT = {
  save: {
    title: "Xác nhận lưu điều kiện",
    description:
      "Sau khi đồng ý, lựa chọn dị ứng sẽ được khóa và dùng để lọc các gợi ý thực đơn. Muốn thay đổi, bạn cần bỏ lưu điều kiện trước.",
    confirm: "Đồng ý lưu",
  },
  clear: {
    title: "Xác nhận bỏ lưu điều kiện",
    description:
      "Điều kiện dị ứng hiện tại sẽ được xóa. Bạn cần chọn và xác nhận lại trước khi tiếp tục dùng gợi ý thực đơn.",
    confirm: "Đồng ý bỏ lưu",
  },
};

export default function MealPlanPreferenceConfirmDialog({
  action,
  isPending,
  onCancel,
  onConfirm,
}) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const content = CONTENT[action];

  useEffect(() => {
    if (!content) return undefined;
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !isPending) {
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
  }, [content, isPending, onCancel]);

  if (!content) return null;
  const Icon = action === "clear" ? AlertTriangle : ShieldCheck;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onCancel();
      }}
    >
      <section
        className="z-50 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-plan-preference-dialog-title"
        aria-describedby="meal-plan-preference-dialog-description"
      >
        <span
          className={`flex size-11 items-center justify-center rounded-xl ${
            action === "clear"
              ? "bg-red-500/10 text-red-300"
              : "bg-primary/10 text-primary"
          }`}
        >
          <Icon size={21} aria-hidden="true" />
        </span>
        <h2
          id="meal-plan-preference-dialog-title"
          className="mt-4 text-xl font-black text-white"
        >
          {content.title}
        </h2>
        <p
          id="meal-plan-preference-dialog-description"
          className="mt-2 text-sm leading-6 text-gray-300"
        >
          {content.description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-gray-300 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              action === "clear"
                ? "bg-red-600 hover:bg-red-500 focus-visible:ring-red-300"
                : "bg-primary hover:bg-primary-dark focus-visible:ring-primary"
            }`}
          >
            {isPending ? "Đang xử lý..." : content.confirm}
          </button>
        </div>
      </section>
    </div>
  );
}
