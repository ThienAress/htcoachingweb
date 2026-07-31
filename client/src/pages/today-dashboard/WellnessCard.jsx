import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { correctDailyJournal, saveDailyJournal, submitDailyJournal } from "../../services/dailyJournal.service";
import { getMyWellnessTarget } from "../../services/wellnessTarget.service";
import { WellnessFields } from "./WellnessFields";
import { WellnessSaveError } from "./WellnessSaveError";
import { WellnessTargetSummary } from "./WellnessTargetSummary";
import { WellnessHeader } from "./WellnessHeader";
import { journalToWellnessValues, wellnessFormSchema, wellnessValuesToPatch } from "./wellness";

const newRequestId = () => window.crypto.randomUUID();

export const WellnessCard = ({ dateKey, journal, canEdit, onChanged }) => {
  const queryClient = useQueryClient();
  const [localJournal, setLocalJournal] = useState(journal);
  const [saveState, setSaveState] = useState("idle");
  const [correctionReason, setCorrectionReason] = useState("");
  const latestRef = useRef(journal);
  const queuedRef = useRef(null);
  const failedRef = useRef(null);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const suppressRef = useRef(false);
  const flushRef = useRef(null);
  const {
    register,
    watch,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(wellnessFormSchema),
    defaultValues: journalToWellnessValues(journal),
    mode: "onChange",
  });
  const painValue = watch("pain");
  const sleepHours = watch("sleepHours");
  const waterMl = watch("waterMl");
  const steps = watch("steps");
  const targetQuery = useQuery({
    queryKey: ["wellness-target", "me", dateKey],
    queryFn: async () => (await getMyWellnessTarget(dateKey)).data.data,
    staleTime: 30_000,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });

  const command = useMutation({
    mutationFn: ({ kind, payload }) => {
      if (kind === "submit") return submitDailyJournal(dateKey, payload);
      if (kind === "correction") {
        return correctDailyJournal(dateKey, payload);
      }
      return saveDailyJournal(dateKey, payload);
    },
  });

  const acceptResponse = useCallback(
    (response) => {
      const nextJournal = response.data.data;
      latestRef.current = nextJournal;
      failedRef.current = null;
      if (mountedRef.current) {
        setLocalJournal(nextJournal);
        setSaveState("saved");
      }
      onChanged?.(nextJournal);
      void queryClient.invalidateQueries({
        queryKey: ["daily-journal-timeline", dateKey],
      });
      return nextJournal;
    },
    [dateKey, onChanged, queryClient],
  );

  const persistValues = useCallback(
    async (
      values,
      { silent = false, requestId = newRequestId() } = {},
    ) => {
      if (!canEdit || latestRef.current?.status === "submitted") return null;
      const parsed = wellnessFormSchema.safeParse(values);
      if (!parsed.success) return null;
      if (inFlightRef.current) {
        queuedRef.current = values;
        return null;
      }
      inFlightRef.current = true;
      if (!silent && mountedRef.current) setSaveState("saving");
      try {
        const response = await command.mutateAsync({
          kind: "save",
          payload: {
            expectedRevision: latestRef.current?.revision || 0,
            requestId,
            patch: wellnessValuesToPatch(parsed.data),
          },
        });
        return acceptResponse(response);
      } catch (error) {
        failedRef.current = { kind: "save", values, requestId };
        if (mountedRef.current) {
          setSaveState(
            error.response?.status === 409 ? "conflict" : "error",
          );
        }
        return null;
      } finally {
        inFlightRef.current = false;
        if (queuedRef.current && mountedRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            void flushRef.current?.();
          }, 300);
        }
      }
    },
    [acceptResponse, canEdit, command],
  );

  const flushQueued = useCallback(
    async (options) => {
      clearTimeout(timerRef.current);
      const values = queuedRef.current;
      queuedRef.current = null;
      return values ? persistValues(values, options) : latestRef.current;
    },
    [persistValues],
  );
  flushRef.current = flushQueued;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      if (queuedRef.current && !inFlightRef.current) {
        void flushRef.current?.({ silent: true });
      }
    };
  }, []);

  useEffect(() => {
    if (journal?.revision === latestRef.current?.revision) return;
    suppressRef.current = true;
    latestRef.current = journal;
    failedRef.current = null;
    queuedRef.current = null;
    setLocalJournal(journal);
    setSaveState("idle");
    reset(journalToWellnessValues(journal));
    queueMicrotask(() => {
      suppressRef.current = false;
    });
  }, [journal, reset]);

  useEffect(() => {
    const subscription = watch((values) => {
      if (
        suppressRef.current ||
        !canEdit ||
        latestRef.current?.status === "submitted"
      ) {
        return;
      }
      queuedRef.current = values;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flushRef.current?.();
      }, 900);
    });
    return () => subscription.unsubscribe();
  }, [canEdit, watch]);

  useEffect(() => {
    if (saveState !== "saved") return undefined;
    const timer = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [saveState]);

  const runManualCommand = useCallback(
    async (pending) => {
      if (inFlightRef.current) return null;
      inFlightRef.current = true;
      setSaveState("saving");
      try {
        const response = await command.mutateAsync(pending);
        const nextJournal = acceptResponse(response);
        if (pending.kind === "correction") setCorrectionReason("");
        return nextJournal;
      } catch (error) {
        failedRef.current = pending;
        setSaveState(
          error.response?.status === 409 ? "conflict" : "error",
        );
        return null;
      } finally {
        inFlightRef.current = false;
      }
    },
    [acceptResponse, command],
  );

  const submitDay = handleSubmit(async () => {
    const saved = await flushQueued();
    if (!saved) return;
    const current = latestRef.current;
    if (!current || current.status !== "draft" || inFlightRef.current) return;
    await runManualCommand({
      kind: "submit",
      payload: {
        expectedRevision: current.revision,
        requestId: newRequestId(),
      },
    });
  });

  const saveCorrection = handleSubmit(async (values) => {
    if (correctionReason.trim().length < 3 || inFlightRef.current) return;
    await runManualCommand({
      kind: "correction",
      payload: {
        expectedRevision: latestRef.current.revision,
        requestId: newRequestId(),
        reason: correctionReason.trim(),
        patch: wellnessValuesToPatch(values),
      },
    });
  });

  const retryFailed = () => {
    const failed = failedRef.current;
    if (!failed) return;
    if (failed.kind === "save") {
      void persistValues(failed.values, {
        requestId: failed.requestId,
      });
      return;
    }
    void runManualCommand(failed);
  };

  const disabled = !canEdit || saveState === "saving";
  return (
    <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
      <WellnessHeader saveState={saveState} />
      <WellnessTargetSummary
        target={targetQuery.data}
        actual={{ sleepHours, waterMl, steps }}
        isLoading={targetQuery.isLoading}
        isError={targetQuery.isError}
        onRetry={() => targetQuery.refetch()}
      />

      {!canEdit && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          <ShieldAlert size={17} className="mt-0.5 shrink-0" />
          Ngày này chỉ có thể xem hoặc tính năng ghi nhật ký chưa được bật.
        </p>
      )}

      <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
        <WellnessFields
          register={register}
          errors={errors}
          disabled={disabled}
          painValue={painValue}
        />

        {localJournal?.status === "submitted" ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <label className="text-sm font-medium text-slate-300">
              Lý do chỉnh sửa sau khi gửi
              <input
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                disabled={disabled}
                maxLength={500}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30"
              />
            </label>
            <button
              type="button"
              onClick={saveCorrection}
              disabled={disabled || correctionReason.trim().length < 3}
              className="mt-3 min-h-11 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lưu bản chỉnh sửa
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={submitDay}
            disabled={disabled || !localJournal?.revision}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
            Gửi nhật ký ngày
          </button>
        )}
      </form>

      <WellnessSaveError
        state={saveState}
        onReload={() => onChanged?.()}
        onRetry={retryFailed}
      />
    </section>
  );
};
