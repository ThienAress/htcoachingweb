import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, Pencil, Send, ShieldAlert } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  correctDailyJournal,
  submitDailyJournal,
} from "../../services/dailyJournal.service";
import { getMyWellnessTarget } from "../../services/wellnessTarget.service";
import { WellnessFields } from "./WellnessFields";
import { WellnessHeader } from "./WellnessHeader";
import { WellnessSaveError } from "./WellnessSaveError";
import { WellnessTargetSummary } from "./WellnessTargetSummary";
import {
  journalToWellnessValues,
  wellnessFormSchema,
  wellnessValuesToPatch,
} from "./wellness";

const newRequestId = () => window.crypto.randomUUID();

export const WellnessCard = ({ dateKey, journal, canEdit, onChanged }) => {
  const queryClient = useQueryClient();
  const [localJournal, setLocalJournal] = useState(journal);
  const [saveState, setSaveState] = useState("idle");
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const failedRef = useRef(null);
  const {
    register,
    control,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(wellnessFormSchema),
    defaultValues: journalToWellnessValues(journal),
    mode: "onChange",
  });

  const [painValue, sleepHours, waterMl, steps] = useWatch({
    control,
    name: ["pain", "sleepHours", "waterMl", "steps"],
  });
  const submitted = localJournal?.status === "submitted";
  const correctionUsed = (localJournal?.correctionCount || 0) >= 1;

  const targetQuery = useQuery({
    queryKey: ["wellness-target", "me", dateKey],
    queryFn: async () => (await getMyWellnessTarget(dateKey)).data.data,
    staleTime: 30_000,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  const command = useMutation({
    mutationFn: ({ kind, payload }) =>
      kind === "correction"
        ? correctDailyJournal(dateKey, payload)
        : submitDailyJournal(dateKey, payload),
  });

  const acceptResponse = useCallback(
    (response) => {
      const nextJournal = response.data.data;
      setLocalJournal(nextJournal);
      setIsCorrectionOpen(false);
      setSaveState("saved");
      failedRef.current = null;
      reset(journalToWellnessValues(nextJournal));
      onChanged?.(nextJournal);
      void queryClient.invalidateQueries({
        queryKey: ["daily-journal-timeline", dateKey],
      });
    },
    [dateKey, onChanged, queryClient, reset],
  );

  const runCommand = useCallback(
    async (pending) => {
      if (command.isPending) return;
      setSaveState("saving");
      try {
        acceptResponse(await command.mutateAsync(pending));
      } catch (error) {
        failedRef.current = pending;
        setSaveState(error.response?.status === 409 ? "conflict" : "error");
      }
    },
    [acceptResponse, command],
  );

  const submitValues = async (values) => {
    if (!canEdit || command.isPending) return;
    const kind = submitted ? "correction" : "submit";
    if (kind === "correction" && (!isCorrectionOpen || correctionUsed)) return;
    await runCommand({
      kind,
      payload: {
        expectedRevision: localJournal?.revision || 0,
        requestId: newRequestId(),
        patch: wellnessValuesToPatch(values),
      },
    });
  };

  const cancelCorrection = () => {
    reset(journalToWellnessValues(localJournal));
    setIsCorrectionOpen(false);
    setSaveState("idle");
  };

  const disabled =
    !canEdit || command.isPending || (submitted && !isCorrectionOpen);

  return (
    <section className="mb-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
      <WellnessHeader saveState={saveState} submitted={submitted} />
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

      {submitted && !isCorrectionOpen && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm leading-6 text-slate-300">
          <LockKeyhole size={17} className="mt-1 shrink-0 text-orange-300" />
          {correctionUsed
            ? "Nhật ký đã khóa. Bạn đã sử dụng lượt cập nhật duy nhất cho ngày này."
            : "Nhật ký đã gửi và đang được khóa. Bạn còn một lượt cập nhật cho ngày này."}
        </p>
      )}

      <form
        className="space-y-5"
        onSubmit={(event) => void handleSubmit(submitValues)(event)}
      >
        <WellnessFields
          register={register}
          errors={errors}
          disabled={disabled}
          painValue={painValue}
        />

        {!submitted ? (
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} aria-hidden="true" />
            {command.isPending ? "Đang gửi..." : "Gửi nhật ký ngày"}
          </button>
        ) : !correctionUsed && !isCorrectionOpen ? (
          <button
            type="button"
            onClick={() => setIsCorrectionOpen(true)}
            disabled={!canEdit}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-orange-400 px-4 py-2 text-sm font-bold text-orange-200 hover:bg-orange-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil size={16} aria-hidden="true" /> Cập nhật
          </button>
        ) : isCorrectionOpen ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={command.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              {command.isPending ? "Đang cập nhật..." : "Gửi cập nhật"}
            </button>
            <button
              type="button"
              onClick={cancelCorrection}
              disabled={command.isPending}
              className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              Hủy
            </button>
          </div>
        ) : null}
      </form>

      <WellnessSaveError
        state={saveState}
        onReload={() => onChanged?.()}
        onRetry={() => failedRef.current && void runCommand(failedRef.current)}
      />
    </section>
  );
};
