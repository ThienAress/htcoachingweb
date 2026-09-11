import { createHash } from "node:crypto";
import mongoose from "mongoose";
import BodyAssessment from "../models/BodyAssessment.js";
import BodyAssessmentCommand from "../models/BodyAssessmentCommand.js";
import BodyAssessmentRevision from "../models/BodyAssessmentRevision.js";
import {
  assertBodyAssessmentTrainer,
  assertBodyAssessmentWritesEnabled,
} from "./bodyAssessmentAccess.service.js";
import { bodyAssessmentDto } from "./bodyAssessmentDto.service.js";
import { assertBodyAssessmentWriteIndexes } from "./bodyAssessmentIndexReadiness.service.js";
import { assessmentError, assertBodyAssessmentTarget, assertBodyAssessmentPublish, normalizeBodyAssessmentCommand } from "./bodyAssessmentValidation.service.js";
import { createInAppNotification } from "./inAppNotification.service.js";

const conflict = () => assessmentError(409, "Kết quả đã thay đổi. Hãy tải lại trước khi lưu", "BODY_ASSESSMENT_STALE");
const replay = async ({ actor, action, command, fingerprint, session = null }) => {
  const receipt = await BodyAssessmentCommand.findOne({ actorId: actor.id, action, requestId: command.requestId }).select("+fingerprint").session(session).lean();
  if (!receipt) return null;
  if (receipt.fingerprint !== fingerprint) throw assessmentError(409, "requestId đã dùng với dữ liệu khác", "BODY_ASSESSMENT_REQUEST_ID_REUSED");
  const assessment = await BodyAssessment.findById(receipt.assessmentId).session(session).lean();
  if (!assessment) throw conflict();
  return { assessment: bodyAssessmentDto(assessment, { trainer: true }), idempotentReplay: true };
};

const execute = async ({ actor, clientId, weekStartDateKey, body, action }) => {
  assertBodyAssessmentWritesEnabled();
  await assertBodyAssessmentWriteIndexes();
  assertBodyAssessmentTarget(clientId, weekStartDateKey);
  clientId = new mongoose.Types.ObjectId(clientId).toHexString();
  const command = normalizeBodyAssessmentCommand(body, action);
  const fingerprint = createHash("sha256").update(JSON.stringify({ clientId: String(clientId), weekStartDateKey, action, command })).digest("hex");
  await assertBodyAssessmentTrainer({ actor, clientId });
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      await assertBodyAssessmentTrainer({ actor, clientId, session });
      result = await replay({ actor, action, command, fingerprint, session });
      if (result) return;
      const filter = { clientId, weekStartDateKey };
      const current = await BodyAssessment.findOne(filter).select("+draftReason").session(session).lean();
      if ((current?.revision ?? 0) !== command.expectedRevision) throw conflict();
      if (action === "publish" && !current?.draft) throw assessmentError(409, "Không có bản nháp để gửi", "BODY_ASSESSMENT_NO_DRAFT");
      const reason = command.reason || (action === "publish" ? current.draftReason : "");
      if (current?.published && !reason) throw assessmentError(400, "Cần lý do chỉnh sửa kết quả đã gửi", "BODY_ASSESSMENT_REASON_REQUIRED");
      const revision = (current?.revision ?? 0) + 1;
      let snapshot = command.draft;
      const update = { revision };
      if (action === "save") {
        update.draft = command.draft;
        update.draftReason = reason;
      } else {
        assertBodyAssessmentPublish(current.draft, command.confirmPartial);
        snapshot = { ...current.draft, publishedAt: new Date() };
        update.published = snapshot;
        update.draft = null;
        update.draftReason = "";
      }
      const assessment = current
        ? await BodyAssessment.findOneAndUpdate({ ...filter, revision: command.expectedRevision }, { $set: update }, { session, returnDocument: "after", runValidators: true })
        : (await BodyAssessment.create([{ ...filter, ...update }], { session }))[0];
      if (!assessment) throw conflict();
      await BodyAssessmentRevision.create([{ assessmentId: assessment._id, clientId, revision, actorId: actor.id, actorRole: actor.role, action, reason, snapshot }], { session });
      let notificationStatus = "not_applicable";
      if (action === "publish") {
        const notification = await createInAppNotification({ recipientId: clientId, actorId: actor.id, clientId,
          type: "body_assessment_published", targetType: "body_assessment", targetId: assessment._id,
          dedupeKey: `body-assessment:${assessment._id}:${revision}`, session });
        notificationStatus = notification.suppressed ? "suppressed" : "created";
      }
      await BodyAssessmentCommand.create([{ assessmentId: assessment._id, clientId, actorId: actor.id, action, requestId: command.requestId, fingerprint, revision, notificationStatus }], { session });
      result = { assessment: bodyAssessmentDto(assessment, { trainer: true }), idempotentReplay: false };
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    await assertBodyAssessmentTrainer({ actor, clientId });
    result = await replay({ actor, action, command, fingerprint });
    if (!result) throw conflict();
  } finally {
    await session.endSession();
  }
  return result;
};

export const saveBodyAssessment = (input) => execute({ ...input, action: "save" });
export const publishBodyAssessment = (input) => execute({ ...input, action: "publish" });
