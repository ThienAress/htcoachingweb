export const GENDERS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
];

export const ACTIVITIES = [
  { value: "", label: "Chọn sau khi khai báo vận động" },
  { value: "sedentary", label: "Ít vận động cả ngày (1,2)" },
  { value: "light", label: "Vận động nhẹ cả ngày (1,4)" },
  { value: "moderate", label: "Vận động vừa cả ngày (1,55)" },
  { value: "active", label: "Vận động nhiều cả ngày (1,7)" },
  { value: "very_active", label: "Vận động rất nhiều cả ngày (1,85)" },
];

export const EVIDENCE_OPTIONS = {
  dailyMovement: [
    ["", "Chọn"],
    ["mostly_seated", "Chủ yếu ngồi"],
    ["mixed", "Ngồi/đi lại xen kẽ"],
    ["mostly_moving", "Đi lại phần lớn ngày"],
    ["physical_work", "Lao động thể chất"],
  ],
  steps: [
    ["", "Chọn"],
    ["under_5000", "Dưới 5.000"],
    ["between_5000_7999", "5.000–7.999"],
    ["between_8000_11999", "8.000–11.999"],
    ["at_least_12000", "Từ 12.000"],
  ],
  trainingFrequency: [
    ["", "Chọn"],
    ["none", "Không tập"],
    ["one_two", "1–2 buổi"],
    ["three_four", "3–4 buổi"],
    ["five_plus", "Từ 5 buổi"],
  ],
  trainingDuration: [
    ["", "Chọn"],
    ["none", "Không áp dụng"],
    ["under_30", "Dưới 30 phút"],
    ["between_30_45", "30–45 phút"],
    ["between_45_60", "45–60 phút"],
    ["over_60", "Trên 60 phút"],
  ],
  trainingIntensity: [
    ["", "Chọn"],
    ["none", "Không áp dụng"],
    ["easy", "Nhẹ"],
    ["moderate", "Vừa"],
    ["vigorous", "Cao"],
  ],
};

export const GOALS = [
  { value: "fat_loss", label: "Giảm mỡ" },
  { value: "maintenance", label: "Duy trì" },
  { value: "muscle_gain", label: "Tăng cơ" },
];

export const EVIDENCE_FIELDS = [
  ["dailyMovement", "Vận động ngoài buổi tập"],
  ["steps", "Số bước trung bình"],
  ["trainingFrequency", "Số buổi mỗi tuần"],
  ["trainingDuration", "Thời lượng mỗi buổi"],
  ["trainingIntensity", "Cường độ buổi tập"],
];

export const initialForm = {
  gender: "",
  age: "",
  heightCm: "",
  weightKg: "",
  activityLevel: "",
  dailyMovement: "",
  steps: "",
  trainingFrequency: "",
  trainingDuration: "",
  trainingIntensity: "",
  goal: "",
};

const REQUIRED_FIELDS = [
  "gender",
  "age",
  "heightCm",
  "weightKg",
  "dailyMovement",
  "steps",
  "trainingFrequency",
  "trainingDuration",
  "trainingIntensity",
  "goal",
];

const FIELD_LABELS = {
  gender: "Giới tính",
  age: "Tuổi",
  heightCm: "Chiều cao",
  weightKg: "Cân nặng",
  dailyMovement: "Vận động ngoài buổi tập",
  steps: "Số bước trung bình",
  trainingFrequency: "Số buổi mỗi tuần",
  trainingDuration: "Thời lượng mỗi buổi",
  trainingIntensity: "Cường độ buổi tập",
  goal: "Mục tiêu",
};

const allowedValues = {
  gender: new Set(GENDERS.map(({ value }) => value)),
  goal: new Set(GOALS.map(({ value }) => value)),
  ...Object.fromEntries(
    Object.entries(EVIDENCE_OPTIONS).map(([key, options]) => [
      key,
      new Set(options.map(([value]) => value).filter(Boolean)),
    ]),
  ),
};

export function createTdeeFormState(prefill = {}) {
  const form = { ...initialForm };
  if (!prefill || typeof prefill !== "object" || Array.isArray(prefill)) {
    return form;
  }

  for (const field of ["gender", "goal", ...Object.keys(EVIDENCE_OPTIONS)]) {
    if (allowedValues[field].has(prefill[field])) form[field] = prefill[field];
  }
  for (const field of ["age", "heightCm", "weightKg"]) {
    if (isTdeeInputWithinLimits(field, prefill[field])) {
      form[field] = String(prefill[field]);
    }
  }

  return {
    ...normalizeTrainingEvidence(form),
    activityLevel: "",
  };
}

export function getTdeeFormErrors(form) {
  const errors = {};
  for (const field of REQUIRED_FIELDS) {
    if (!form[field]) {
      errors[field] = `${FIELD_LABELS[field]} không được bỏ trống.`;
    }
  }
  for (const field of ["age", "heightCm", "weightKg"]) {
    if (form[field] && !isTdeeInputWithinLimits(field, form[field])) {
      const { min, max } = TDEE_INPUT_LIMITS[field];
      errors[field] = `${FIELD_LABELS[field]} phải từ ${min} đến ${max}.`;
    }
  }
  return errors;
}

export const fieldClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:disabled:bg-white/[0.04] motion-reduce:transition-none";

const getOptionLabel = (key, value) =>
  EVIDENCE_OPTIONS[key].find(([optionValue]) => optionValue === value)?.[1];

export const buildSubmitText = (form) => {
  const stepValue = {
    under_5000: "4000",
    between_5000_7999: "6500",
    between_8000_11999: "10000",
    at_least_12000: "12000",
  }[form.steps];
  const frequencyValue = {
    none: "0",
    one_two: "2",
    three_four: "4",
    five_plus: "5",
  }[form.trainingFrequency];
  const durationValue = {
    none: "0",
    under_30: "20",
    between_30_45: "40",
    between_45_60: "50",
    over_60: "70",
  }[form.trainingDuration];

  return `Tính TDEE: ${form.gender === "male" ? "Nam" : "Nữ"}, ${form.age} tuổi, ${form.heightCm}cm, ${form.weightKg}kg, ${
    ACTIVITIES.find((activity) => activity.value === form.activityLevel)?.label
  }, vận động ngoài buổi tập: ${getOptionLabel("dailyMovement", form.dailyMovement)}, số bước: ${stepValue} bước/ngày, tập ${frequencyValue} buổi/tuần, ${durationValue} phút/buổi, cường độ ${getOptionLabel("trainingIntensity", form.trainingIntensity)}, mục tiêu ${GOALS.find((goal) => goal.value === form.goal)?.label}`;
};

export const buildTdeeSubmitRequest = (form) => ({
  text: buildSubmitText(form),
  structuredAction: {
    type: "calculate_tdee",
    payload: {
      gender: form.gender,
      age: Number(form.age),
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      dailyMovement: form.dailyMovement,
      steps: form.steps,
      trainingFrequency: form.trainingFrequency,
      trainingDuration: form.trainingDuration,
      trainingIntensity: form.trainingIntensity,
      goal: form.goal,
    },
  },
});
import {
  isTdeeInputWithinLimits,
  normalizeTrainingEvidence,
  TDEE_INPUT_LIMITS,
} from "../../../pages/TdeeCalculator/tdee.helpers";
