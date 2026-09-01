import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Download, LoaderCircle, Trash2, X } from "lucide-react";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";

import { AI_MEMORY_FIELDS } from "../../config/aiMemory";
import { useAuth } from "../../context/AuthContext";
import { aiMemoryQueryOptions } from "../../queries/aiMemory.queries";
import { aiMemoryKeys } from "../../queries/queryKeys";
import {
  clearAiMemory,
  deleteAiMemoryKind,
  getAiMemoryExport,
  setAiMemoryConsent,
  upsertAiMemory,
} from "../../services/ai.service";

export default function AiMemorySettings({ onClose }) {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const queryClient = useQueryClient();
  const query = useQuery(aiMemoryQueryOptions(userId));
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [actionError, setActionError] = useState("");
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: aiMemoryKeys.mine(userId) });
  };
  const mutationOptions = (mutationFn, successMessage) => ({
    mutationFn,
    onMutate: () => setActionError(""),
    onSuccess: async () => {
      await refresh();
      toast.success(successMessage);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message || "Không thể cập nhật Trí nhớ AI.";
      setActionError(message);
      toast.error(message);
    },
  });
  const consentMutation = useMutation(
    mutationOptions(
      (enabled) => setAiMemoryConsent(enabled),
      "Đã cập nhật quyền sử dụng Trí nhớ AI",
    ),
  );
  const valueMutation = useMutation(
    mutationOptions(
      ({ kind, value }) => upsertAiMemory(kind, value),
      "Đã lưu lựa chọn Trí nhớ AI",
    ),
  );
  const deleteKindMutation = useMutation(
    mutationOptions(
      (kind) => deleteAiMemoryKind(kind),
      "Đã xóa lựa chọn khỏi Trí nhớ AI",
    ),
  );
  const clearMutation = useMutation({
    ...mutationOptions(clearAiMemory, "Đã xóa toàn bộ Trí nhớ AI"),
    onSuccess: async () => {
      setConfirmDeleteAll(false);
      await refresh();
      toast.success("Đã xóa toàn bộ Trí nhớ AI");
    },
  });
  const isPending =
    consentMutation.isPending ||
    valueMutation.isPending ||
    deleteKindMutation.isPending ||
    clearMutation.isPending;
  const entryMap = useMemo(
    () =>
      Object.fromEntries(
        (query.data?.entries || []).map((entry) => [entry.kind, entry]),
      ),
    [query.data?.entries],
  );

  const exportMemory = async () => {
    setActionError("");
    try {
      const response = await getAiMemoryExport();
      saveAs(
        new Blob([JSON.stringify(response.data, null, 2)], {
          type: "application/json;charset=utf-8",
        }),
        "ht-assistant-memory.json",
      );
      toast.success("Đã xuất dữ liệu Trí nhớ AI");
    } catch (error) {
      const message =
        error?.response?.data?.message || "Không thể xuất Trí nhớ AI.";
      setActionError(message);
      toast.error(message);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng cài đặt Trí nhớ AI"
        className="absolute inset-0 bg-zinc-950/60"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-memory-title"
        className="relative flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#17191e]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
          <div className="flex gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
              <Brain size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 id="ai-memory-title" className="font-semibold text-zinc-950 dark:text-white">
                Trí nhớ AI
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Chỉ lưu lựa chọn bạn xác nhận. Không tự đọc hay rút thông tin từ hội thoại.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Đóng"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5">
          {query.isLoading && (
            <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300" role="status">
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
              Đang tải cài đặt...
            </p>
          )}
          {query.isError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
              Không thể tải Trí nhớ AI.
              <button type="button" onClick={() => query.refetch()} className="ml-2 font-semibold underline">
                Thử lại
              </button>
            </div>
          )}
          {query.data && (
            <>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-white/10">
                <div>
                  <p className="font-medium text-zinc-950 dark:text-white">Cho phép sử dụng trí nhớ</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                    Tắt sẽ dừng sử dụng ngay nhưng chưa xóa các lựa chọn đã lưu.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={query.data.enabled}
                  disabled={isPending}
                  onClick={() => consentMutation.mutate(!query.data.enabled)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50 ${
                    query.data.enabled ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none ${
                      query.data.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                  <span className="sr-only">Bật hoặc tắt Trí nhớ AI</span>
                </button>
              </div>

              <div className="mt-5 space-y-4" aria-disabled={!query.data.enabled}>
                {AI_MEMORY_FIELDS.map((field) => {
                  const entry = entryMap[field.kind];
                  return (
                    <div key={field.kind} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                      <label className="grid gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {field.label}
                        <select
                          value={entry?.value || ""}
                          disabled={!query.data.enabled || isPending}
                          onChange={(event) =>
                            valueMutation.mutate({ kind: field.kind, value: event.target.value })
                          }
                          className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-white/15 dark:bg-[#111318] dark:text-white dark:disabled:bg-white/5"
                        >
                          <option value="" disabled>Chưa chọn</option>
                          {field.options.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={!entry || isPending}
                        onClick={() => deleteKindMutation.mutate(field.kind)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-rose-300"
                      >
                        <Trash2 size={16} aria-hidden="true" /> Xóa
                      </button>
                    </div>
                  );
                })}
              </div>

              {actionError && <p className="mt-4 text-sm text-rose-700 dark:text-rose-300" role="alert">{actionError}</p>}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5 dark:border-white/10">
                <button type="button" onClick={exportMemory} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-zinc-200 dark:hover:bg-white/10">
                  <Download size={17} aria-hidden="true" /> Xuất JSON
                </button>
                {!confirmDeleteAll ? (
                  <button type="button" onClick={() => setConfirmDeleteAll(true)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:text-rose-300 dark:hover:bg-rose-500/10">
                    Xóa toàn bộ trí nhớ
                  </button>
                ) : (
                  <div className="flex items-center gap-2" role="group" aria-label="Xác nhận xóa toàn bộ">
                    <button type="button" onClick={() => setConfirmDeleteAll(false)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10">Hủy</button>
                    <button type="button" disabled={isPending} onClick={() => clearMutation.mutate()} className="min-h-11 rounded-xl bg-rose-700 px-3 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50">Xác nhận xóa</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
