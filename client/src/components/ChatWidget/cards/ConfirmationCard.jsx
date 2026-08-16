import { useId, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";

import {
  cancelAiToolAction,
  confirmAiToolAction,
} from "../../../services/ai.service";

export default function ConfirmationCard({ data }) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const titleId = useId();

  if (!data?.token || !data?.expiresAt) return null;
  const pending = status === "confirming" || status === "cancelling";
  const settled = ["confirmed", "cancelled", "failed"].includes(status);

  const confirm = async () => {
    if (pending || settled) return;
    setStatus("confirming");
    setMessage("");
    try {
      await confirmAiToolAction(data.token);
      setStatus("confirmed");
      setMessage("Đã xác nhận và xử lý hành động.");
    } catch (error) {
      const code = error.response?.data?.code;
      setStatus(
        error.response?.data?.meta?.consumed ||
          code === "AI_TOOL_CONFIRMATION_EXPIRED_OR_USED"
          ? "failed"
          : "idle",
      );
      setMessage(
        error.response?.data?.message || "Không thể xác nhận. Vui lòng thử lại.",
      );
    }
  };

  const cancel = async () => {
    if (pending || settled) return;
    setStatus("cancelling");
    setMessage("");
    try {
      await cancelAiToolAction(data.token);
      setStatus("cancelled");
      setMessage("Đã hủy hành động.");
    } catch (error) {
      setStatus(
        error.response?.data?.code ===
          "AI_TOOL_CONFIRMATION_EXPIRED_OR_USED"
          ? "failed"
          : "idle",
      );
      setMessage(
        error.response?.data?.message || "Không thể hủy. Vui lòng thử lại.",
      );
    }
  };

  return (
    <section
      className="w-full space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4"
      aria-labelledby={titleId}
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 shrink-0 text-amber-500" size={18} />
        <div className="min-w-0">
          <h3 id={titleId} className="font-semibold text-gray-900 dark:text-white">
            {data.title || "Xác nhận hành động"}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {data.description}
          </p>
        </div>
      </div>

      {!settled && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:text-gray-200 dark:hover:bg-white/5"
          >
            <X size={15} aria-hidden="true" />
            {status === "cancelling" ? "Đang hủy..." : "Hủy"}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check size={15} aria-hidden="true" />
            {status === "confirming" ? "Đang xác nhận..." : "Xác nhận"}
          </button>
        </div>
      )}

      {message && (
        <p
          className={`text-sm ${status === "confirmed" ? "text-emerald-600 dark:text-emerald-400" : status === "failed" ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-300"}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </section>
  );
}
