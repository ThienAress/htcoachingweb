import {
  APP_TIME_ZONE,
  addDaysToDateKey,
  getAppDayOfWeek,
  getVietnamDateKey,
  parseDateKey,
} from "../utils/dateKey.js";

export const TRAINING_TIME_ZONE = APP_TIME_ZONE;
export const SLOT_MINUTES = 15;
export const MAX_OCCURRENCE_DAYS_AHEAD = 56;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VIETNAM_OFFSET_HOURS = 7;

export { getAppDayOfWeek, getVietnamDateKey };

const addDaysToKey = addDaysToDateKey;

export const getNextOccurrenceDateKey = (
  dayOfWeek,
  now = new Date(),
) => {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw Object.assign(new Error("dayOfWeek phải từ 0 đến 6"), {
      statusCode: 400,
    });
  }
  const todayKey = getVietnamDateKey(now);
  const currentDay = getAppDayOfWeek(todayKey);
  return addDaysToKey(todayKey, (dayOfWeek - currentDay + 7) % 7);
};

const localDateTimeToUtc = (dateKey, time, nextDay = false) => {
  if (!TIME_PATTERN.test(String(time || ""))) {
    throw Object.assign(new Error("Thời gian không hợp lệ (HH:mm)"), {
      statusCode: 400,
    });
  }
  const effectiveDateKey = nextDay ? addDaysToKey(dateKey, 1) : dateKey;
  const { year, month, day } = parseDateKey(effectiveDateKey);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, hour - VIETNAM_OFFSET_HOURS, minute),
  );
};

const validateGranularity = (time) => {
  const minute = Number(time.slice(3, 5));
  if (minute % SLOT_MINUTES !== 0) {
    throw Object.assign(
      new Error("Thời gian phải theo bước " + SLOT_MINUTES + " phút"),
      { statusCode: 400 },
    );
  }
};

export const normalizeOccurrenceInput = (
  {
    occurrenceDateKey,
    dayOfWeek,
    startTime,
    endTime,
  },
  {
    now = new Date(),
    allowPast = false,
    maxDaysAhead = MAX_OCCURRENCE_DAYS_AHEAD,
  } = {},
) => {
  if (!TIME_PATTERN.test(String(startTime || "")) ||
      !TIME_PATTERN.test(String(endTime || ""))) {
    throw Object.assign(new Error("Thời gian không hợp lệ (HH:mm)"), {
      statusCode: 400,
    });
  }
  validateGranularity(startTime);
  validateGranularity(endTime);

  let dateKey = occurrenceDateKey
    ? String(occurrenceDateKey)
    : getNextOccurrenceDateKey(Number(dayOfWeek), now);
  let resolvedDay = getAppDayOfWeek(dateKey);
  if (
    dayOfWeek !== undefined &&
    Number(dayOfWeek) !== resolvedDay
  ) {
    throw Object.assign(
      new Error("dayOfWeek không khớp với occurrenceDateKey"),
      { statusCode: 400 },
    );
  }

  let startAt = localDateTimeToUtc(dateKey, startTime);
  let endAt = localDateTimeToUtc(
    dateKey,
    endTime,
    endTime === "00:00",
  );
  if (!occurrenceDateKey && !allowPast && startAt <= now) {
    dateKey = addDaysToKey(dateKey, 7);
    resolvedDay = getAppDayOfWeek(dateKey);
    startAt = localDateTimeToUtc(dateKey, startTime);
    endAt = localDateTimeToUtc(
      dateKey,
      endTime,
      endTime === "00:00",
    );
  }
  const durationMinutes = (endAt.getTime() - startAt.getTime()) / 60000;

  if (durationMinutes < SLOT_MINUTES || durationMinutes > 240) {
    throw Object.assign(
      new Error("Buổi tập phải kéo dài từ 15 phút đến 4 giờ"),
      { statusCode: 400 },
    );
  }

  if (!allowPast && startAt <= now) {
    throw Object.assign(new Error("Không thể đặt lịch trong quá khứ"), {
      statusCode: 400,
    });
  }
  const maxDate = new Date(now.getTime() + maxDaysAhead * 86400000);
  if (!allowPast && startAt > maxDate) {
    throw Object.assign(
      new Error("Chỉ có thể đặt lịch trong " + maxDaysAhead + " ngày tới"),
      { statusCode: 400 },
    );
  }

  return {
    occurrenceDateKey: dateKey,
    dayOfWeek: resolvedDay,
    startTime,
    endTime,
    startAt,
    endAt,
    expiresAt: endAt,
    timeZone: TRAINING_TIME_ZONE,
  };
};

export const buildSlotStarts = (startAt, endAt) => {
  const slots = [];
  for (
    let timestamp = startAt.getTime();
    timestamp < endAt.getTime();
    timestamp += SLOT_MINUTES * 60000
  ) {
    slots.push(new Date(timestamp));
  }
  return slots;
};
