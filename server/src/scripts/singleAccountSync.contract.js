import crypto from "node:crypto";
import mongodb from "mongodb";

const { EJSON } = mongodb.BSON;

export const ACCOUNT_SYNC_EMAIL_DIGEST =
  "1d8cd09b86c39434f79b0be978afffa63c0c5b0f29f90898126d2bcd82e79a4f";
export const PRODUCTION_ACCOUNT_DATABASE = "gym-app";
export const STAGING_ACCOUNT_DATABASE = "htcoaching_staging";
export const LOCAL_ACCOUNT_DATABASE = "htcoaching_local";
export const LOCAL_ACCOUNT_MONGO_URI =
  "mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const USER_SYNC_FIELDS = Object.freeze([
  "_id",
  "name",
  "email",
  "phone",
  "role",
  "avatar",
  "address",
  "mealPlanGenerations",
  "mealPlanPreferences",
  "isAiChatBanned",
  "savedRecipes",
]);

export const ACCOUNT_COLLECTION_POLICIES = Object.freeze([
  { name: "bookings", ownerFields: ["userId"], emailFields: ["email", "emailNormalized"] },
  { name: "orders", ownerFields: ["userId"], emailFields: ["email"] },
  { name: "coachingdays", ownerFields: ["userId"] },
  { name: "coachinghabits", ownerFields: ["clientId"] },
  { name: "dailyjournals", ownerFields: ["clientId"] },
  { name: "dailyjournalrevisions", ownerFields: ["clientId"] },
  { name: "weeklycheckins", ownerFields: ["clientId"] },
  { name: "weeklycheckinrevisions", ownerFields: ["clientId"] },
  { name: "wellnesstargets", ownerFields: ["clientId"] },
  { name: "savedmealplans", ownerFields: ["ownerId"] },
  { name: "workoutplans", ownerFields: ["clientId"], emailFields: ["clientEmail"] },
  { name: "trainingschedules", ownerFields: ["clientId"] },
  { name: "trainingslotclaims", ownerFields: ["clientId"] },
  { name: "coachingcomments", ownerFields: ["clientId"] },
  { name: "coachingcommentrevisions", ownerFields: ["clientId"] },
  { name: "notificationpreferences", ownerFields: ["recipientId"] },
  { name: "inappnotifications", ownerFields: ["recipientId"] },
  { name: "fitnesssubscriptions", ownerFields: ["userId"] },
  { name: "fitnessplusquotausages", ownerFields: ["userId"] },
  { name: "serviceusagebuckets", ownerFields: ["userId"] },
  { name: "recipereviews", ownerFields: ["userId"] },
]);

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

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const resolveAccountSyncEmail = (
  value,
  { expectedDigest = ACCOUNT_SYNC_EMAIL_DIGEST } = {},
) => {
  const normalized = normalizeEmail(value);
  const actual = crypto.createHash("sha256").update(normalized).digest();
  const expected = Buffer.from(String(expectedDigest || ""), "hex");
  if (
    !normalized ||
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  ) {
    const error = new Error("Account sync requires the pinned exact identity");
    error.code = "ACCOUNT_SYNC_EXACT_EMAIL_REQUIRED";
    throw error;
  }
  return normalized;
};

export const validateSyncContext = ({
  sourceUri,
  targetUri,
  target,
  env = process.env,
  accountEmailDigest = ACCOUNT_SYNC_EMAIL_DIGEST,
} = {}) => {
  const errors = [];
  const source = parseMongoTarget(sourceUri);
  const destination = parseMongoTarget(targetUri);

  try {
    resolveAccountSyncEmail(env.ACCOUNT_SYNC_EMAIL, {
      expectedDigest: accountEmailDigest,
    });
  } catch {
    pushUnique(errors, "ACCOUNT_SYNC_EXACT_EMAIL_REQUIRED");
  }

  if (String(env.ACCOUNT_SYNC_SOURCE_ENV || "").toLowerCase() !== "production") {
    pushUnique(errors, "ACCOUNT_SYNC_PRODUCTION_SOURCE_REQUIRED");
  }
  if (String(env.ACCOUNT_SYNC_SOURCE_READ_ONLY || "").toLowerCase() !== "yes") {
    pushUnique(errors, "ACCOUNT_SYNC_READ_ONLY_SOURCE_REQUIRED");
  }
  if (source.database !== PRODUCTION_ACCOUNT_DATABASE) {
    pushUnique(errors, "ACCOUNT_SYNC_PRODUCTION_DATABASE_REQUIRED");
  }

  if (target === "local") {
    if (!LOOPBACK_HOSTS.has(destination.hostname)) {
      pushUnique(errors, "ACCOUNT_SYNC_LOCAL_HOST_REQUIRED");
    }
    if (destination.database !== LOCAL_ACCOUNT_DATABASE) {
      pushUnique(errors, "ACCOUNT_SYNC_LOCAL_DATABASE_REQUIRED");
    }
    if (String(env.CONFIRM_LOCAL_ACCOUNT_SYNC || "").toLowerCase() !== "yes") {
      pushUnique(errors, "ACCOUNT_SYNC_LOCAL_CONFIRMATION_REQUIRED");
    }
  } else if (target === "staging") {
    if (String(env.ACCOUNT_SYNC_TARGET_ENV || "").toLowerCase() !== "staging") {
      pushUnique(errors, "ACCOUNT_SYNC_STAGING_ENV_REQUIRED");
    }
    if (destination.database !== STAGING_ACCOUNT_DATABASE) {
      pushUnique(errors, "ACCOUNT_SYNC_STAGING_DATABASE_REQUIRED");
    }
    if (
      String(env.CONFIRM_STAGING_ACCOUNT_SYNC || "").toLowerCase() !== "yes"
    ) {
      pushUnique(errors, "ACCOUNT_SYNC_STAGING_CONFIRMATION_REQUIRED");
    }
  } else {
    pushUnique(errors, "ACCOUNT_SYNC_TARGET_INVALID");
  }

  if (
    source.hostname &&
    source.hostname === destination.hostname &&
    source.database &&
    source.database === destination.database
  ) {
    pushUnique(errors, "ACCOUNT_SYNC_SOURCE_TARGET_MUST_DIFFER");
  }

  return { valid: errors.length === 0, errors };
};

export const assertSyncContext = (options) => {
  const result = validateSyncContext(options);
  if (!result.valid) {
    const error = new Error(`Account sync rejected: ${result.errors.join(", ")}`);
    error.code = "ACCOUNT_SYNC_CONTEXT_REJECTED";
    error.findings = result.errors;
    throw error;
  }
  return result;
};

export const sanitizeAccountUser = (source) =>
  Object.fromEntries(
    USER_SYNC_FIELDS.filter((key) => Object.hasOwn(source || {}, key)).map(
      (key) => [key, source[key]],
    ),
  );

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
};

export const fingerprintDocument = (document) => {
  const serialized = EJSON.serialize(document, { relaxed: false });
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(serialized)))
    .digest("hex");
};

const sameIdentity = (left, right) => String(left || "") === String(right || "");
const sameEmail = (left, accountEmail) =>
  normalizeEmail(left) === accountEmail;

const matchesPolicy = (document, policy, userId, accountEmail) =>
  (policy.ownerFields || []).some((field) => sameIdentity(document?.[field], userId)) ||
  (policy.emailFields || []).some((field) =>
    sameEmail(document?.[field], accountEmail),
  );

export const buildAccountGraph = ({
  accountUser,
  accountEmail,
  accountEmailDigest = ACCOUNT_SYNC_EMAIL_DIGEST,
  collections = {},
} = {}) => {
  const resolvedEmail = resolveAccountSyncEmail(accountEmail, {
    expectedDigest: accountEmailDigest,
  });
  if (!accountUser || !sameEmail(accountUser.email, resolvedEmail)) {
    const error = new Error("Account sync requires the pinned exact user");
    error.code = "ACCOUNT_SYNC_EXACT_USER_REQUIRED";
    throw error;
  }

  const userId = accountUser._id;
  const graph = { users: [sanitizeAccountUser(accountUser)] };
  for (const policy of ACCOUNT_COLLECTION_POLICIES) {
    graph[policy.name] = (collections[policy.name] || []).filter((document) =>
      matchesPolicy(document, policy, userId, resolvedEmail),
    );
  }

  const ownedOrderIds = new Set(
    (graph.orders || []).map((document) => String(document._id)),
  );
  graph.checkins = (collections.checkins || []).filter((document) =>
    ownedOrderIds.has(String(document.orderId)),
  );
  return graph;
};

export const buildOwnerQuery = (policy, userId, accountEmail) => {
  const clauses = [
    ...(policy.ownerFields || []).map((field) => ({ [field]: userId })),
    ...(policy.emailFields || []).map((field) => ({ [field]: accountEmail })),
  ];
  if (clauses.length === 0) {
    const error = new Error(`Account sync policy has no selector: ${policy.name}`);
    error.code = "ACCOUNT_SYNC_SELECTOR_REQUIRED";
    throw error;
  }
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
};
