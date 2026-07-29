import api from "../utils/api";

export const getDailyJournal = (dateKey) =>
  api.get("/daily-journals/" + encodeURIComponent(dateKey));

export const saveDailyJournal = (dateKey, data) =>
  api.put("/daily-journals/" + encodeURIComponent(dateKey), data);

export const submitDailyJournal = (dateKey, data) =>
  api.post(
    "/daily-journals/" + encodeURIComponent(dateKey) + "/submit",
    data,
  );

export const correctDailyJournal = (dateKey, data) =>
  api.post(
    "/daily-journals/" + encodeURIComponent(dateKey) + "/corrections",
    data,
  );

export const getDailyJournalRevisions = (dateKey, params) =>
  api.get(
    "/daily-journals/" + encodeURIComponent(dateKey) + "/revisions",
    { params },
  );

export const getDailyJournalTimeline = (dateKey) =>
  api.get(
    "/daily-journals/" + encodeURIComponent(dateKey) + "/timeline",
  );
