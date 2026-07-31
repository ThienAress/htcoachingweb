import { z } from "zod";

const optionalNumber = (min, max, integer = false) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === undefined) return null;
      const numeric = Number(value);
      return Number.isNaN(numeric) ? value : numeric;
    },
    (integer ? z.number().int() : z.number()).min(min).max(max).nullable(),
  );

export const weeklyFormSchema = z.object({
  weightKg: optionalNumber(30, 350),
  waistCm: optionalNumber(30, 300),
  energy: optionalNumber(1, 10, true),
  adherence: optionalNumber(1, 10, true),
  wins: z.string().trim().max(2000),
  challenges: z.string().trim().max(2000),
  note: z.string().trim().max(2000),
});

export const weeklyCheckinSchema = weeklyFormSchema.extend({
  correctionReason: z.string().trim().max(500),
});

export const weeklyFormDefaults = {
  weightKg: "",
  waistCm: "",
  energy: "",
  adherence: "",
  wins: "",
  challenges: "",
  note: "",
};

export const weeklyValuesToPatch = (values) => ({
  body: {
    weightKg: values.weightKg,
    waistCm: values.waistCm,
    energy: values.energy,
    adherence: values.adherence,
    wins: values.wins.trim(),
    challenges: values.challenges.trim(),
    note: values.note.trim(),
  },
});

export const checkinToWeeklyValues = (checkin) =>
  Object.fromEntries(
    Object.entries(weeklyFormDefaults).map(([key]) => [
      key,
      checkin?.body?.[key] === null ||
      checkin?.body?.[key] === undefined
        ? ""
        : String(checkin.body[key]),
    ]),
  );

export const weeklyCheckinPayload = weeklyValuesToPatch;

export const getAdherenceLevel = (score) => {
  if (score === "" || score === null || score === undefined) return null;
  const value = Number(score);
  if (!Number.isFinite(value) || value < 1 || value > 10) return null;
  if (value <= 3) return { label: "Cần hỗ trợ thêm", range: "1–3" };
  if (value <= 6) return { label: "Chưa ổn định", range: "4–6" };
  if (value <= 8) return { label: "Bám khá tốt", range: "7–8" };
  return { label: "Bám rất tốt", range: "9–10" };
};
