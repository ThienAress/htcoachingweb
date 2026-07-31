import { getVietnamDateKey } from "../../utils/vietnamDate";
import { z } from "zod";

export const habitFormSchema = z.object({
  title: z.string().trim().min(1).max(100),
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
  category: "recovery",
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  shared: false,
};

export const habitToFormValues = (habit) => ({
  title: habit?.title || "",
  category: habit?.category || "recovery",
  daysOfWeek: [...(habit?.schedule?.daysOfWeek || habitFormDefaults.daysOfWeek)],
  shared: habit?.visibility === "shared",
});

export const habitFormToPayload = (
  values,
  dateKey,
  { trainer = false, habit = null, todayDateKey = getVietnamDateKey() } = {},
) => ({
  title: values.title.trim(),
  ...(habit
    ? {
        description: habit.description || "",
        target: habit.target ?? null,
        unit: habit.unit || "",
      }
    : {}),
  category: values.category,
  schedule: trainer
    ? {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startDateKey: habit?.schedule?.startDateKey || todayDateKey,
        endDateKey: null,
      }
    : {
        daysOfWeek: [...values.daysOfWeek].sort(),
        startDateKey: habit?.schedule?.startDateKey || dateKey,
        endDateKey: habit?.schedule?.endDateKey || null,
      },
  visibility: trainer || values.shared ? "shared" : "private",
});
