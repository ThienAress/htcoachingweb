import { z } from "zod";

const optionalNumber = ({ min, max, integer = false }) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      const number = typeof value === "number" ? value : Number(value);
      return Number.isNaN(number) ? value : number;
    },
    (integer ? z.number().int() : z.number())
      .min(min)
      .max(max)
      .nullable(),
  );

export const wellnessFormSchema = z.object({
  sleepHours: optionalNumber({ min: 0, max: 24 }),
  waterMl: optionalNumber({ min: 0, max: 20000, integer: true }),
  steps: optionalNumber({ min: 0, max: 200000, integer: true }),
  energy: optionalNumber({ min: 1, max: 10, integer: true }),
  hunger: optionalNumber({ min: 1, max: 10, integer: true }),
  stress: optionalNumber({ min: 1, max: 10, integer: true }),
  soreness: optionalNumber({ min: 1, max: 10, integer: true }),
  pain: optionalNumber({ min: 0, max: 10, integer: true }),
  painArea: z.string().max(120),
  privateNote: z.string().max(2000),
  sharedNote: z.string().max(2000),
});

export const journalToWellnessValues = (journal) => ({
  sleepHours: journal?.wellness?.sleepHours ?? "",
  waterMl: journal?.wellness?.waterMl ?? "",
  steps: journal?.wellness?.steps ?? "",
  energy: journal?.wellness?.energy ?? "",
  hunger: journal?.wellness?.hunger ?? "",
  stress: journal?.wellness?.stress ?? "",
  soreness: journal?.wellness?.soreness ?? "",
  pain: journal?.wellness?.pain ?? "",
  painArea: journal?.wellness?.painArea || "",
  privateNote: journal?.notes?.private || "",
  sharedNote: journal?.notes?.shared || "",
});

export const wellnessValuesToPatch = (values) => {
  const parsed = wellnessFormSchema.parse(values);
  return {
    wellness: {
      sleepHours: parsed.sleepHours,
      waterMl: parsed.waterMl,
      steps: parsed.steps,
      energy: parsed.energy,
      hunger: parsed.hunger,
      stress: parsed.stress,
      soreness: parsed.soreness,
      pain: parsed.pain,
      painArea: parsed.painArea.trim(),
    },
    notes: {
      private: parsed.privateNote.trim(),
      shared: parsed.sharedNote.trim(),
    },
  };
};
