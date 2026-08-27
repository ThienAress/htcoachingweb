const IMPORT_SCHEMA_VERSION = 1;
const MAX_IMPORT_ITEMS = 2000;
const TECHNICAL_DIFFICULTY_FIELDS = [
  "coordination",
  "stability",
  "mobility",
  "setup",
  "errorConsequence",
];

export class ExerciseInstructionsImportError extends Error {
  constructor(message, status = 400, details = undefined) {
    super(message);
    this.name = "ExerciseInstructionsImportError";
    this.status = status;
    this.details = details;
  }
}

const fail = (message, details) => {
  throw new ExerciseInstructionsImportError(message, 400, details);
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertExactFields = (value, allowedFields, requiredFields, path) => {
  if (!isPlainObject(value)) {
    fail(`${path} phải là object`);
  }

  const keys = Object.keys(value);
  const unknownFields = keys.filter((key) => !allowedFields.includes(key));
  const missingFields = requiredFields.filter(
    (key) => !Object.hasOwn(value, key),
  );
  if (unknownFields.length > 0 || missingFields.length > 0) {
    fail(`${path} không đúng cấu trúc`, {
      path,
      unknownFields,
      missingFields,
    });
  }
};

const normalizeRequiredString = (value, path, maxLength) => {
  if (typeof value !== "string") {
    fail(`${path} phải là chuỗi`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    fail(`${path} phải từ 1 đến ${maxLength} ký tự`);
  }
  return normalized;
};

const normalizeInstruction = (instruction, itemIndex, stepIndex) => {
  const path = `exercises[${itemIndex}].instructions[${stepIndex}]`;
  assertExactFields(
    instruction,
    ["title", "description"],
    ["title", "description"],
    path,
  );
  return {
    title: normalizeRequiredString(instruction.title, `${path}.title`, 160),
    description: normalizeRequiredString(
      instruction.description,
      `${path}.description`,
      2000,
    ),
  };
};

const normalizeTechnicalDifficulty = (value, itemIndex) => {
  const path = `exercises[${itemIndex}].technicalDifficulty`;
  assertExactFields(
    value,
    [...TECHNICAL_DIFFICULTY_FIELDS, "rationale"],
    TECHNICAL_DIFFICULTY_FIELDS,
    path,
  );

  const normalized = {};
  for (const field of TECHNICAL_DIFFICULTY_FIELDS) {
    const score = value[field];
    if (!Number.isInteger(score) || score < 0 || score > 2) {
      fail(`${path}.${field} phải là số nguyên từ 0 đến 2`);
    }
    normalized[field] = score;
  }

  if (value.rationale !== undefined) {
    if (typeof value.rationale !== "string") {
      fail(`${path}.rationale phải là chuỗi`);
    }
    const rationale = value.rationale.trim();
    if (rationale.length > 1000) {
      fail(`${path}.rationale tối đa 1000 ký tự`);
    }
    normalized.rationale = rationale;
  }

  return normalized;
};

export const parseExerciseInstructionsImportDocument = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    fail("Vui lòng chọn file JSON cần nhập");
  }

  try {
    const content = buffer.toString("utf8").replace(/^\uFEFF/, "");
    return JSON.parse(content);
  } catch {
    fail("File không phải JSON hợp lệ");
  }
};

export const normalizeExerciseInstructionsImport = (document) => {
  assertExactFields(
    document,
    ["schemaVersion", "exercises"],
    ["schemaVersion", "exercises"],
    "root",
  );
  if (document.schemaVersion !== IMPORT_SCHEMA_VERSION) {
    fail(`schemaVersion phải bằng ${IMPORT_SCHEMA_VERSION}`);
  }
  if (
    !Array.isArray(document.exercises) ||
    document.exercises.length < 1 ||
    document.exercises.length > MAX_IMPORT_ITEMS
  ) {
    fail(`exercises phải có từ 1 đến ${MAX_IMPORT_ITEMS} bài tập`);
  }

  const names = new Set();
  const duplicateNames = new Set();
  const exercises = document.exercises.map((item, itemIndex) => {
    const path = `exercises[${itemIndex}]`;
    assertExactFields(
      item,
      ["name", "instructions", "technicalDifficulty"],
      ["name", "instructions", "technicalDifficulty"],
      path,
    );
    const name = normalizeRequiredString(item.name, `${path}.name`, 160);
    if (names.has(name)) duplicateNames.add(name);
    names.add(name);

    if (
      !Array.isArray(item.instructions) ||
      item.instructions.length < 1 ||
      item.instructions.length > 30
    ) {
      fail(`${path}.instructions phải có từ 1 đến 30 bước`);
    }

    return {
      name,
      instructions: item.instructions.map((instruction, stepIndex) =>
        normalizeInstruction(instruction, itemIndex, stepIndex),
      ),
      technicalDifficulty: normalizeTechnicalDifficulty(
        item.technicalDifficulty,
        itemIndex,
      ),
    };
  });

  if (duplicateNames.size > 0) {
    fail("File có tên bài tập bị trùng", {
      duplicateNames: [...duplicateNames].sort((left, right) =>
        left.localeCompare(right, "vi"),
      ),
    });
  }

  return { schemaVersion: IMPORT_SCHEMA_VERSION, exercises };
};
