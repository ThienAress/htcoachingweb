import mongodb from "mongodb";

const { ObjectId } = mongodb;

export const SHOWCASE_TRAINER_SLUG = "hoang-thien";
export const PRODUCTION_SHOWCASE_DATABASE = "gym-app";
export const STAGING_SHOWCASE_DATABASE = "htcoaching_staging";
export const LOCAL_SHOWCASE_DATABASE = "htcoaching_local";
export const LOCAL_SHOWCASE_MONGO_URI =
  "mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

const TRAINER_FIELDS = Object.freeze([
  "_id",
  "slug",
  "name",
  "title",
  "experience",
  "bio",
  "motto",
  "trainingStyle",
  "achievements",
  "philosophy",
  "headline",
  "videoIntro",
  "stats",
  "certifications",
  "methodologies",
  "faqs",
  "socialLinks",
  "images",
  "image",
  "specialties",
  "status",
  "featured",
  "isHeadCoach",
  "sortOrder",
  "publishedAt",
  "i18n",
  "createdAt",
  "updatedAt",
]);

const CUSTOMER_STORY_FIELDS = Object.freeze([
  "_id",
  "slug",
  "trainerId",
  "name",
  "age",
  "job",
  "result",
  "duration",
  "packageName",
  "goal",
  "startWeight",
  "endWeight",
  "schedule",
  "message",
  "problem",
  "solution",
  "quote",
  "beforeImg",
  "afterImg",
  "heroImage",
  "heroPosition",
  "highlights",
  "milestones",
  "i18n",
  "status",
  "featured",
  "isContinuing",
  "sortOrder",
  "publishedAt",
  "createdAt",
  "updatedAt",
]);

export const TRAINER_SHOWCASE_PROJECTION = Object.freeze(
  Object.fromEntries(TRAINER_FIELDS.map((field) => [field, 1])),
);
export const CUSTOMER_STORY_SHOWCASE_PROJECTION = Object.freeze(
  Object.fromEntries(CUSTOMER_STORY_FIELDS.map((field) => [field, 1])),
);

const pickFields = (source, fields) =>
  Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(source || {}, field))
      .map((field) => [field, source[field]]),
  );

const makeMalformedNestedError = (field) =>
  Object.assign(new Error("SHOWCASE_SYNC_MALFORMED_NESTED_FIELD"), {
    code: "SHOWCASE_SYNC_MALFORMED_NESTED_FIELD",
    field,
  });

const makeMalformedFieldError = (field) =>
  Object.assign(new Error("SHOWCASE_SYNC_MALFORMED_FIELD"), {
    code: "SHOWCASE_SYNC_MALFORMED_FIELD",
    field,
  });

const isPlainRecord = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const requireRecord = (value, field) => {
  if (!isPlainRecord(value)) throw makeMalformedNestedError(field);
  return value;
};

const requireArray = (value, field) => {
  if (!Array.isArray(value)) throw makeMalformedNestedError(field);
  return value;
};

const sanitizeStringArray = (value, field) =>
  requireArray(value, field).map((item) => {
    if (typeof item !== "string") throw makeMalformedFieldError(`${field}[]`);
    return item;
  });

const isDate = (value) =>
  value instanceof Date && Number.isFinite(value.getTime());
const isObjectId = (value) => value instanceof ObjectId;
const LEAF_TYPES = Object.freeze({
  string: (value) => typeof value === "string",
  boolean: (value) => typeof value === "boolean",
  number: (value) => typeof value === "number" && Number.isFinite(value),
  objectId: isObjectId,
  nullableObjectId: (value) => value === null || isObjectId(value),
  date: isDate,
  nullableDate: (value) => value === null || isDate(value),
});

const validateLeafFields = (record, schema, prefix = "") => {
  for (const [field, type] of Object.entries(schema)) {
    if (
      Object.hasOwn(record, field) &&
      !LEAF_TYPES[type](record[field])
    ) {
      throw makeMalformedFieldError(`${prefix}${field}`);
    }
  }
  return record;
};

const sanitizeRows = (value, fields, field, transform) =>
  requireArray(value, field).map((row) => {
    const sanitized = pickFields(requireRecord(row, `${field}[]`), fields);
    return transform ? transform(sanitized) : sanitized;
  });

const sanitizeTrainerI18n = (value) => {
  requireRecord(value, "i18n");
  const result = {};
  if (Object.hasOwn(value, "en")) {
    result.en = pickFields(requireRecord(value.en, "i18n.en"), [
      "title",
      "bio",
      "motto",
      "trainingStyle",
      "philosophy",
      "headline",
      "achievements",
    ]);
    validateLeafFields(
      result.en,
      {
        title: "string",
        bio: "string",
        motto: "string",
        trainingStyle: "string",
        philosophy: "string",
        headline: "string",
      },
      "i18n.en.",
    );
    if (Object.hasOwn(result.en, "achievements")) {
      result.en.achievements = sanitizeStringArray(
        result.en.achievements,
        "i18n.en.achievements",
      );
    }
  }
  return result;
};

const sanitizeStoryI18n = (value) => {
  requireRecord(value, "i18n");
  const result = {};
  if (Object.hasOwn(value, "en")) {
    result.en = pickFields(requireRecord(value.en, "i18n.en"), [
      "message",
      "result",
      "duration",
      "goal",
      "job",
      "problem",
      "solution",
      "quote",
      "highlights",
    ]);
    validateLeafFields(
      result.en,
      {
        message: "string",
        result: "string",
        duration: "string",
        goal: "string",
        job: "string",
        problem: "string",
        solution: "string",
        quote: "string",
      },
      "i18n.en.",
    );
    if (Object.hasOwn(result.en, "highlights")) {
      result.en.highlights = sanitizeStringArray(
        result.en.highlights,
        "i18n.en.highlights",
      );
    }
  }
  return result;
};

export const sanitizeTrainer = (source = {}) => {
  const trainer = pickFields(source, TRAINER_FIELDS);
  validateLeafFields(trainer, {
    _id: "objectId",
    slug: "string",
    name: "string",
    title: "string",
    experience: "string",
    bio: "string",
    motto: "string",
    trainingStyle: "string",
    philosophy: "string",
    headline: "string",
    videoIntro: "string",
    image: "string",
    status: "string",
    featured: "boolean",
    isHeadCoach: "boolean",
    sortOrder: "number",
    publishedAt: "nullableDate",
    createdAt: "date",
    updatedAt: "date",
  });
  for (const field of ["achievements", "certifications", "images"]) {
    if (Object.hasOwn(trainer, field)) {
      trainer[field] = sanitizeStringArray(trainer[field], field);
    }
  }
  if (Object.hasOwn(trainer, "stats")) {
    trainer.stats = sanitizeRows(
      trainer.stats,
      ["_id", "label", "value"],
      "stats",
      (row) =>
        validateLeafFields(
          row,
          { _id: "objectId", label: "string", value: "string" },
          "stats[].",
        ),
    );
  }
  if (Object.hasOwn(trainer, "methodologies")) {
    trainer.methodologies = sanitizeRows(
      trainer.methodologies,
      ["_id", "title", "description"],
      "methodologies",
      (row) =>
        validateLeafFields(
          row,
          { _id: "objectId", title: "string", description: "string" },
          "methodologies[].",
        ),
    );
  }
  if (Object.hasOwn(trainer, "faqs")) {
    trainer.faqs = sanitizeRows(
      trainer.faqs,
      ["_id", "question", "answer"],
      "faqs",
      (row) =>
        validateLeafFields(
          row,
          { _id: "objectId", question: "string", answer: "string" },
          "faqs[].",
        ),
    );
  }
  if (Object.hasOwn(trainer, "specialties")) {
    trainer.specialties = sanitizeRows(
      trainer.specialties,
      ["icon", "label"],
      "specialties",
      (row) =>
        validateLeafFields(
          row,
          { icon: "string", label: "string" },
          "specialties[].",
        ),
    );
  }
  if (Object.hasOwn(trainer, "socialLinks")) {
    trainer.socialLinks = pickFields(
      requireRecord(trainer.socialLinks, "socialLinks"),
      ["facebook", "instagram", "tiktok", "zalo", "lemon8", "threads"],
    );
    validateLeafFields(
      trainer.socialLinks,
      {
        facebook: "string",
        instagram: "string",
        tiktok: "string",
        zalo: "string",
        lemon8: "string",
        threads: "string",
      },
      "socialLinks.",
    );
  }
  if (Object.hasOwn(trainer, "i18n")) {
    trainer.i18n = sanitizeTrainerI18n(trainer.i18n);
  }
  return trainer;
};

export const sanitizeCustomerStory = (source = {}) => {
  const story = {
    ...pickFields(source, CUSTOMER_STORY_FIELDS),
    orderId: null,
  };
  validateLeafFields(story, {
    _id: "objectId",
    slug: "string",
    orderId: "nullableObjectId",
    trainerId: "nullableObjectId",
    name: "string",
    age: "string",
    job: "string",
    result: "string",
    duration: "string",
    packageName: "string",
    goal: "string",
    startWeight: "string",
    endWeight: "string",
    schedule: "string",
    message: "string",
    problem: "string",
    solution: "string",
    quote: "string",
    heroImage: "string",
    heroPosition: "number",
    status: "string",
    featured: "boolean",
    isContinuing: "boolean",
    sortOrder: "number",
    publishedAt: "nullableDate",
    createdAt: "date",
    updatedAt: "date",
  });
  for (const field of ["beforeImg", "afterImg", "highlights"]) {
    if (Object.hasOwn(story, field)) {
      story[field] = sanitizeStringArray(story[field], field);
    }
  }
  if (Object.hasOwn(story, "milestones")) {
    story.milestones = sanitizeRows(story.milestones, [
      "title",
      "subtitle",
      "content",
      "beforeImg",
      "afterImg",
      "bullets",
      "sortOrder",
    ], "milestones", (milestone) => {
      validateLeafFields(
        milestone,
        {
          title: "string",
          subtitle: "string",
          content: "string",
          sortOrder: "number",
        },
        "milestones[].",
      );
      for (const field of ["beforeImg", "afterImg", "bullets"]) {
        if (Object.hasOwn(milestone, field)) {
          milestone[field] = sanitizeStringArray(
            milestone[field],
            `milestones[].${field}`,
          );
        }
      }
      return milestone;
    });
  }
  if (Object.hasOwn(story, "i18n")) {
    story.i18n = sanitizeStoryI18n(story.i18n);
  }
  return story;
};

const parseMongoTarget = (value) => {
  try {
    const url = new URL(String(value || ""));
    return {
      hostname: url.hostname.toLowerCase(),
      database: decodeURIComponent(url.pathname)
        .replace(/^\/+/, "")
        .split("/")[0],
    };
  } catch {
    return { hostname: "", database: "" };
  }
};

const pushUnique = (items, value) => {
  if (!items.includes(value)) items.push(value);
};

export const validateShowcaseSyncContext = ({
  sourceUri,
  targetUri,
  target,
  apply = false,
  env = process.env,
} = {}) => {
  const errors = [];
  const source = parseMongoTarget(sourceUri);
  const destination = parseMongoTarget(targetUri);

  if (String(env.ACCOUNT_SYNC_SOURCE_ENV || "").toLowerCase() !== "production") {
    pushUnique(errors, "SHOWCASE_SYNC_PRODUCTION_SOURCE_REQUIRED");
  }
  if (
    String(env.ACCOUNT_SYNC_SOURCE_READ_ONLY || "").toLowerCase() !== "yes"
  ) {
    pushUnique(errors, "SHOWCASE_SYNC_READ_ONLY_SOURCE_REQUIRED");
  }
  if (source.database !== PRODUCTION_SHOWCASE_DATABASE) {
    pushUnique(errors, "SHOWCASE_SYNC_PRODUCTION_DATABASE_REQUIRED");
  }

  if (target === "local") {
    if (!LOOPBACK_HOSTS.has(destination.hostname)) {
      pushUnique(errors, "SHOWCASE_SYNC_LOCAL_HOST_REQUIRED");
    }
    if (destination.database !== LOCAL_SHOWCASE_DATABASE) {
      pushUnique(errors, "SHOWCASE_SYNC_LOCAL_DATABASE_REQUIRED");
    }
    if (
      apply &&
      String(env.CONFIRM_LOCAL_SHOWCASE_SYNC || "").toLowerCase() !== "yes"
    ) {
      pushUnique(errors, "SHOWCASE_SYNC_LOCAL_CONFIRMATION_REQUIRED");
    }
  } else if (target === "staging") {
    if (String(env.ACCOUNT_SYNC_TARGET_ENV || "").toLowerCase() !== "staging") {
      pushUnique(errors, "SHOWCASE_SYNC_STAGING_ENV_REQUIRED");
    }
    if (destination.database !== STAGING_SHOWCASE_DATABASE) {
      pushUnique(errors, "SHOWCASE_SYNC_STAGING_DATABASE_REQUIRED");
    }
    if (
      apply &&
      String(env.CONFIRM_STAGING_SHOWCASE_SYNC || "").toLowerCase() !== "yes"
    ) {
      pushUnique(errors, "SHOWCASE_SYNC_STAGING_CONFIRMATION_REQUIRED");
    }
  } else {
    pushUnique(errors, "SHOWCASE_SYNC_TARGET_INVALID");
  }

  if (
    source.hostname &&
    source.hostname === destination.hostname &&
    source.database &&
    source.database === destination.database
  ) {
    pushUnique(errors, "SHOWCASE_SYNC_SOURCE_TARGET_MUST_DIFFER");
  }

  return { valid: errors.length === 0, errors };
};

export const assertShowcaseSyncContext = (options) => {
  const result = validateShowcaseSyncContext(options);
  if (!result.valid) {
    const error = new Error(
      `Showcase sync rejected: ${result.errors.join(", ")}`,
    );
    error.code = "SHOWCASE_SYNC_CONTEXT_REJECTED";
    error.findings = result.errors;
    throw error;
  }
  return result;
};
