import { BODY_SEGMENTS, BODY_SEGMENT_FIELDS } from "./bodyAssessmentValidation.service.js";

export const bodyAssessmentSnapshotDto = (snapshot) => snapshot ? ({
  measuredDateKey: snapshot.measuredDateKey,
  deviceLabel: snapshot.deviceLabel,
  referenceBasis: snapshot.referenceBasis,
  note: snapshot.note,
  segments: Object.fromEntries(BODY_SEGMENTS.map((key) => [key, Object.fromEntries(BODY_SEGMENT_FIELDS.map((field) => [field, snapshot.segments?.[key]?.[field] ?? null]))])),
  ...(snapshot.publishedAt ? { publishedAt: snapshot.publishedAt } : {}),
}) : null;
export const bodyAssessmentDto = (record, { trainer = false } = {}) => record ? ({
  id: String(record._id), weekStartDateKey: record.weekStartDateKey,
  published: bodyAssessmentSnapshotDto(record.published),
  ...(trainer ? { revision: record.revision, draft: bodyAssessmentSnapshotDto(record.draft) } : {}),
}) : null;
