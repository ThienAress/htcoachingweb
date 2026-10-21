import { z } from "zod";

const numberText = ({ label, min, max, integer = false, required = false }) =>
  z
    .string()
    .trim()
    .refine((value) => !required || value !== "", { message: `Vui lòng nhập ${label.toLowerCase()}.` })
    .refine(
      (value) => {
        if (value === "") return true;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= min && parsed <= max && (!integer || Number.isInteger(parsed));
      },
      { message: `${label} cần nằm trong khoảng từ ${min} đến ${max}.` },
    );

const text = (max) => z.string().trim().max(max, `Tối đa ${max} ký tự.`);
const choice = (message) => z.string().refine((value) => value !== "", { message });

export const screeningSchema = z.object({
  allowDataStorage: z.boolean().refine((value) => value === true, {
    message: "Bạn cần đồng ý cho phép lưu dữ liệu sức khỏe để tiếp tục.",
  }),
  painLevel: numberText({ label: "Mức độ đau", min: 0, max: 10, integer: true, required: true }),
  painLocation: z.array(z.string()),
  warningSigns: z.array(z.string()),
  injuries: text(500),
  currentConditions: text(500),
  surgeries: text(500),
  medications: text(500),
  doctorRestrictions: text(500),
});

export const profileSchema = z.object({
  age: numberText({ label: "Tuổi", min: 14, max: 90, integer: true, required: true }),
  gender: choice("Vui lòng chọn giới tính."),
  heightCm: numberText({ label: "Chiều cao", min: 100, max: 230, required: true }),
  weightKg: numberText({ label: "Cân nặng", min: 30, max: 250, required: true }),
  waistCm: numberText({ label: "Vòng eo", min: 40, max: 200 }),
  hipCm: numberText({ label: "Vòng hông", min: 50, max: 200 }),
  restingHeartRate: numberText({ label: "Nhịp tim nghỉ", min: 30, max: 140, integer: true }),
  sleepHours: numberText({ label: "Số giờ ngủ", min: 0, max: 14 }),
  stressLevel: z.string(),
  workActivityLevel: z.string(),
  currentlyTraining: choice("Vui lòng chọn tình trạng tập hiện tại."),
  trainingExperience: choice("Vui lòng chọn kinh nghiệm tập."),
  trainingDaysPerWeek: numberText({ label: "Số buổi tập mỗi tuần", min: 0, max: 7, integer: true }),
  sessionDurationMinutes: numberText({ label: "Thời lượng mỗi buổi", min: 0, max: 240, integer: true }),
  breakDuration: text(60),
  primaryGoal: choice("Vui lòng chọn mục tiêu."),
  equipment: z.string(),
});

export const testsSchema = z
  .object({
    pushVariant: z.string(),
    pushReps: numberText({ label: "Số lần hít đất", min: 0, max: 300, integer: true }),
    chairReps: numberText({ label: "Số lần đứng lên", min: 0, max: 300, integer: true }),
    plankVariant: z.string(),
    plankSeconds: numberText({ label: "Thời gian plank", min: 0, max: 1800, integer: true }),
    walkMinutes: numberText({ label: "Thời gian đi bộ", min: 5, max: 60 }),
    walkEndHeartRate: numberText({ label: "Nhịp tim cuối bài", min: 60, max: 230, integer: true }),
  })
  .superRefine((values, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: "custom", path: [path], message });
    if (values.pushReps !== "" && !values.pushVariant) issue("pushVariant", "Vui lòng chọn cách hít đất bạn đã làm.");
    if (values.plankSeconds !== "" && !values.plankVariant) issue("plankVariant", "Vui lòng chọn cách plank bạn đã làm.");
    if (values.walkMinutes !== "" && values.walkEndHeartRate === "") issue("walkEndHeartRate", "Vui lòng nhập nhịp tim ngay sau khi đi bộ xong.");
    if (values.walkEndHeartRate !== "" && values.walkMinutes === "") issue("walkMinutes", "Vui lòng nhập thời gian đi bộ.");
  });

const str = (value) => (value === null || value === undefined ? "" : String(value));
const num = (value) => (value === "" || value === null || value === undefined ? null : Number(value));

export const screeningDefaults = (draft) => ({
  allowDataStorage: Boolean(draft?.consent?.allowDataStorage),
  painLevel: str(draft?.screening?.painLevel ?? 0),
  painLocation: draft?.screening?.painLocation || [],
  warningSigns: draft?.screening?.warningSigns || [],
  injuries: draft?.screening?.injuries || "",
  currentConditions: draft?.screening?.currentConditions || "",
  surgeries: draft?.screening?.surgeries || "",
  medications: draft?.screening?.medications || "",
  doctorRestrictions: draft?.screening?.doctorRestrictions || "",
});

export const screeningToPayload = (values) => ({
  step: 1,
  consent: { allowDataStorage: values.allowDataStorage },
  screening: {
    hasPainNow: Number(values.painLevel) > 0,
    painLevel: num(values.painLevel),
    painLocation: Number(values.painLevel) > 0 ? values.painLocation : [],
    warningSigns: values.warningSigns,
    injuries: values.injuries,
    currentConditions: values.currentConditions,
    surgeries: values.surgeries,
    medications: values.medications,
    doctorRestrictions: values.doctorRestrictions,
  },
});

export const profileDefaults = (source) => ({
  age: str(source?.profile?.age),
  gender: source?.profile?.gender || "",
  heightCm: str(source?.profile?.heightCm),
  weightKg: str(source?.profile?.weightKg),
  waistCm: str(source?.profile?.waistCm),
  hipCm: str(source?.profile?.hipCm),
  restingHeartRate: str(source?.profile?.restingHeartRate),
  sleepHours: str(source?.profile?.sleepHours),
  stressLevel: source?.profile?.stressLevel || "",
  workActivityLevel: source?.profile?.workActivityLevel || "",
  currentlyTraining: source?.training?.trainingExperience ? (source.training.currentlyTraining ? "yes" : "no") : "",
  trainingExperience: source?.training?.trainingExperience || "",
  trainingDaysPerWeek: str(source?.training?.trainingDaysPerWeek),
  sessionDurationMinutes: str(source?.training?.sessionDurationMinutes),
  breakDuration: source?.training?.breakDuration || "",
  primaryGoal: source?.training?.primaryGoal || "",
  equipment: source?.training?.equipment || "",
});

export const profileToPayload = (values) => ({
  step: 2,
  profile: {
    age: num(values.age),
    gender: values.gender,
    heightCm: num(values.heightCm),
    weightKg: num(values.weightKg),
    waistCm: num(values.waistCm),
    hipCm: num(values.hipCm),
    restingHeartRate: num(values.restingHeartRate),
    sleepHours: num(values.sleepHours),
    stressLevel: values.stressLevel,
    workActivityLevel: values.workActivityLevel,
  },
  training: {
    currentlyTraining: values.currentlyTraining === "yes",
    trainingExperience: values.trainingExperience,
    trainingDaysPerWeek: num(values.trainingDaysPerWeek),
    sessionDurationMinutes: num(values.sessionDurationMinutes),
    breakDuration: values.breakDuration,
    primaryGoal: values.primaryGoal,
    equipment: values.equipment,
  },
});

export const testsDefaults = (draft) => {
  const tests = draft?.tests || {};
  return {
    pushVariant: tests.upperBodyPush?.variant || "",
    pushReps: str(tests.upperBodyPush?.reps),
    chairReps: str(tests.lowerBody?.reps),
    plankVariant: tests.coreEndurance?.variant || "",
    plankSeconds: str(tests.coreEndurance?.seconds),
    walkMinutes: str(tests.cardio?.minutes),
    walkEndHeartRate: str(tests.cardio?.endHeartRate),
  };
};

export const hasAnyTestValue = (values) =>
  [values.pushReps, values.chairReps, values.plankSeconds, values.walkMinutes].some((value) => value !== "");

export const testsToPayload = (values) => ({
  step: 3,
  tests: {
    upperBodyPush: { variant: values.pushReps === "" ? "" : values.pushVariant, reps: num(values.pushReps) },
    lowerBody: { variant: values.chairReps === "" ? "" : "standard", reps: num(values.chairReps) },
    coreEndurance: { variant: values.plankSeconds === "" ? "" : values.plankVariant, seconds: num(values.plankSeconds) },
    cardio: {
      variant: values.walkMinutes === "" ? "" : "standard",
      minutes: num(values.walkMinutes),
      endHeartRate: num(values.walkEndHeartRate),
    },
  },
});
