import mongoose from "mongoose";
import DailyJournal from "../models/DailyJournal.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  assertJournalEditWindow,
  assertJournalWritesEnabled,
  journalError,
  resolveJournalWriteAccess,
} from "./dailyJournalAccess.service.js";
import { toDailyJournalDto } from "./dailyJournalDto.service.js";
import {
  createJournalRevision,
  findJournalReplay,
} from "./dailyJournalCommand.service.js";
import {
  buildJournalChanges,
  journalFingerprint,
  normalizeJournalPatch,
} from "./dailyJournalPatch.service.js";
import {
  canonicalizeNutritionFields,
} from "./dailyJournalNutrition.service.js";
import {
  canonicalizeHabitCompletions,
} from "./dailyJournalHabit.service.js";
import { createInAppNotification } from "./inAppNotification.service.js";
import { getMissingDailyJournalFieldKeys } from "./coachingSubmissionCompleteness.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assertCommandInput = ({ expectedRevision, requestId }) => {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw journalError(
      400,
      "expectedRevision không hợp lệ",
      "INVALID_REVISION",
    );
  }
  if (!UUID_PATTERN.test(String(requestId || ""))) {
    throw journalError(
      400,
      "requestId không hợp lệ",
      "INVALID_REQUEST_ID",
    );
  }
};

const applyCommand = async ({
  actor,
  dateKey,
  expectedRevision,
  requestId,
  patch,
  action,
  reason = "",
  now = new Date(),
}) => {
  assertJournalWritesEnabled();
  assertJournalEditWindow(dateKey, now);
  assertCommandInput({ expectedRevision, requestId });
  const providedReason = String(reason || "").trim();
  const normalizedReason =
    action === "correction" && !providedReason
      ? "Khách hàng cập nhật nhật ký"
      : providedReason;
  if (normalizedReason.length > 500) {
    throw journalError(400, "Lý do quá dài", "INVALID_REASON");
  }

  const patchFields =
    action === "submit" && patch === undefined
      ? {}
      : normalizeJournalPatch(patch);
  const payloadFingerprint = journalFingerprint({
    action,
    dateKey,
    expectedRevision,
    patchFields,
    reason: normalizedReason,
  });
  const prior = await findJournalReplay({
    actorId: actor.id,
    requestId,
    action,
    payloadFingerprint,
  });
  if (prior) {
    return {
      data: toDailyJournalDto(prior.journal),
      idempotentReplay: true,
    };
  }

  const session = await mongoose.startSession();
  let result;
  let didSave = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findJournalReplay({
        actorId: actor.id,
        requestId,
        action,
        payloadFingerprint,
        session,
      });
      if (replay) {
        result = replay;
        return;
      }
      const assignment = await resolveJournalWriteAccess({
        clientId: actor.id,
        session,
      });
      const journal = await DailyJournal.findOne({
        clientId: actor.id,
        dateKey,
      }).session(session);
      if (
        !journal &&
        (action === "correction" ||
          (action === "submit" && Object.keys(patchFields).length === 0))
      ) {
        throw journalError(
          404,
          "Chưa có nhật ký để thực hiện thao tác",
          "JOURNAL_NOT_FOUND",
        );
      }
      if (journal && journal.revision !== expectedRevision) {
        incrementMetric("daily_journal.revision_conflicts");
        throw journalError(
          409,
          "Nhật ký đã thay đổi, vui lòng tải bản mới",
          "STALE_REVISION",
        );
      }
      if (!journal && expectedRevision !== 0) {
        incrementMetric("daily_journal.revision_conflicts");
        throw journalError(
          409,
          "Nhật ký chưa tồn tại ở revision yêu cầu",
          "STALE_REVISION",
        );
      }
      if (journal?.status === "submitted" && action === "update") {
        throw journalError(
          409,
          "Nhật ký đã submit, hãy dùng correction có lý do",
          "JOURNAL_SUBMITTED",
        );
      }
      if (action === "correction" && journal?.status !== "submitted") {
        throw journalError(
          409,
          "Chỉ có thể chỉnh sửa nhật ký đã gửi",
          "JOURNAL_NOT_SUBMITTED",
        );
      }
      if (action === "correction" && (journal?.correctionCount || 0) >= 1) {
        throw journalError(
          409,
          "Nhật ký này đã dùng lượt cập nhật sau khi gửi",
          "JOURNAL_CORRECTION_LIMIT_REACHED",
        );
      }
      if (action === "submit" && journal?.status === "submitted") {
        throw journalError(
          409,
          "Nhật ký đã được submit",
          "JOURNAL_ALREADY_SUBMITTED",
        );
      }

      const base =
        journal ||
        new DailyJournal({
          clientId: actor.id,
          trainerIdAtCreation: assignment.trainerId,
          dateKey,
        });
      const commandFields = {
        ...patchFields,
        ...(action === "submit"
          ? { status: "submitted", submittedAt: now }
          : {}),
      };
      const nutritionFields = await canonicalizeNutritionFields({
        clientId: actor.id,
        journal,
        setFields: commandFields,
        session,
        now,
      });
      let setFields = await canonicalizeHabitCompletions({
        clientId: actor.id,
        dateKey,
        journal,
        setFields: nutritionFields,
        session,
        now,
      });
      if (
        action === "correction" &&
        buildJournalChanges(base, setFields).length === 0
      ) {
        throw journalError(
          400,
          "Hãy thay đổi ít nhất một mục trước khi gửi cập nhật",
          "EMPTY_DAILY_JOURNAL_CORRECTION",
        );
      }
      if (action === "correction") {
        setFields = {
          ...setFields,
          correctionCount: (journal.correctionCount || 0) + 1,
        };
      }
      const changes = buildJournalChanges(base, setFields);
      if (changes.length === 0) {
        result = { journal: base, idempotentReplay: false };
        return;
      }

      let updated;
      let revisionAction = action;
      if (!journal) {
        for (const [path, value] of Object.entries(setFields)) {
          base.set(path, value);
        }
        base.revision = 1;
        updated = await base.save({ session });
        revisionAction = action === "update" ? "create" : action;
      } else {
        const updateFilter = { _id: journal._id, revision: expectedRevision };
        if (action === "correction") {
          updateFilter.$or = [
            { correctionCount: { $exists: false } },
            { correctionCount: { $lt: 1 } },
          ];
        }
        updated = await DailyJournal.findOneAndUpdate(
          updateFilter,
          { $set: setFields, $inc: { revision: 1 } },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          },
        );
        if (!updated) {
          incrementMetric("daily_journal.revision_conflicts");
          throw journalError(
            409,
            "Nhật ký đã thay đổi, vui lòng tải bản mới",
            "STALE_REVISION",
          );
        }
      }
      await createJournalRevision({
        journal: updated,
        actor,
        action: revisionAction,
        reason: normalizedReason,
        requestId,
        payloadFingerprint,
        changes,
        session,
      });
      if (action === "submit" || action === "correction") {
        await createInAppNotification({
          recipientId: assignment.trainerId,
          actorId: actor.id,
          clientId: actor.id,
          type:
            action === "submit" ? "journal_submitted" : "journal_corrected",
          targetType: "daily_journal",
          targetId: updated._id,
          clientName: assignment.clientName,
          contextDateKey: dateKey,
          missingFields: getMissingDailyJournalFieldKeys(updated),
          dedupeKey:
            "daily-journal:" + action + ":" +
            updated._id +
            ":" +
            updated.revision,
          session,
        });
      }
      didSave = true;
      result = { journal: updated, idempotentReplay: false };
    });
  } catch (error) {
    if (error?.code === 11000) {
      const replay = await findJournalReplay({
        actorId: actor.id,
        requestId,
        action,
        payloadFingerprint,
      });
      if (replay) result = replay;
      else {
        incrementMetric("daily_journal.revision_conflicts");
        throw journalError(
          409,
          "Nhật ký đã thay đổi, vui lòng tải bản mới",
          "STALE_REVISION",
        );
      }
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }
  if (didSave) incrementMetric("daily_journal.saves");
  return {
    data: toDailyJournalDto(result.journal),
    idempotentReplay: Boolean(result.idempotentReplay),
  };
};

export const saveDailyJournal = (input) =>
  applyCommand({ ...input, action: "update" });

export const submitDailyJournal = (input) =>
  applyCommand({ ...input, action: "submit" });

export const correctDailyJournal = (input) =>
  applyCommand({ ...input, action: "correction" });
