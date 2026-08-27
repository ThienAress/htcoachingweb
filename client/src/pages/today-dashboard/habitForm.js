import {
  addDaysToDateKey,
  getAppDayOfWeek,
} from "../../utils/vietnamDate";
import { z } from "zod";

export const HABIT_DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const habitFormSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  category: z.enum([
    "nutrition",
    "movement",
    "recovery",
    "mindset",
    "other",
  ]),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  shared: z.boolean(),
});

export const habitFormDefaults = {
  title: "",
  description: "",
  category: "recovery",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  shared: false,
};

export const habitToFormValues = (habit) => ({
  title: habit?.title || "",
  description: habit?.description || "",
  category: habit?.category || "recovery",
  daysOfWeek: [...(habit?.schedule?.daysOfWeek || habitFormDefaults.daysOfWeek)],
  shared: habit?.visibility === "shared",
});

export const getHabitWeekRange = (dateKey) => {
  const startDateKey = addDaysToDateKey(
    dateKey,
    -getAppDayOfWeek(dateKey),
  );
  return {
    startDateKey,
    endDateKey: addDaysToDateKey(startDateKey, 6),
  };
};

const formatDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
};

export const habitScheduleLabel = (schedule = {}) => {
  const days = (schedule.daysOfWeek || [])
    .map((day) => HABIT_DAY_LABELS[day])
    .filter(Boolean)
    .join(", ");
  const range = schedule.endDateKey
    ? `${formatDateKey(schedule.startDateKey)} – ${formatDateKey(schedule.endDateKey)}`
    : `Từ ${formatDateKey(schedule.startDateKey)}`;
  return [days, range].filter(Boolean).join(" · ");
};

export const habitFormToPayload = (
  values,
  dateKey,
  { trainer = false, habit = null } = {},
) => ({
  title: values.title.trim(),
  description: values.description.trim(),
  ...(habit
    ? {
        target: habit.target ?? null,
        unit: habit.unit || "",
      }
    : {}),
  category: values.category,
  schedule: trainer
    ? {
        daysOfWeek: [...values.daysOfWeek].sort(),
        ...getHabitWeekRange(dateKey),
      }
    : {
        daysOfWeek: [...values.daysOfWeek].sort(),
        startDateKey: habit?.schedule?.startDateKey || dateKey,
        endDateKey: habit?.schedule?.endDateKey || null,
      },
  visibility: trainer || values.shared ? "shared" : "private",
});
