import crypto from "crypto";
import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import F1Customer from "../models/F1Customer.js";
import { incrementMetric } from "../observability/metrics.js";

const normalizeActorRole = (role) =>
  ["admin", "trainer", "user"].includes(role) ? role : "user";

const sourceFingerprint = ({ sourceDocuments, engineVersion }) => {
  const source = sourceDocuments.map((document) => ({
    id: String(document?._id || ""),
    updatedAt: document?.updatedAt
      ? new Date(document.updatedAt).toISOString()
      : "",
  }));
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ engineVersion, source }))
    .digest("hex");
};

const findReplay = async ({
  Model,
  requestId,
  canonicalFilter,
  regenerate,
}) => {
  const byRequest = await Model.findOne({ requestId });
  if (byRequest) return byRequest;
  if (!regenerate) return Model.findOne(canonicalFilter);
  return null;
};

export const createIdempotentF1Artifact = async ({
  Model,
  customerId,
  sourceFields,
  sourceDocuments,
  engineVersion,
  requestId,
  regenerate = false,
  payload,
  customerUpdate,
  audit,
}) => {
  const fingerprint = sourceFingerprint({ sourceDocuments, engineVersion });
  const generationKey = regenerate ? requestId : "canonical";
  const canonicalFilter = {
    ...sourceFields,
    engineVersion,
    sourceFingerprint: fingerprint,
    generationKey: "canonical",
  };
  const existing = await findReplay({
    Model,
    requestId,
    canonicalFilter,
    regenerate,
  });
  if (existing) {
    incrementMetric("f1.artifact_idempotency_hits");
    return { artifact: existing, idempotentReplay: true };
  }

  const session = await mongoose.startSession();
  try {
    let artifact;
    let idempotentReplay = false;
    await session.withTransaction(async () => {
      const replay = await Model.findOne({ requestId }).session(session);
      if (replay) {
        artifact = replay;
        idempotentReplay = true;
        return;
      }
      if (!regenerate) {
        const canonical = await Model.findOne(canonicalFilter).session(session);
        if (canonical) {
          artifact = canonical;
          idempotentReplay = true;
          return;
        }
      }
      const latest = await Model.findOne({ customerId })
        .sort({ version: -1, createdAt: -1 })
        .session(session);
      const version = Math.max(Number(latest?.version || 0) + 1, 1);
      const created = await Model.create(
        [
          {
            ...sourceFields,
            ...payload,
            engineVersion,
            sourceFingerprint: fingerprint,
            generationKey,
            requestId,
            version,
            regeneratedFrom: regenerate ? latest?._id || null : null,
          },
        ],
        { session },
      );
      artifact = created[0];
      if (customerUpdate) {
        await F1Customer.updateOne(
          { _id: customerId },
          { $set: customerUpdate(artifact) },
          { session },
        );
      }
      if (audit) {
        await AuditLog.create(
          [
            {
              actorId: audit.actorId,
              actorRole: normalizeActorRole(audit.actorRole),
              action: audit.action,
              targetType: audit.targetType,
              targetId: artifact._id,
              metadata: {
                customerId: String(customerId),
                version,
                regenerate,
                requestId: audit.requestId || "",
              },
              ipAddress: audit.ipAddress || "",
              userAgent: audit.userAgent || "",
            },
          ],
          { session },
        );
      }
    });
    if (!artifact) {
      throw new Error("F1 artifact transaction completed without an artifact");
    }
    if (idempotentReplay) incrementMetric("f1.artifact_idempotency_hits");
    return { artifact, idempotentReplay };
  } catch (error) {
    if (error.code === 11000) {
      incrementMetric("f1.artifact_conflicts");
      const replay = await findReplay({
        Model,
        requestId,
        canonicalFilter,
        regenerate,
      });
      if (replay) {
        incrementMetric("f1.artifact_idempotency_hits");
        return { artifact: replay, idempotentReplay: true };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

export const getF1SourceFingerprint = sourceFingerprint;
