import Contract from "../models/Contract.js";

export function contractError(code, statusCode, message) {
  return Object.assign(new Error(message), { code, statusCode });
}

export function revisionPredicate(expectedRevision) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision === Number.MAX_SAFE_INTEGER) {
    throw contractError("CONTRACT_REVISION_INVALID", 400, "expectedRevision phải là số nguyên không âm hợp lệ");
  }
  return expectedRevision === 0
    ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
    : { revision: expectedRevision };
}

export async function throwDraftConflict(ownerFilter, expectedRevision, { requireSignature = false } = {}) {
  const existing = await Contract.findOne(ownerFilter).select("status revision trainerSignature").lean();
  if (!existing) throw contractError("CONTRACT_NOT_FOUND", 404, "Hợp đồng không tồn tại");
  if (existing.status !== "draft" || (existing.revision === undefined ? 0 : existing.revision) !== expectedRevision) {
    throw contractError("CONTRACT_REVISION_CONFLICT", 409, "Hợp đồng đã thay đổi. Vui lòng tải lại trước khi tiếp tục.");
  }
  if (requireSignature && !existing.trainerSignature) {
    throw contractError("CONTRACT_TRAINER_SIGNATURE_REQUIRED", 400, "HLV chưa ký tên. Vui lòng ký trước khi gửi.");
  }
  throw contractError("CONTRACT_REVISION_CONFLICT", 409, "Hợp đồng đã thay đổi. Vui lòng tải lại trước khi tiếp tục.");
}
