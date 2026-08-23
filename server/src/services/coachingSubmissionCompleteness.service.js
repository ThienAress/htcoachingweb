import {
  DAILY_JOURNAL_SUBMISSION_FIELDS,
  WEEKLY_CHECKIN_SUBMISSION_FIELDS,
} from "../constants/coachingSubmissionFields.js";

const valueAtPath = (document, path) =>
  path.split(".").reduce((value, key) => value?.[key], document);

const isFilled = (value) =>
  value !== null && value !== undefined && value !== "";

const missingFieldKeys = (document, fields) =>
  fields
    .filter(({ path }) => !isFilled(valueAtPath(document, path)))
    .map(({ key }) => key);

export const getMissingDailyJournalFieldKeys = (journal) =>
  missingFieldKeys(journal, DAILY_JOURNAL_SUBMISSION_FIELDS);

export const getMissingWeeklyCheckinFieldKeys = (checkin) =>
  missingFieldKeys(checkin, WEEKLY_CHECKIN_SUBMISSION_FIELDS);
