const PRESERVE_SCOPE_PATTERN =
  /\b(?:giu nguyen|khong thay doi|khong doi)\b[\s\S]{0,120}\b(?:toan bo|tat ca|moi thu|ke hoach|lich tap)\b|\b(?:toan bo|tat ca|moi thu|ke hoach|lich tap)\b[\s\S]{0,120}\b(?:giu nguyen|khong thay doi|khong doi)\b/;
const NEGATED_PRESERVATION_PATTERN =
  /\b(?:khong can(?: phai)?|khong muon|khong phai(?: la)?|khong nhat thiet(?: phai)?|khong bat buoc(?: phai)?|dung|bo qua(?: yeu cau)?)\s+giu nguyen\b/;
const DEFICIT_PATTERN = /\b(?:muc\s+)?tham hut\b/;
const NUMERIC_CHANGE_PATTERN =
  /\b(?:nhung|ma|chi)\s+(?:chi\s+)?(?:doi|thay doi|giam|tang)\s+(?:rieng\s+)?([a-z][a-z0-9\s/-]{0,50}?)\s+tu\s+(\d+(?:[.,]\d+)?(?:\s*(?:kcal|kg|g|buoi(?:\s*(?:\/\s*)?tuan)?|bua(?:\s*(?:\/\s*)?ngay)?|phut|gio|ngay|tuan))?)\s+(?:thanh|sang|len|xuong|con)\s+(\d+(?:[.,]\d+)?(?:\s*(?:kcal|kg|g|buoi(?:\s*(?:\/\s*)?tuan)?|bua(?:\s*(?:\/\s*)?ngay)?|phut|gio|ngay|tuan))?)\b/;
const EXERCISE_REPLACEMENT_PATTERN =
  /\b(?:nhung|ma|chi)\s+(?:chi\s+)?(?:thay|doi)\s+(?:rieng\s+)?bai(?: tap)?\s+([a-z0-9][a-z0-9\s/-]{0,60}?)\s+(?:thanh|sang|bang)\s+([a-z0-9][a-z0-9\s/-]{0,60}?)(?=[.!?,;]|$)/;
const PLAN_MUTATION_PATTERN =
  /\b(?:giam|tang|doi|thay(?: doi)?|cat|them|bo)\b[^.!?\n]{0,60}\b(?:tham hut|calo|calories?|kcal|lich tap|ke hoach tap|khoi luong tap|volume|so buoi|tan suat tap|bai(?: tap)?|sets?|reps?|hiep|cardio|thoi gian nghi|thuc don|mon an|so bua|bua an|protein|chat dam|carbs?|carbohydrate|tinh bot|fat|chat beo|macro)\b|\b(?:tham hut|calo|calories?|kcal|lich tap|ke hoach tap|khoi luong tap|volume|so buoi|tan suat tap|bai(?: tap)?|sets?|reps?|hiep|cardio|thoi gian nghi|thuc don|mon an|so bua|bua an|protein|chat dam|carbs?|carbohydrate|tinh bot|fat|chat beo|macro)\b[^.!?\n]{0,60}\b(?:giam|tang|doi|thay(?: doi)?|cat|them|bo)\b/;
const PERMISSION_PATTERN =
  /\b(?:neu ban muon|neu ban dong y|ban co muon|xin phep|truoc khi|de xuat rieng|danh gia rieng)\b/;
const UNCHANGED_PATTERN =
  /\b(?:giu nguyen|khong doi|khong thay doi)\b/g;
const NEGATED_MUTATION_PATTERN =
  /\b(?:khong|dung|chua|khong can(?: phai)?)\s+(?:tu\s+)?(?:giam|tang|doi|thay doi|thay|cat|them|bo)\b/g;

const CHANGE_SUBJECTS = Object.freeze([
  { id: "workout_exercise", label: "bài tập", pattern: /\bbai(?: tap)?\b/ },
  { id: "training_sessions", label: "số buổi tập", pattern: /\b(?:so buoi(?: tap)?|tan suat tap)\b/ },
  { id: "meal_sessions", label: "số bữa", pattern: /\b(?:so bua|bua an)\b/ },
  { id: "protein", label: "protein", pattern: /\b(?:protein|chat dam)\b/ },
  { id: "carb", label: "carb", pattern: /\b(?:carbs?|carbohydrate|tinh bot)\b/ },
  { id: "fat", label: "chất béo", pattern: /\b(?:fat|chat beo)\b/ },
  { id: "calories", label: "mức calo", pattern: /\b(?:calo|calories?|kcal|nang luong)\b/ },
]);

const MUTATION_TOPICS = Object.freeze([
  ["deficit", /\b(?:muc\s+)?tham hut\b/],
  ["calories", /\b(?:calo|calories?|kcal|nang luong)\b/],
  ["training_sessions", /\b(?:so buoi(?: tap)?|tan suat tap)\b/],
  ["workout_plan", /\b(?:lich tap|ke hoach tap)\b/],
  ["workout_exercise", /\bbai(?: tap)?\b/],
  ["workout_detail", /\b(?:khoi luong tap|volume|sets?|reps?|hiep|cardio|thoi gian nghi)\b/],
  ["meal_sessions", /\b(?:so bua|bua an)\b/],
  ["meal_plan", /\b(?:thuc don|mon an)\b/],
  ["protein", /\b(?:protein|chat dam)\b/],
  ["carb", /\b(?:carbs?|carbohydrate|tinh bot)\b/],
  ["fat", /\b(?:fat|chat beo)\b/],
]);

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s.,;:!?\n-]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

const parseDeficitValues = (normalized) => {
  const fromTo = normalized.match(
    /\btu\s+(\d{2,4})\s*(?:kcal)?\s+(?:thanh|sang|len)\s+(\d{2,4})\s*(?:kcal)?\b/,
  );
  if (fromTo) {
    return { previousDeficit: Number(fromTo[1]), nextDeficit: Number(fromTo[2]) };
  }

  const nextOnly = normalized.match(
    /\b(?:muc\s+)?tham hut\b[\s\S]{0,60}\b(?:thanh|sang|len|la)\s+(\d{2,4})\s*kcal\b/,
  );
  return nextOnly
    ? { previousDeficit: null, nextDeficit: Number(nextOnly[1]) }
    : { previousDeficit: null, nextDeficit: null };
};

const parseGenericChange = (normalized) => {
  const numericMatch = normalized.match(NUMERIC_CHANGE_PATTERN);
  if (numericMatch) {
    const subject = numericMatch[1].trim();
    const definition = CHANGE_SUBJECTS.find(({ pattern }) => pattern.test(subject));
    return Object.freeze({
      id: definition?.id || "custom",
      label: definition?.label || subject,
      subject,
      previousValue: numericMatch[2].replace(/\s+/g, " ").trim(),
      nextValue: numericMatch[3].replace(/\s+/g, " ").trim(),
    });
  }

  const replacementMatch = normalized.match(EXERCISE_REPLACEMENT_PATTERN);
  if (!replacementMatch) return null;
  return Object.freeze({
    id: "workout_exercise",
    label: "bài tập",
    subject: "bai tap",
    previousValue: replacementMatch[1].replace(/\s+/g, " ").trim(),
    nextValue: replacementMatch[2].replace(/\s+/g, " ").trim(),
  });
};

const descriptorFor = (request) => {
  if (request?.change) return request.change;
  if (Number.isFinite(request?.nextDeficit)) {
    return {
      id: "deficit",
      label: "mức thâm hụt",
      subject: "muc tham hut",
      previousValue: Number.isFinite(request.previousDeficit)
        ? `${request.previousDeficit} kcal`
        : null,
      nextValue: `${request.nextDeficit} kcal`,
    };
  }
  return null;
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const subjectPatternFor = (descriptor) => {
  if (descriptor?.id === "deficit") return /\b(?:muc\s+)?tham hut\b/;
  const definition = CHANGE_SUBJECTS.find(({ id }) => id === descriptor?.id);
  return definition?.pattern || new RegExp(`\\b${escapeRegex(descriptor?.subject || descriptor?.label || "")}\\b`);
};

const nextValuePatternFor = (descriptor) =>
  new RegExp(`\\b${escapeRegex(descriptor?.nextValue || "").replace(/\\\s\+/g, "\\s+")}\\b`);

const mutationTopicsIn = (clause) =>
  MUTATION_TOPICS.filter(([, pattern]) => pattern.test(clause)).map(([topic]) => topic);

const topicIsAllowed = (topic, descriptor, clause, nextValuePattern) => {
  if (topic === descriptor.id) return true;
  if (
    descriptor.id === "deficit" &&
    topic === "calories" &&
    DEFICIT_PATTERN.test(clause)
  ) return true;
  if (
    descriptor.id === "training_sessions" &&
    topic === "workout_plan" &&
    /\b(?:so buoi(?: tap)?|tan suat tap)\b/.test(clause) &&
    nextValuePattern.test(clause)
  ) return true;
  if (
    descriptor.id === "meal_sessions" &&
    topic === "meal_plan" &&
    /\b(?:so bua|bua an)\b/.test(clause) &&
    nextValuePattern.test(clause)
  ) return true;
  return false;
};

export const parseScopePreservationRequest = (message) => {
  const normalized = normalize(message);
  const { previousDeficit, nextDeficit } = parseDeficitValues(normalized);
  const preservationApplies = !NEGATED_PRESERVATION_PATTERN.test(normalized) &&
    PRESERVE_SCOPE_PATTERN.test(normalized);
  const deficitApplies = preservationApplies &&
    DEFICIT_PATTERN.test(normalized) && Number.isFinite(nextDeficit);

  if (deficitApplies) {
    return Object.freeze({
      applies: true,
      previousDeficit,
      nextDeficit,
    });
  }

  const change = preservationApplies ? parseGenericChange(normalized) : null;

  return Object.freeze({
    applies: Boolean(change),
    previousDeficit: null,
    nextDeficit: null,
    ...(change ? { change } : {}),
  });
};

export const validateScopePreservationOutput = (request, answer) => {
  if (!request?.applies) {
    return Object.freeze({ applies: false, valid: true, reasonCodes: [] });
  }

  const normalized = normalize(answer);
  const descriptor = descriptorFor(request);
  const violations = new Set();
  const nextValuePattern = nextValuePatternFor(descriptor);
  const subjectPattern = subjectPatternFor(descriptor);
  if (!nextValuePattern.test(normalized)) {
    violations.add("requested_value_missing");
  }
  if (!(
    new RegExp(`\\b(?:chi|duy nhat)\\b[^.!?\\n]{0,80}${subjectPattern.source}[^.!?\\n]{0,50}\\b(?:thay doi|doi)\\b`).test(normalized) ||
    new RegExp(`\\b(?:chi|duy nhat)\\b[^.!?\\n]{0,30}\\b(?:thay doi|doi)\\b[^.!?\\n]{0,50}${subjectPattern.source}`).test(normalized)
  )) {
    violations.add("allowed_change_not_explicit");
  }
  if (!(
    /\b(?:moi|toan bo|cac|nhung)\s+(?:phan\s+)?(?:khac|con lai)\b[^.!?\n]{0,80}\b(?:giu nguyen|khong doi|khong thay doi)\b/.test(normalized) ||
    /\b(?:giu nguyen|khong doi|khong thay doi)\b[^.!?\n]{0,80}\b(?:moi|toan bo|cac|nhung)\s+(?:phan\s+)?(?:khac|con lai)\b/.test(normalized) ||
    (descriptor.id === "deficit" && (
      /\b(?:lich tap|ke hoach tap)\b[^.!?\n]{0,80}\b(?:giu nguyen|khong doi|khong thay doi)\b/.test(normalized) ||
      /\b(?:giu nguyen|khong doi|khong thay doi)\b[^.!?\n]{0,80}\b(?:lich tap|ke hoach tap)\b/.test(normalized)
    ))
  )) {
    violations.add("locked_plan_not_explicit");
  }
  const mutationClauses = normalized.split(
    /[.!?\n;,]+|\b(?:nhung|tuy nhien|dong thoi|ngoai ra)\b/,
  );
  for (const clause of mutationClauses) {
    const mutationCandidate = clause
      .replace(UNCHANGED_PATTERN, "giu nguyen")
      .replace(NEGATED_MUTATION_PATTERN, "giu nguyen");
    if (
      PLAN_MUTATION_PATTERN.test(mutationCandidate) &&
      !PERMISSION_PATTERN.test(clause)
    ) {
      const topics = mutationTopicsIn(mutationCandidate);
      const allowedSubjectChange = subjectPattern.test(mutationCandidate) &&
        topics.every((topic) => topicIsAllowed(
          topic,
          descriptor,
          mutationCandidate,
          nextValuePattern,
        ));
      if (!allowedSubjectChange) violations.add("unauthorized_plan_change");
    }
  }
  if (/(?:^|\n)\s*(?:ngay|buoi)\s*\d+\s*:/m.test(normalized)) {
    violations.add("detailed_plan_rewrite");
  }

  return Object.freeze({
    applies: true,
    valid: violations.size === 0,
    reasonCodes: Object.freeze([...violations]),
  });
};

export const buildScopeCorrectionInstruction = (request) => {
  const descriptor = descriptorFor(request);
  const transition = descriptor?.previousValue
    ? ` từ ${descriptor.previousValue} thành ${descriptor.nextValue}`
    : ` thành ${descriptor?.nextValue}`;
  return [
    `Câu trả lời vừa rồi vượt phạm vi user cho phép. Chỉ thay đổi ${descriptor?.label}${transition}; không viết lại lịch tập, thực đơn hoặc thay đổi bất kỳ ràng buộc nào khác.`,
    `Hãy nêu đúng phần thay đổi và xác nhận mọi phần khác giữ nguyên.`,
    "Nếu cần cảnh báo về phục hồi, tách thành lưu ý và xin phép trước khi đề xuất bất kỳ thay đổi nào khác. Chỉ trả lời cuối cùng.",
  ].join(" ");
};

export const buildScopePreservationFallback = (request) => {
  const descriptor = descriptorFor(request);
  const transition = descriptor?.previousValue
    ? `từ ${descriptor.previousValue} thành ${descriptor.nextValue}`
    : `thành ${descriptor?.nextValue}`;
  const delta = Number.isFinite(request?.previousDeficit)
    ? Math.abs(request.nextDeficit - request.previousDeficit)
    : null;
  const deltaText = delta
    ? ` So với trước, độ lớn mức thâm hụt thay đổi ${delta} kcal/ngày.`
    : "";
  const preservationText = descriptor?.id === "deficit"
    ? "lịch tập và mọi phần khác trong kế hoạch giữ nguyên"
    : "mọi phần khác trong kế hoạch giữ nguyên";
  return [
    `Đã đổi ${descriptor?.label} ${transition}. Chỉ ${descriptor?.label} thay đổi; ${preservationText}.${deltaText}`,
    descriptor?.id === "deficit"
      ? "Lưu ý: mức thâm hụt sâu hơn có thể ảnh hưởng phục hồi. Mình chưa tự thay đổi lịch tập; nếu bạn muốn, mình sẽ đánh giá riêng trước khi đề xuất điều chỉnh."
      : "Mình chưa tự thay đổi bất kỳ phần nào khác; nếu bạn muốn, mình sẽ đánh giá riêng trước khi đề xuất thêm.",
  ].join("\n\n");
};
