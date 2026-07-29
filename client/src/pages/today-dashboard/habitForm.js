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

export const habitFormToPayload = (values, dateKey, { trainer = false } = {}) => ({
  title: values.title.trim(),
  category: values.category,
  schedule: {
    daysOfWeek: [...values.daysOfWeek].sort(),
    startDateKey: dateKey,
    endDateKey: null,
  },
  visibility: trainer || values.shared ? "shared" : "private",
});
