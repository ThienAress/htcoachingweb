import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Plus, Repeat2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import {
  changeCoachingHabitStatus,
  createTrainerClientHabit,
  listTrainerClientHabits,
  updateCoachingHabitDefinition,
} from "../../services/coachingHabit.service";
import { CreateHabitForm } from "../today-dashboard/CreateHabitForm";
import { HabitDefinitionActions } from "../today-dashboard/HabitDefinitionActions";
import { habitScheduleLabel } from "../today-dashboard/habitForm";

const requestId = () => window.crypto.randomUUID();

const STREAK_COLOR = (streak) => {
  if (streak >= 14) return "text-emerald-400";
  if (streak >= 7) return "text-orange-400";
  return "text-gray-500";
};

export const TrainerHabitManager = ({ clientId, dateKey }) => {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [failedCommand, setFailedCommand] = useState(null);
  const [editingHabit, setEditingHabit] = useState(null);
  const queryKey = ["coaching-habits", "trainer", clientId, dateKey];
  const habitsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await listTrainerClientHabits(clientId, dateKey);
      return response.data.data;
    },
    enabled: Boolean(clientId && dateKey),
    staleTime: 30_000,
  });
  const command = useMutation({
    mutationFn: ({ kind, habitId, payload }) => {
      if (kind === "create") {
        return createTrainerClientHabit(clientId, payload);
      }
      if (kind === "update") {
        return updateCoachingHabitDefinition(habitId, payload);
      }
      return changeCoachingHabitStatus(habitId, payload);
    },
    onSuccess: (_response, variables) => {
      const deleted =
        variables.kind === "status" &&
        variables.payload.status === "archived";
      const successMessage =
        deleted
          ? "Đã xóa thói quen khỏi kế hoạch của học viên."
          : variables.kind === "create"
            ? "Đã giao thói quen cho học viên."
            : "Đã cập nhật thói quen cho học viên.";
      setNotice(successMessage);
      toast.success(successMessage);
      if (variables.kind === "update" || deleted) setEditingHabit(null);
      setFailedCommand(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error, variables) => {
      setNotice("");
      setFailedCommand(variables);
      toast.error(
        error.response?.data?.message || "Không thể cập nhật thói quen lúc này",
      );
    },
  });

  const createHabit = (data) =>
    command.mutate({
      kind: "create",
      payload: { ...data, requestId: requestId() },
    });

  const updateHabit = (habit, data) =>
    command.mutate({
      kind: "update",
      habitId: habit._id,
      payload: {
        ...data,
        expectedVersion: habit.version,
        requestId: requestId(),
      },
    });

  const deleteHabit = (habit) =>
    command.mutate({
      kind: "status",
      habitId: habit._id,
      payload: {
        status: "archived",
        expectedVersion: habit.version,
        requestId: requestId(),
      },
    });

  const habits = (habitsQuery.data?.items || []).filter(
    (habit) => habit.status !== "archived",
  );
  const message =
    command.error?.response?.data?.message ||
    "Không thể cập nhật thói quen lúc này.";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
            <Repeat2 className="h-6 w-6 text-cyan-300" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-50 sm:text-2xl">Thói quen khách hàng</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Giao thói quen theo từng ngày trong tuần để học viên thực hiện đúng lịch.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-200">
          {habits.length} thói quen
        </span>
      </div>

      <div className="space-y-5 p-5">
        {/* Habit list */}
        {habitsQuery.isLoading ? (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-xl bg-gray-800/60" />
            <div className="h-16 animate-pulse rounded-xl bg-gray-800/40" />
          </div>
        ) : habitsQuery.isError ? (
          <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-red-300" role="alert">
            <p className="text-sm">
              {habitsQuery.error?.response?.data?.message ||
                "Không thể tải thói quen của học viên. Vui lòng kiểm tra kết nối và thử lại."}
            </p>
            <button
              type="button"
              onClick={() => habitsQuery.refetch()}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <RefreshCw size={14} aria-hidden="true" /> Tải lại
            </button>
          </div>
        ) : habits.length === 0 ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-900">
              <Repeat2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-200">
              Chưa có thói quen
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Chưa có thói quen được chia sẻ hoặc giao.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {habits.map((habit) => (
              <li
                key={habit._id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-5 text-slate-50">
                    {habit.title}
                  </h3>
                  {habit.currentStreak > 0 && (
                    <div className={`flex items-center gap-1 shrink-0 ${STREAK_COLOR(habit.currentStreak)}`}>
                      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="text-xs font-bold tabular-nums">{habit.currentStreak}</span>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {habit.createdByRole === "trainer" ? "HLV giao" : "Học viên chia sẻ"}
                  {habit.currentStreak > 0 && ` · ${habit.currentStreak} ngày liên tiếp`}
                </p>
                {habit.description && (
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {habit.description}
                  </p>
                )}
                <p className="mt-2 text-xs leading-5 text-cyan-200/80">
                  {habitScheduleLabel(habit.schedule)}
                </p>
                {habit.createdByRole === "trainer" && (
                  <div className="mt-2.5">
                    <HabitDefinitionActions
                      habit={habit}
                      disabled={command.isPending}
                      variant="trainer"
                      onEdit={setEditingHabit}
                      onDelete={deleteHabit}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Edit form */}
        {editingHabit && (
          <div className="border-t border-slate-800 pt-5">
            <CreateHabitForm
              dateKey={dateKey}
              disabled={command.isPending}
              trainerMode
              initialHabit={editingHabit}
              onUpdate={(data) => updateHabit(editingHabit, data)}
              onCancel={() => setEditingHabit(null)}
            />
          </div>
        )}

        {/* Create form */}
        <div className="border-t border-slate-800 pt-5">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Plus className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            Giao thói quen mới
          </p>
          <CreateHabitForm
            dateKey={dateKey}
            disabled={command.isPending}
            onCreate={createHabit}
            trainerMode
          />
        </div>

        {/* Feedback */}
        <div aria-live="polite">
          {notice && (
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              {notice}
            </p>
          )}
          {command.error && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-xs text-red-300">
              <p>{message}</p>
              {failedCommand && (
                <button
                  type="button"
                  onClick={() =>
                    command.error?.response?.status === 409
                      ? habitsQuery.refetch()
                      : command.mutate(failedCommand)
                  }
                  disabled={command.isPending}
                  className="mt-2 min-h-11 rounded-lg border border-red-500/20 bg-red-500/10 px-3 font-semibold hover:bg-red-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"
                >
                  {command.error?.response?.status === 409
                    ? "Tải dữ liệu mới"
                    : "Thử lại"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
