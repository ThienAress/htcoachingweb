import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Flame, RefreshCw, SkipForward } from "lucide-react";
import { useState } from "react";
import {
  correctDailyJournal,
  saveDailyJournal,
} from "../../services/dailyJournal.service";
import {
  changeCoachingHabitStatus,
  createMyCoachingHabit,
  listMyCoachingHabits,
} from "../../services/coachingHabit.service";
import { CreateHabitForm } from "./CreateHabitForm";
import { upsertHabitCompletion } from "./dailyHabits";
import { HabitDefinitionActions } from "./HabitDefinitionActions";

const requestId = () => window.crypto.randomUUID();
const apiMessage = (error) =>
  error.response?.data?.message || "Không thể cập nhật thói quen lúc này.";
export const HabitCard = ({ dateKey, journal, canEdit, onChanged }) => {
  const queryClient = useQueryClient();
  const [correctionReason, setCorrectionReason] = useState("");
  const [notice, setNotice] = useState("");
  const [localError, setLocalError] = useState("");
  const [failedDefinition, setFailedDefinition] = useState(null);
  const [failedCompletion, setFailedCompletion] = useState(null);
  const completions = journal?.habitCompletions || [];
  const isSubmitted = journal?.status === "submitted";
  const habitsQuery = useQuery({
    queryKey: ["coaching-habits", "my", dateKey],
    queryFn: async () => {
      const response = await listMyCoachingHabits(dateKey);
      return response.data.data;
    },
    staleTime: 30_000,
  });

  const definitionMutation = useMutation({
    mutationFn: ({ kind, habitId, payload }) =>
      kind === "create"
        ? createMyCoachingHabit(payload)
        : changeCoachingHabitStatus(habitId, payload),
    onSuccess: () => {
      setNotice("Đã cập nhật thói quen.");
      setFailedDefinition(null);
      void queryClient.invalidateQueries({
        queryKey: ["coaching-habits", "my", dateKey],
      });
    },
    onError: (_error, variables) => {
      setNotice("");
      setFailedDefinition(variables);
    },
  });

  const completionMutation = useMutation({
    mutationFn: ({ kind, payload }) =>
      kind === "correction"
        ? correctDailyJournal(dateKey, payload)
        : saveDailyJournal(dateKey, payload),
    onSuccess: (response) => {
      setNotice("Đã cập nhật trạng thái thói quen trong ngày.");
      setFailedCompletion(null);
      setCorrectionReason("");
      onChanged?.(response.data.data);
      void queryClient.invalidateQueries({
        queryKey: ["coaching-habits", "my", dateKey],
      });
      void queryClient.invalidateQueries({
        queryKey: ["daily-journal-timeline", dateKey],
      });
    },
    onError: (_error, variables) => {
      setNotice("");
      setFailedCompletion(variables);
    },
  });

  const correctionReady =
    !isSubmitted || correctionReason.trim().length >= 3;
  const isPending =
    definitionMutation.isPending || completionMutation.isPending;
  const disabled = !canEdit || !correctionReady || isPending;
  const createHabit = (data) => {
    setLocalError("");
    definitionMutation.mutate({
      kind: "create",
      payload: { ...data, requestId: requestId() },
    });
  };
  const changeStatus = (habit, status) => {
    setLocalError("");
    definitionMutation.mutate({
      kind: "status",
      habitId: habit._id,
      payload: {
        status,
        expectedVersion: habit.version,
        requestId: requestId(),
      },
    });
  };

  const completeHabit = (habit, status) => {
    try {
      setLocalError("");
      const kind = isSubmitted ? "correction" : "update";
      completionMutation.mutate({
        kind,
        payload: {
          expectedRevision: journal?.revision || 0,
          requestId: requestId(),
          patch: {
            habitCompletions: upsertHabitCompletion(completions, {
              habitId: habit._id,
              lineageKey: habit.lineageKey,
              status,
            }),
          },
          ...(kind === "correction"
            ? { reason: correctionReason.trim() }
            : {}),
        },
      });
    } catch (error) {
      setLocalError(error.message);
    }
  };

  const habits = habitsQuery.data?.items || [];
  const scheduled = habits.filter(
    (habit) => habit.status === "active" && habit.scheduledToday,
  );
  const paused = habits.filter((habit) => habit.status === "paused");
  const mutationError = definitionMutation.error || completionMutation.error;
  const stale = mutationError?.response?.status === 409;
  return (
    <section
      className="mb-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6"
      aria-labelledby="daily-habits-title"
      aria-busy={isPending}
    >
      <div className="flex items-center gap-3">
        <Flame className="text-orange-400" size={24} aria-hidden="true" />
        <div>
          <h2
            id="daily-habits-title"
            className="text-xl font-bold text-white sm:text-2xl"
          >
            Thói quen hôm nay
          </h2>
        </div>
      </div>

      {isSubmitted && (
        <div className="mt-4">
          <label htmlFor="habit-correction-reason" className="text-sm text-slate-300">
            Lý do chỉnh sửa thói quen sau khi gửi
          </label>
          <input
            id="habit-correction-reason"
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
            maxLength={500}
            disabled={!canEdit || isPending}
            placeholder="Nhập ít nhất 3 ký tự"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/30 disabled:opacity-50"
          />
        </div>
      )}

      {habitsQuery.isLoading ? (
        <p className="mt-4 text-sm text-slate-400">Đang tải thói quen...</p>
      ) : habitsQuery.isError ? (
        <button
          type="button"
          onClick={() => habitsQuery.refetch()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <RefreshCw size={15} /> Tải lại thói quen
        </button>
      ) : scheduled.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          Không có thói quen đang hoạt động được lên lịch cho ngày này.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {scheduled.map((habit) => {
            const completion = completions.find(
              (item) => item.lineageKey === habit.lineageKey,
            );
            return (
              <li key={habit._id} className="rounded-xl border border-slate-700 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{habit.title}</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {habit.createdByRole === "trainer" ? "HLV giao" : "Tự tạo"}
                      {habit.visibility === "private" ? " · Riêng tư" : " · Đã chia sẻ"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold text-orange-300">
                    {habit.currentStreak} ngày
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => completeHabit(habit, "completed")}
                    disabled={disabled}
                    aria-pressed={completion?.status === "completed"}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-40 ${
                      completion?.status === "completed" ? "bg-emerald-950/50" : ""
                    }`}
                  >
                    <Check size={15} aria-hidden="true" /> Hoàn thành
                  </button>
                  <button
                    type="button"
                    onClick={() => completeHabit(habit, "skipped")}
                    disabled={disabled}
                    aria-pressed={completion?.status === "skipped"}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-40 ${
                      completion?.status === "skipped"
                        ? "border-orange-400 bg-orange-500/10"
                        : "border-slate-700"
                    }`}
                  >
                    <SkipForward size={15} aria-hidden="true" /> Bỏ qua
                  </button>
                  {habit.createdByRole === "user" && (
                    <HabitDefinitionActions
                      habit={habit}
                      disabled={!canEdit || isPending}
                      onStatus={changeStatus}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {paused.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-300">Đang tạm dừng</h3>
          <div className="mt-2 grid gap-2">
            {paused
              .filter((habit) => habit.createdByRole === "user")
              .map((habit) => (
                <div
                  key={habit._id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-700 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm text-slate-300">{habit.title}</span>
                  <HabitDefinitionActions
                    habit={habit}
                    disabled={!canEdit || isPending}
                    onStatus={changeStatus}
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      <CreateHabitForm dateKey={dateKey} disabled={!canEdit || isPending} onCreate={createHabit} />
      <div className="mt-4" aria-live="polite">
        {notice && <p className="text-sm text-green-300">{notice}</p>}
        {(localError || mutationError) && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-sm text-red-200">
            <p>{localError || apiMessage(mutationError)}</p>
            {(failedDefinition || failedCompletion) && (
              <button
                type="button"
                onClick={() => {
                  if (stale) {
                    onChanged?.();
                    void habitsQuery.refetch();
                  } else if (failedCompletion) {
                    completionMutation.mutate(failedCompletion);
                  } else {
                    definitionMutation.mutate(failedDefinition);
                  }
                }}
                disabled={isPending}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-semibold hover:bg-red-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"
              >
                <RefreshCw size={15} /> {stale ? "Tải dữ liệu mới" : "Thử lại"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
