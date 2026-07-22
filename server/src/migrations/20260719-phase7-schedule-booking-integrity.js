import "../config/env.js";
import crypto from "node:crypto";
import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import ReminderDelivery from "../models/ReminderDelivery.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import TrainingScheduleCommand from "../models/TrainingScheduleCommand.js";
import TrainingSlotClaim from "../models/TrainingSlotClaim.js";
import {
  buildSlotStarts,
  getNextOccurrenceDateKey,
  normalizeOccurrenceInput,
} from "../services/trainingOccurrence.service.js";
import { verifyTrainingScheduleIntegrity } from "../services/trainingScheduleIntegrity.service.js";

const throwPreflight = (message, details) => {
  const error = new Error("Phase 7 preflight failed: " + message);
  error.details = details;
  throw error;
};

const prepareSchedules = async (now) => {
  const records = await TrainingSchedule.collection.find({}).toArray();
  const prepared = [];
  const invalid = [];

  for (const record of records) {
    try {
      const baseDate = record.createdAt || now;
      const occurrenceDateKey =
        record.occurrenceDateKey ||
        getNextOccurrenceDateKey(Number(record.dayOfWeek), baseDate);
      const occurrence = normalizeOccurrenceInput(
        {
          occurrenceDateKey,
          dayOfWeek: record.dayOfWeek,
          startTime: record.startTime,
          endTime: record.endTime,
        },
        { now: baseDate, allowPast: true },
      );
      const status = ["cancelled", "completed"].includes(record.status)
        ? record.status
        : occurrence.endAt <= now
          ? "completed"
          : "scheduled";
      prepared.push({
        record,
        occurrence,
        status,
        isActive: status === "scheduled",
      });
    } catch (error) {
      invalid.push({
        scheduleId: String(record._id),
        message: error.message,
      });
    }
  }
  if (invalid.length > 0) {
    throwPreflight("invalid legacy schedule occurrences", invalid.slice(0, 200));
  }
  return prepared;
};

const assertNoScheduleConflicts = (prepared) => {
  const clientDates = new Map();
  const trainerSlots = new Map();
  const clientConflicts = [];
  const trainerConflicts = [];

  for (const item of prepared) {
    if (!item.isActive) continue;
    const clientKey =
      String(item.record.clientId) + "|" + item.occurrence.occurrenceDateKey;
    if (clientDates.has(clientKey)) {
      clientConflicts.push({
        key: clientKey,
        scheduleIds: [
          clientDates.get(clientKey),
          String(item.record._id),
        ],
      });
    } else {
      clientDates.set(clientKey, String(item.record._id));
    }
    for (const slotStartAt of buildSlotStarts(
      item.occurrence.startAt,
      item.occurrence.endAt,
    )) {
      const trainerKey =
        String(item.record.trainerId) + "|" + slotStartAt.toISOString();
      if (trainerSlots.has(trainerKey)) {
        trainerConflicts.push({
          key: trainerKey,
          scheduleIds: [
            trainerSlots.get(trainerKey),
            String(item.record._id),
          ],
        });
      } else {
        trainerSlots.set(trainerKey, String(item.record._id));
      }
    }
  }
  if (clientConflicts.length > 0 || trainerConflicts.length > 0) {
    throwPreflight("schedule conflicts require manual resolution", {
      duplicateClientDates: clientConflicts.slice(0, 200),
      overlappingTrainerSlots: trainerConflicts.slice(0, 200),
    });
  }
};

const backfillSchedules = async (prepared) => {
  if (prepared.length === 0) return 0;
  const result = await TrainingSchedule.collection.bulkWrite(
    prepared.map((item) => ({
      updateOne: {
        filter: { _id: item.record._id },
        update: {
          $set: {
            ...item.occurrence,
            status: item.status,
            isActive: item.isActive,
            revision: Number.isInteger(item.record.revision)
              ? item.record.revision
              : 0,
            createdByType: item.record.createdByType || "migration",
            lastClientEditAt:
              item.record.lastClientEditAt ||
              item.record.lastClientEdit ||
              null,
          },
        },
      },
    })),
  );
  return result.modifiedCount;
};

const rebuildSlotClaims = async (prepared) => {
  await TrainingSlotClaim.collection.deleteMany({});
  const claims = [];
  for (const item of prepared) {
    if (!item.isActive) continue;
    for (const slotStartAt of buildSlotStarts(
      item.occurrence.startAt,
      item.occurrence.endAt,
    )) {
      claims.push({
        scheduleId: item.record._id,
        trainerId: item.record.trainerId,
        clientId: item.record.clientId,
        occurrenceDateKey: item.occurrence.occurrenceDateKey,
        slotStartAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
  if (claims.length > 0) {
    await TrainingSlotClaim.collection.insertMany(claims, { ordered: true });
  }
  return claims.length;
};

const backfillBookings = async () => {
  const bookings = await Booking.collection.find({}).toArray();
  if (bookings.length === 0) return 0;
  const result = await Booking.collection.bulkWrite(
    bookings.map((booking) => ({
      updateOne: {
        filter: { _id: booking._id },
        update: {
          $set: {
            clientRequestId:
              booking.clientRequestId || "legacy-" + String(booking._id),
            requestFingerprint:
              booking.requestFingerprint ||
              crypto
                .createHash("sha256")
                .update("legacy-booking:" + String(booking._id))
                .digest("hex"),
            revision: Number.isInteger(booking.revision)
              ? booking.revision
              : 0,
            isArchived: booking.isArchived === true,
            nameNormalized: String(booking.name || "").trim().toLowerCase(),
            emailNormalized: String(booking.email || "").trim().toLowerCase(),
            phoneNormalized: String(booking.phone || "").replace(/\D/g, ""),
          },
        },
      },
    })),
  );
  return result.modifiedCount;
};

const dropLegacyScheduleIndexes = async () => {
  const indexes = await TrainingSchedule.collection.indexes();
  const namesToDrop = indexes
    .filter(
      (index) =>
        index.expireAfterSeconds !== undefined ||
        [
          "trainerId_1_dayOfWeek_1",
          "clientId_1_dayOfWeek_1_startTime_1",
          "dayOfWeek_1_startTime_1_expiresAt_1",
        ].includes(index.name),
    )
    .map((index) => index.name);
  for (const name of namesToDrop) {
    await TrainingSchedule.collection.dropIndex(name);
  }
  return namesToDrop;
};

const createPhase7Indexes = async () => {
  await TrainingSchedule.collection.createIndex(
    { clientId: 1, occurrenceDateKey: 1 },
    {
      unique: true,
      partialFilterExpression: {
        isActive: true,
        occurrenceDateKey: { $type: "string" },
      },
      name: "uniq_active_client_occurrence_date",
    },
  );
  await TrainingSchedule.collection.createIndex(
    { requestedBy: 1, requestId: 1 },
    {
      unique: true,
      partialFilterExpression: { requestId: { $type: "string" } },
      name: "uniq_schedule_request",
    },
  );
  await TrainingSchedule.collection.createIndex(
    { trainerId: 1, status: 1, startAt: 1 },
    { name: "trainerId_1_status_1_startAt_1" },
  );
  await TrainingSchedule.collection.createIndex(
    { clientId: 1, status: 1, startAt: 1 },
    { name: "clientId_1_status_1_startAt_1" },
  );
  await TrainingSlotClaim.collection.createIndex(
    { trainerId: 1, slotStartAt: 1 },
    { unique: true, name: "uniq_trainer_slot" },
  );
  await TrainingSlotClaim.collection.createIndex(
    { scheduleId: 1 },
    { name: "scheduleId_1" },
  );
  await TrainingScheduleCommand.collection.createIndex(
    { actorId: 1, requestId: 1 },
    { unique: true, name: "uniq_training_schedule_command" },
  );
  await ReminderDelivery.collection.createIndex(
    { scheduleId: 1, occurrenceKey: 1, channel: 1 },
    { unique: true, name: "uniq_schedule_reminder_delivery" },
  );
  await Booking.collection.createIndex(
    { clientRequestId: 1 },
    { unique: true, name: "uniq_booking_client_request" },
  );
  await Booking.collection.createIndex(
    { isArchived: 1, status: 1, createdAt: -1 },
    { name: "isArchived_1_status_1_createdAt_-1" },
  );
};

export const runPhase7Migration = async () => {
  const now = new Date();
  const prepared = await prepareSchedules(now);
  assertNoScheduleConflicts(prepared);

  const schedulesBackfilled = await backfillSchedules(prepared);
  const bookingsBackfilled = await backfillBookings();
  const droppedIndexes = await dropLegacyScheduleIndexes();
  const slotClaimsCreated = await rebuildSlotClaims(prepared);
  await createPhase7Indexes();

  const verification = await verifyTrainingScheduleIntegrity();
  if (verification.totalIssues > 0) {
    throwPreflight("post-migration verification failed", verification);
  }
  return {
    schedulesScanned: prepared.length,
    schedulesBackfilled,
    bookingsBackfilled,
    droppedIndexes,
    slotClaimsCreated,
    verification,
  };
};

const runFromCli = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  if (process.env.CONFIRM_PHASE7_SCHEDULE_MIGRATION !== "yes") {
    throw new Error(
      "Set CONFIRM_PHASE7_SCHEDULE_MIGRATION=yes after backup and staging verification",
    );
  }
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    const report = await runPhase7Migration();
    console.log(JSON.stringify(report, null, 2));
    console.log("Phase 7 schedule and booking migration completed");
  } finally {
    await mongoose.disconnect();
  }
};

if (
  process.argv[1]?.endsWith(
    "20260719-phase7-schedule-booking-integrity.js",
  )
) {
  runFromCli().catch((error) => {
    console.error(error.message);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 1;
  });
}
