import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  QUESTION_ANSWERING_EMBEDDING_VERSION,
} from "./stagingKnowledgeBaseReembed.state.js";
import {
  QUESTION_ANSWERING_EMBEDDING_PROFILE_ID,
} from "../services/ai/embeddingProfile.js";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const SNAPSHOT_FILE_PATTERN =
  /^kb-reembed-staging-\d{8}T\d{6}Z-[a-f0-9]{8}\.enc\.json$/;

const fail = (code, message = code) =>
  Object.assign(new Error(`${code}: ${message}`), { code });

const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

const assertSecret = (secret) => {
  if (String(secret || "").length < 32) {
    throw fail("KB_REEMBED_SNAPSHOT_KEY_REQUIRED");
  }
  return String(secret);
};

const assertOutsideRepository = (resolved) => {
  const relative = path.relative(REPOSITORY_ROOT, resolved);
  if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw fail("KB_REEMBED_SNAPSHOT_PATH_OUTSIDE_REPOSITORY_REQUIRED");
  }
  return resolved;
};

const assertExternalPath = (value, { directory = false } = {}) => {
  const rawPath = String(value || "").trim();
  if (!path.isAbsolute(rawPath)) {
    throw fail("KB_REEMBED_SNAPSHOT_PATH_ABSOLUTE_REQUIRED");
  }
  const resolved = path.resolve(rawPath);
  assertOutsideRepository(resolved);
  if (!directory && !SNAPSHOT_FILE_PATTERN.test(path.basename(resolved))) {
    throw fail("KB_REEMBED_SNAPSHOT_FILE_INVALID");
  }
  return resolved;
};

export const createKnowledgeSnapshotId = ({ now, planDigest }) => {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `kb-reembed-staging-${stamp}-${planDigest.slice(0, 8)}`;
};

const encryptPayload = ({ plaintext, secret }) => {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(assertSecret(secret), salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    schemaVersion: 1,
    algorithm: "aes-256-gcm+scrypt",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    plaintextSha256: sha256(plaintext),
  };
};

const decryptEnvelope = ({ envelope, secret }) => {
  if (
    envelope?.schemaVersion !== 1 ||
    envelope?.algorithm !== "aes-256-gcm+scrypt"
  ) {
    throw fail("KB_REEMBED_SNAPSHOT_ENVELOPE_INVALID");
  }
  try {
    const salt = Buffer.from(envelope.salt, "base64");
    const iv = Buffer.from(envelope.iv, "base64");
    const tag = Buffer.from(envelope.tag, "base64");
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");
    const key = scryptSync(assertSecret(secret), salt, 32);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    if (sha256(plaintext) !== envelope.plaintextSha256) {
      throw fail("KB_REEMBED_SNAPSHOT_DIGEST_MISMATCH");
    }
    return plaintext;
  } catch (error) {
    if (error?.code?.startsWith("KB_REEMBED_")) throw error;
    throw fail("KB_REEMBED_SNAPSHOT_DECRYPT_FAILED");
  }
};

const validateSnapshotPayload = (payload) => {
  const isHash = (value) => /^[a-f0-9]{64}$/.test(value || "");
  const isId = (value) => /^[a-f0-9]{24}$/i.test(value || "");
  if (
    payload?.schemaVersion !== 1 ||
    !/^kb-reembed-staging-\d{8}T\d{6}Z-[a-f0-9]{8}$/.test(
      payload?.snapshotId || "",
    ) ||
    payload?.targetDatabase !== "htcoaching_staging" ||
    payload?.targetProfile !== QUESTION_ANSWERING_EMBEDDING_PROFILE_ID ||
    payload?.targetVersion !== QUESTION_ANSWERING_EMBEDDING_VERSION ||
    !isHash(payload?.planDigest) ||
    !payload.snapshotId.endsWith(payload.planDigest.slice(0, 8)) ||
    !Array.isArray(payload?.inventory) ||
    !Array.isArray(payload?.entries)
  ) {
    throw fail("KB_REEMBED_SNAPSHOT_PAYLOAD_INVALID");
  }
  const inventoryById = new Map();
  for (const item of payload.inventory) {
    if (
      !isId(item?.id) ||
      inventoryById.has(item.id) ||
      !isHash(item.contentHash) ||
      !isHash(item.priorStateHash) ||
      !isHash(item.expectedTargetStateHash)
    ) {
      throw fail("KB_REEMBED_SNAPSHOT_INVENTORY_INVALID");
    }
    inventoryById.set(item.id, item);
  }
  const changed = new Set();
  for (const item of payload.entries) {
    const record = inventoryById.get(item?.id);
    if (
      !record ||
      changed.has(item.id) ||
      item.contentHash !== record.contentHash ||
      item.priorStateHash !== record.priorStateHash ||
      item.targetStateHash !== record.expectedTargetStateHash ||
      item.targetStateHash === item.priorStateHash ||
      !item.priorState ||
      sha256(JSON.stringify(item.priorState)) !== item.priorStateHash
    ) {
      throw fail("KB_REEMBED_SNAPSHOT_ENTRY_INVALID");
    }
    changed.add(item.id);
  }
  if (
    [...inventoryById.values()].some(
      (item) =>
        (item.expectedTargetStateHash !== item.priorStateHash) !==
        changed.has(item.id),
    )
  ) {
    throw fail("KB_REEMBED_SNAPSHOT_INCOMPLETE");
  }
  return payload;
};

export const createEncryptedKnowledgeSnapshot = async ({
  directory,
  secret,
  payload,
}) => {
  const targetDirectory = assertExternalPath(directory, { directory: true });
  const validated = validateSnapshotPayload(payload);
  const plaintext = JSON.stringify(validated);
  const envelope = encryptPayload({ plaintext, secret });
  await mkdir(targetDirectory, { recursive: true });
  assertOutsideRepository(await realpath(targetDirectory));
  const filePath = path.join(
    targetDirectory,
    `${validated.snapshotId}.enc.json`,
  );
  await writeFile(filePath, `${JSON.stringify(envelope)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  const restored = await readEncryptedKnowledgeSnapshot({ filePath, secret });
  if (sha256(JSON.stringify(restored)) !== sha256(plaintext)) {
    throw fail("KB_REEMBED_SNAPSHOT_READBACK_MISMATCH");
  }
  return {
    snapshotId: validated.snapshotId,
    filePath,
    snapshotDigest: envelope.plaintextSha256,
  };
};

export const readEncryptedKnowledgeSnapshot = async ({ filePath, secret }) => {
  const resolved = assertExternalPath(filePath);
  assertOutsideRepository(await realpath(resolved));
  let envelope;
  try {
    envelope = JSON.parse(await readFile(resolved, "utf8"));
  } catch {
    throw fail("KB_REEMBED_SNAPSHOT_READ_FAILED");
  }
  const plaintext = decryptEnvelope({ envelope, secret });
  try {
    return validateSnapshotPayload(JSON.parse(plaintext));
  } catch (error) {
    if (error?.code?.startsWith("KB_REEMBED_")) throw error;
    throw fail("KB_REEMBED_SNAPSHOT_PAYLOAD_INVALID");
  }
};
