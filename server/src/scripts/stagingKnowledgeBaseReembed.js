import { pathToFileURL } from "node:url";

import mongoose from "mongoose";
import { resolveMongoConnectionOptions } from "../config/mongoConnectionOptions.js";

import {
  assertKnowledgeReembedConnectedTarget,
  assertStagingKnowledgeBackupReady,
  validateStagingKnowledgeBaseReembedAuthorization,
} from "./stagingKnowledgeBaseReembed.contract.js";
import {
  applyStagingKnowledgeBaseRollback,
  applyStagingKnowledgeBaseTargetStates,
  loadStagingKnowledgeEntries,
} from "./stagingKnowledgeBaseReembed.mongo.js";
import {
  createEncryptedKnowledgeSnapshot,
  createKnowledgeSnapshotId,
  readEncryptedKnowledgeSnapshot,
} from "./stagingKnowledgeBaseReembed.snapshot.js";
import {
  buildKnowledgeSnapshotPayload,
  buildStagingKnowledgeBaseReembedPlan,
  generateKnowledgeTargetStates,
  verifyKnowledgeReembedPostState,
  verifyKnowledgeRollbackPostState,
  verifyKnowledgeRollbackPreState,
} from "./stagingKnowledgeBaseReembed.state.js";
import { generateEmbedding } from "../services/ai/embedding.service.js";

export {
  assertKnowledgeReembedConnectedTarget,
  assertStagingKnowledgeBackupReady,
  validateStagingKnowledgeBaseReembedAuthorization,
} from "./stagingKnowledgeBaseReembed.contract.js";
export {
  applyStagingKnowledgeBaseRollback,
  applyStagingKnowledgeBaseTargetStates,
  loadStagingKnowledgeEntries,
} from "./stagingKnowledgeBaseReembed.mongo.js";
export {
  createEncryptedKnowledgeSnapshot,
  createKnowledgeSnapshotId,
  readEncryptedKnowledgeSnapshot,
} from "./stagingKnowledgeBaseReembed.snapshot.js";
export {
  QUESTION_ANSWERING_EMBEDDING_VERSION,
  buildKnowledgeSnapshotPayload,
  buildStagingKnowledgeBaseReembedPlan,
  createKnowledgeContentHash,
  createKnowledgeVectorStateHash,
  extractKnowledgeVectorState,
  generateKnowledgeTargetStates,
  verifyKnowledgeReembedPostState,
  verifyKnowledgeRollbackPostState,
  verifyKnowledgeRollbackPreState,
} from "./stagingKnowledgeBaseReembed.state.js";

const fail = (code, message = code) =>
  Object.assign(new Error(`${code}: ${message}`), { code });

const defaultDependencies = {
  connect: (uri) => mongoose.connect(
    uri,
    resolveMongoConnectionOptions({ durable: true, autoIndex: false }),
  ),
  disconnect: () => mongoose.disconnect(),
  assertConnectedTarget: (authorization) =>
    assertKnowledgeReembedConnectedTarget(
      mongoose.connection,
      authorization,
    ),
  assertBackupReady: assertStagingKnowledgeBackupReady,
  loadEntries: () =>
    loadStagingKnowledgeEntries({ connection: mongoose.connection }),
  generateTargetStates: (options) =>
    generateKnowledgeTargetStates({
      ...options,
      generateEmbedding,
    }),
  createSnapshot: createEncryptedKnowledgeSnapshot,
  readSnapshot: readEncryptedKnowledgeSnapshot,
  applyTargetStates: ({ plan, targetStates }) =>
    applyStagingKnowledgeBaseTargetStates({
      connection: mongoose.connection,
      plan,
      targetStates,
    }),
  applyRollback: ({ snapshot }) =>
    applyStagingKnowledgeBaseRollback({
      connection: mongoose.connection,
      snapshot,
    }),
};

const safeSnapshotOutput = (snapshot) =>
  snapshot
    ? {
        snapshotId: snapshot.snapshotId,
        snapshotDigest: snapshot.snapshotDigest,
      }
    : null;

const runRollback = async ({ authorization, runtime }) => {
  const snapshot = await runtime.readSnapshot({
    filePath: authorization.snapshotFile,
    secret: authorization.snapshotSecret,
  });
  if (
    authorization.apply &&
    snapshot.planDigest !== authorization.reviewedPlanDigest
  ) {
    throw fail("KB_REEMBED_PLAN_DIGEST_MISMATCH");
  }
  const entries = await runtime.loadEntries();
  const preflight = verifyKnowledgeRollbackPreState({ snapshot, entries });
  if (!authorization.apply) {
    return {
      mode: "preflight",
      operation: "rollback",
      success: true,
      planDigest: snapshot.planDigest,
      summary: {
        documentsToRestore: snapshot.entries.length,
      },
      verification: preflight,
    };
  }
  const result = await runtime.applyRollback({ snapshot });
  const postEntries = await runtime.loadEntries();
  const verification = verifyKnowledgeRollbackPostState({
    snapshot,
    entries: postEntries,
  });
  return {
    mode: "apply",
    operation: "rollback",
    success: true,
    planDigest: snapshot.planDigest,
    summary: { documentsToRestore: snapshot.entries.length },
    result,
    verification,
  };
};

const runReembed = async ({ authorization, runtime, now }) => {
  const entries = await runtime.loadEntries();
  const plan = buildStagingKnowledgeBaseReembedPlan(entries);
  if (!authorization.apply) {
    return {
      mode: "preflight",
      operation: "reembed",
      success: true,
      planDigest: plan.planDigest,
      targetProfile: plan.targetProfile,
      targetVersion: plan.targetVersion,
      providerCallLimit: authorization.maxProviderCalls,
      summary: plan.summary,
    };
  }
  if (plan.planDigest !== authorization.reviewedPlanDigest) {
    throw fail("KB_REEMBED_PLAN_DIGEST_MISMATCH");
  }
  if (plan.summary.providerCalls > authorization.maxProviderCalls) {
    throw fail("KB_REEMBED_PROVIDER_CALL_LIMIT_EXCEEDED");
  }
  if (plan.summary.documentsToUpdate === 0) {
    const verification = verifyKnowledgeReembedPostState({ plan, entries });
    return {
      mode: "apply",
      operation: "reembed",
      success: true,
      planDigest: plan.planDigest,
      summary: plan.summary,
      result: { documentsUpdated: 0 },
      snapshot: null,
      verification,
    };
  }
  const targetStates = await runtime.generateTargetStates({
    plan,
    entries,
    now,
  });
  const snapshotId = createKnowledgeSnapshotId({
    now,
    planDigest: plan.planDigest,
  });
  const payload = buildKnowledgeSnapshotPayload({
    plan,
    entries,
    targetStates,
    snapshotId,
    now,
  });
  const snapshot = await runtime.createSnapshot({
    directory: authorization.snapshotDirectory,
    secret: authorization.snapshotSecret,
    payload,
  });
  let result;
  let verification;
  try {
    result = await runtime.applyTargetStates({ plan, targetStates });
    const postEntries = await runtime.loadEntries();
    verification = verifyKnowledgeReembedPostState({
      plan,
      targetStates,
      entries: postEntries,
    });
  } catch (error) {
    error.snapshotId = snapshot.snapshotId;
    throw error;
  }
  return {
    mode: "apply",
    operation: "reembed",
    success: true,
    planDigest: plan.planDigest,
    targetProfile: plan.targetProfile,
    targetVersion: plan.targetVersion,
    summary: plan.summary,
    result,
    snapshot: safeSnapshotOutput(snapshot),
    verification,
  };
};

export const runStagingKnowledgeBaseReembed = async ({
  argv = process.argv.slice(2),
  env = process.env,
  dependencies = {},
  now = new Date(),
} = {}) => {
  const authorization = validateStagingKnowledgeBaseReembedAuthorization({
    argv,
    env,
  });
  const runtime = { ...defaultDependencies, ...dependencies };
  let connected = false;
  try {
    if (authorization.apply && authorization.operation === "reembed") {
      await runtime.assertBackupReady({ now });
    }
    await runtime.connect(env.MONGO_URI);
    connected = true;
    await runtime.assertConnectedTarget(authorization);
    const result = authorization.operation === "rollback"
      ? await runRollback({ authorization, runtime })
      : await runReembed({ authorization, runtime, now });
    return result;
  } finally {
    if (connected) await runtime.disconnect();
  }
};

const main = async () => {
  const result = await runStagingKnowledgeBaseReembed();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({
        code: error.code || "KB_REEMBED_FAILED",
        ...(error.snapshotId && { snapshotId: error.snapshotId }),
      })}\n`,
    );
    process.exitCode = 1;
  });
}
