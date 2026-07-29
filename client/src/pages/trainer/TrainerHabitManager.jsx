import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import {
  changeCoachingHabitStatus,
  createTrainerClientHabit,
  listTrainerClientHabits,
} from "../../services/coachingHabit.service";
import { CreateHabitForm } from "../today-dashboard/CreateHabitForm";
import { HabitDefinitionActions } from "../today-dashboard/HabitDefinitionActions";

const requestId = () => window.crypto.randomUUID();

export const TrainerHabitManager = ({ clientId, dateKey }) => {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [failedCommand, setFailedCommand] = useState(null);
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
    mutationFn: ({ kind, habitId, payload }) =>
      kind === "create"
        ? createTrainerClientHabit(clientId, payload)
        : changeCoachingHabitStatus(habitId, payload),
    onSuccess: () => {
      setNotice("Đã cập nhật Coaching Habit.");
      setFailedCommand(null);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (_error, variables) => {
      setNotice("");
      setFailedCommand(variables);
    },
  });

  const createHabit = (data) =>
    command.mutate({
      kind: "create",
      payload: { ...data, requestId: requestId() },
    });
  const changeStatus = (habit, status) =>
    command.mutate({
      kind: "status",
      habitId: habit._id,
      payload: {
        status,
        expectedVersion: habit.version,
        requestId: requestId(),
      },
    });

  const habits = (habitsQuery.data?.items || []).filter(
    (habit) => habit.status !== "archived",
  );
  const message =
    command.error?.response?.data?.message ||
    "Không thể cập nhật Coaching Habit lúc này.";

  return (
    <section className="rounded-2xl border border-gray-700/40 bg-gray-900/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-white">Coaching Habits</h2>
          <p className="mt-1 text-xs leading-5 text-gray-400">
            Habit do học viên tự tạo chỉ hiện khi họ chủ động chia sẻ.
          </p>
        </div>
        <span className="text-xs font-semibold text-primary">
          {habits.length} habits
        </span>
      </div>

      {habitsQuery.isLoading ? (
        <p className="mt-4 text-sm text-gray-400">Đang tải habits...</p>
      ) : habitsQuery.isError ? (
        <button
          type="button"
          onClick={() => habitsQuery.refetch()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          <RefreshCw size={15} /> Tải lại
        </button>
      ) : habits.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">Chưa có habit được chia sẻ hoặc giao.</p>
      ) : (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {habits.map((habit) => (
            <li key={habit._id} className="rounded-xl border border-gray-700/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{habit.title}</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {habit.createdByRole === "trainer" ? "HLV giao" : "Học viên chia sẻ"}
                    {` · ${habit.currentStreak} ngày`}
                  </p>
                </div>
                <span className="text-xs text-gray-400">v{habit.version}</span>
              </div>
              {habit.createdByRole === "trainer" && (
                <div className="mt-3">
                  <HabitDefinitionActions
                    habit={habit}
                    disabled={command.isPending}
                    onStatus={changeStatus}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <CreateHabitForm
        dateKey={dateKey}
        disabled={command.isPending}
        onCreate={createHabit}
        trainerMode
      />
      <div className="mt-3" aria-live="polite">
        {notice && <p className="text-sm text-emerald-300">{notice}</p>}
        {command.error && (
          <div className="text-sm text-red-300">
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
                className="mt-2 min-h-11 rounded-lg px-3 py-2 font-semibold hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"
              >
                {command.error?.response?.status === 409 ? "Tải dữ liệu mới" : "Thử lại"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
