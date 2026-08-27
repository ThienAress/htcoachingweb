import "../config/env.js";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import AuditLog from "../models/AuditLog.js";
import BlogPost from "../models/BlogPost.js";
import Booking from "../models/Booking.js";
import Checkin from "../models/Checkin.js";
import CoachingDay from "../models/CoachingDay.js";
import DepositRequest from "../models/DepositRequest.js";
import Order from "../models/Order.js";
import Recipe from "../models/Recipe.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import TrainingScheduleCommand from "../models/TrainingScheduleCommand.js";
import TrainingSlotClaim from "../models/TrainingSlotClaim.js";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { reconcileWallets } from "../services/walletReconciliation.service.js";
import {
  createAcceptanceIdentity,
  reconciliationIssueDelta,
  runWithVerifiedCleanup,
} from "./stagingAcceptanceSafety.js";

const STAGING_API_ORIGIN = "https://htcoachingweb-staging.onrender.com";
const FIXTURE_EMAILS = {
  trainer: "staging.trainer@example.invalid",
  client: "staging.client@example.invalid",
  secondClient: "staging.client.two@example.invalid",
};

const csrfToken = crypto.randomBytes(32).toString("hex");
const { runId, marker } = createAcceptanceIdentity();
const runSuffix = runId.replaceAll("-", "").slice(-10);
const runStartedAt = new Date();
const flows = [];
const cleanup = {
  blogSlugs: new Set(),
  recipeSlugs: new Set(),
  recipeIds: new Set(),
  coachingKeys: [],
  checkins: [],
  scheduleRequestIds: new Set(),
  scheduleIds: new Set(),
  bookingRequestIds: new Set(),
  bookingIds: new Set(),
  depositIds: new Set(),
  depositWindows: [],
  walletBaselines: new Map(),
  auditTargetIds: new Set(),
  walletReconciliationBaseline: null,
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const writeEvidence = async (evidence) => {
  const output = String(process.env.STAGING_ACCEPTANCE_OUTPUT || "").trim();
  if (!output) return;
  const resolved = path.resolve(output);
  assert(resolved.toLowerCase().endsWith(".json"), "Acceptance output must be JSON");
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
};

const addFlow = (name, checks) => flows.push({ name, checks });

const createToken = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

const request = async (
  path,
  { method = "GET", token, body, expected = [200], label = path } = {},
) => {
  const headers = {
    Accept: "application/json",
    "User-Agent": "htcoaching-staging-acceptance/1.0",
  };
  const cookies = [`csrfToken=${csrfToken}`];
  if (token) cookies.push(`accessToken=${token}`);
  headers.Cookie = cookies.join("; ");

  if (!['GET', 'HEAD'].includes(method)) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(new URL(path, STAGING_API_ORIGIN), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!expected.includes(response.status)) {
    throw new Error(
      `${label} returned ${response.status}; expected ${expected.join("/")}; code=${data?.code || "none"}`,
    );
  }
  return { status: response.status, data };
};

const dateKeyIn = (days) => {
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toISOString().slice(0, 10);
};

const findAvailableCoachingDateKey = async (userId) => {
  const offset = Number.parseInt(runSuffix.slice(0, 2), 16) % 20;
  for (let days = 20 + offset; days <= 80; days += 1) {
    const dateString = dateKeyIn(days);
    if (!(await CoachingDay.exists({ userId, dateString }))) return dateString;
  }
  throw new Error("No isolated staging coaching date is available");
};

const findAvailableScheduleDateKey = async ({ trainerId, clientIds }) => {
  const offset = Number.parseInt(runSuffix.slice(2, 4), 16) % 20;
  for (let days = 10 + offset; days <= 70; days += 1) {
    const occurrenceDateKey = dateKeyIn(days);
    const occupied = await TrainingSchedule.exists({
      occurrenceDateKey,
      status: "scheduled",
      $or: [
        { clientId: { $in: clientIds } },
        { trainerId, startTime: "09:00" },
      ],
    });
    if (!occupied) return occurrenceDateKey;
  }
  throw new Error("No isolated staging schedule date is available");
};

const loadActors = async () => {
  const adminEmails = String(process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const [admin, trainer, client, secondClient] = await Promise.all([
    User.findOne({ email: { $in: adminEmails }, role: "admin" }),
    User.findOne({ email: FIXTURE_EMAILS.trainer, role: "trainer" }),
    User.findOne({ email: FIXTURE_EMAILS.client, role: "user" }),
    User.findOne({ email: FIXTURE_EMAILS.secondClient, role: "user" }),
  ]);
  assert(admin && trainer && client && secondClient, "Staging seed actors are missing");

  const orders = await Order.find({
    userId: { $in: [client._id, secondClient._id] },
    trainerId: trainer._id,
    status: "approved",
  });
  assert(orders.length === 2, "Staging seed orders are missing");
  const orderByClient = new Map(
    orders.map((order) => [order.userId.toString(), order]),
  );

  return {
    admin,
    trainer,
    client,
    secondClient,
    firstOrder: orderByClient.get(client._id.toString()),
    secondOrder: orderByClient.get(secondClient._id.toString()),
    tokens: {
      admin: createToken(admin),
      trainer: createToken(trainer),
      client: createToken(client),
      secondClient: createToken(secondClient),
    },
  };
};

const testPermissions = async ({ tokens }) => {
  const payload = {
    title: "Forbidden staging probe",
    slug: `forbidden-staging-probe-${runSuffix}`,
  };
  const unauthenticated = await request("/api/blog/admin", {
    method: "POST",
    body: payload,
    expected: [401],
    label: "unauthenticated admin write",
  });
  const wrongRole = await request("/api/blog/admin", {
    method: "POST",
    token: tokens.client,
    body: payload,
    expected: [403],
    label: "user admin write",
  });
  addFlow("permission-boundaries", [unauthenticated.status, wrongRole.status]);
};

const testBlog = async ({ tokens }) => {
  const slug = `staging-acceptance-blog-${runSuffix}`;
  cleanup.blogSlugs.add(slug);
  const created = await request("/api/blog/admin", {
    method: "POST",
    token: tokens.admin,
    expected: [201],
    label: "blog create",
    body: {
      title: "Staging Acceptance Blog",
      slug,
      content: `<p>Staging acceptance content ${marker}</p><script>blocked()</script>`,
      excerpt: `Synthetic staging acceptance article. ${marker}`,
      category: "tap-luyen",
      tags: ["staging", "acceptance"],
      status: "published",
    },
  });
  const id = created.data?.data?._id;
  assert(id, "Blog create response is missing an id");
  cleanup.auditTargetIds.add(id);

  const detail = await request(`/api/blog/${slug}`, { label: "blog detail" });
  assert(!detail.data?.data?.content?.includes("<script"), "Blog XSS sanitization failed");
  const updated = await request(`/api/blog/admin/${id}`, {
    method: "PATCH",
    token: tokens.admin,
    label: "blog update",
    body: {
      ...detail.data.data,
      title: "Staging Acceptance Blog Updated",
      status: "published",
    },
  });
  assert(updated.data?.data?.title?.endsWith("Updated"), "Blog update was not persisted");
  const deleted = await request(`/api/blog/admin/${id}`, {
    method: "DELETE",
    token: tokens.admin,
    label: "blog delete",
  });
  cleanup.blogSlugs.delete(slug);
  addFlow("blog-crud-and-sanitization", [
    created.status,
    detail.status,
    updated.status,
    deleted.status,
  ]);
};

const testRecipe = async ({ client, tokens }) => {
  const slug = `staging-acceptance-recipe-${runSuffix}`;
  cleanup.recipeSlugs.add(slug);
  const created = await request("/api/recipes", {
    method: "POST",
    token: tokens.admin,
    expected: [201],
    label: "recipe create",
    body: {
      name: "Staging Acceptance Recipe",
      slug,
      category: "High Protein",
      area: "Viet Nam",
      ingredients: [{ name: "Synthetic ingredient", measure: "100g" }],
      instructions: [`Validate the staging workflow. ${marker}`],
      tags: ["staging", marker],
      source: "manual",
    },
  });
  const id = created.data?.data?._id;
  assert(id && created.data.data.isPublished === false, "Recipe must start as a draft");
  cleanup.recipeIds.add(id);
  cleanup.auditTargetIds.add(id);

  const published = await request(`/api/recipes/${id}`, {
    method: "PUT",
    token: tokens.admin,
    label: "recipe publish",
    body: { isPublished: true },
  });
  assert(published.data?.data?.isPublished === true, "Recipe publish failed");
  const detail = await request(`/api/recipes/detail/${slug}`, {
    label: "recipe public detail",
  });
  const saved = await request(`/api/recipes/bookmarks/${id}`, {
    method: "PUT",
    token: tokens.client,
    label: "recipe bookmark",
  });
  assert(saved.data?.saved === true, "Recipe bookmark failed");
  const removed = await request(`/api/recipes/bookmarks/${id}`, {
    method: "DELETE",
    token: tokens.client,
    label: "recipe unbookmark",
  });
  assert(removed.data?.saved === false, "Recipe unbookmark failed");
  await User.collection.updateOne(
    { _id: client._id },
    { $pull: { savedRecipes: new mongoose.Types.ObjectId(id) } },
  );
  const deleted = await request(`/api/recipes/${id}`, {
    method: "DELETE",
    token: tokens.admin,
    label: "recipe delete",
  });
  cleanup.recipeSlugs.delete(slug);
  addFlow("recipe-publish-bookmark-crud", [
    created.status,
    published.status,
    detail.status,
    saved.status,
    removed.status,
    deleted.status,
  ]);
};

const testCheckin = async ({ firstOrder, tokens }) => {
  const requestId = crypto.randomUUID();
  const baselineSessions = firstOrder.sessions;
  assert(
    Number.isSafeInteger(baselineSessions) && baselineSessions >= 2,
    "Synthetic order must keep at least one session after acceptance check-in",
  );
  cleanup.checkins.push({
    orderId: firstOrder._id,
    requestId,
    baselineSessions,
    baselineSessionsExhaustedAt: firstOrder.sessionsExhaustedAt,
    baselineUpdatedAt: firstOrder.updatedAt,
  });
  const body = {
    orderId: firstOrder._id.toString(),
    clientRequestId: requestId,
    time: new Date().toISOString(),
    muscle: "Staging full body",
    note: `Synthetic acceptance check-in ${marker}`,
  };
  const created = await request("/api/checkin", {
    method: "POST",
    token: tokens.trainer,
    body,
    label: "check-in create",
  });
  const replayed = await request("/api/checkin", {
    method: "POST",
    token: tokens.trainer,
    body,
    label: "check-in replay",
  });
  assert(replayed.data?.idempotentReplay === true, "Check-in replay was not idempotent");
  const afterCreate = await Order.findById(firstOrder._id).lean();
  assert(afterCreate.sessions === baselineSessions - 1, "Check-in did not debit one session");
  const deleted = await request(`/api/checkin/${created.data?.data?._id}`, {
    method: "DELETE",
    token: tokens.admin,
    label: "check-in delete",
  });
  const afterDelete = await Order.findById(firstOrder._id).lean();
  assert(afterDelete.sessions === baselineSessions, "Check-in delete did not restore the session");
  addFlow("checkin-idempotency-and-session-restore", [
    created.status,
    replayed.status,
    deleted.status,
  ]);
};

const testCoaching = async ({ client, tokens }) => {
  const dateString = await findAvailableCoachingDateKey(client._id);
  cleanup.coachingKeys.push({ userId: client._id, dateString });
  assert(
    !(await CoachingDay.exists({ userId: client._id, dateString })),
    "Synthetic coaching date is already occupied",
  );
  const baseBody = {
    dateString,
    title: "Staging Acceptance Training Day",
    note: `Synthetic coaching plan ${marker}`,
    videoUrl: "",
    exercises: [
      { name: "Staging Squat", sets: 3, reps: "8", weight: "Light" },
    ],
  };
  const created = await request(`/api/coaching/trainer/clients/${client._id}`, {
    method: "POST",
    token: tokens.trainer,
    body: baseBody,
    label: "coaching create",
  });
  const exercise = created.data?.data?.exercises?.[0];
  assert(exercise?._id, "Coaching response is missing its exercise");
  const updateBody = {
    ...baseBody,
    revision: 0,
    note: `Synthetic coaching plan updated ${marker}`,
    exercises: [{ ...baseBody.exercises[0], _id: exercise._id }],
  };
  const updated = await request(`/api/coaching/trainer/clients/${client._id}`, {
    method: "POST",
    token: tokens.trainer,
    body: updateBody,
    label: "coaching update",
  });
  assert(updated.data?.data?.__v === 1, "Coaching revision did not advance");
  const stale = await request(`/api/coaching/trainer/clients/${client._id}`, {
    method: "POST",
    token: tokens.trainer,
    body: updateBody,
    expected: [409],
    label: "coaching stale revision",
  });
  const feedback = await request(`/api/coaching/my-plans/${dateString}/feedback`, {
    method: "PUT",
    token: tokens.client,
    body: {
      clientFeedbackText: "Synthetic feedback",
      exercises: [
        {
          exerciseId: exercise._id,
          completed: true,
          clientFeedbackNote: "Completed in staging",
        },
      ],
    },
    label: "coaching feedback",
  });
  assert(feedback.data?.data?.clientStatus === "completed", "Coaching completion failed");
  const deleted = await request(
    `/api/coaching/trainer/clients/${client._id}/${dateString}`,
    {
      method: "DELETE",
      token: tokens.trainer,
      label: "coaching delete",
    },
  );
  addFlow("coaching-revision-feedback-crud", [
    created.status,
    updated.status,
    stale.status,
    feedback.status,
    deleted.status,
  ]);
};

const testScheduleConflict = async ({ trainer, client, secondClient, tokens }) => {
  const occurrenceDateKey = await findAvailableScheduleDateKey({
    trainerId: trainer._id,
    clientIds: [client._id, secondClient._id],
  });
  const shared = {
    occurrenceDateKey,
    startTime: "09:00",
    endTime: "10:00",
    exerciseType: "Gym",
    notes: `Synthetic conflict test ${marker}`,
    color: "#3b82f6",
  };
  const firstRequestId = crypto.randomUUID();
  const secondRequestId = crypto.randomUUID();
  cleanup.scheduleRequestIds.add(firstRequestId);
  cleanup.scheduleRequestIds.add(secondRequestId);
  const responses = await Promise.all([
    request("/api/training-schedules", {
      method: "POST",
      token: tokens.trainer,
      expected: [201, 409],
      label: "schedule first claim",
      body: { ...shared, clientId: client._id.toString(), requestId: firstRequestId },
    }),
    request("/api/training-schedules", {
      method: "POST",
      token: tokens.trainer,
      expected: [201, 409],
      label: "schedule second claim",
      body: {
        ...shared,
        clientId: secondClient._id.toString(),
        requestId: secondRequestId,
      },
    }),
  ]);
  assert(
    responses.map((response) => response.status).sort().join(",") === "201,409",
    "Concurrent schedule claims did not produce exactly one winner",
  );
  const winner = responses.find((response) => response.status === 201);
  cleanup.scheduleIds.add(winner.data?.data?._id);
  const cancelRequestId = crypto.randomUUID();
  cleanup.scheduleRequestIds.add(cancelRequestId);
  const cancelled = await request(`/api/training-schedules/${winner.data?.data?._id}`, {
    method: "DELETE",
    token: tokens.trainer,
    body: {
      revision: 0,
      requestId: cancelRequestId,
      reason: "Synthetic acceptance cleanup",
    },
    label: "schedule cancel",
  });
  const activeClaims = await TrainingSlotClaim.countDocuments({
    scheduleId: winner.data.data._id,
  });
  assert(activeClaims === 0, "Cancelled schedule retained active slot claims");
  addFlow("schedule-concurrency-and-cancellation", [
    ...responses.map((response) => response.status),
    cancelled.status,
  ]);
};

const testBooking = async ({ tokens }) => {
  const clientRequestId = crypto.randomUUID();
  cleanup.bookingRequestIds.add(clientRequestId);
  const body = {
    name: "Staging Acceptance Client",
    phone: "0900000000",
    email: "staging.acceptance.fixture@gmail.com",
    gym: "Staging Demo Gym",
    schedule: "Monday 09:00",
    note: `Synthetic staging lead ${marker}`,
    package: "1-1 - Staging",
    sessions: 10,
    gifts: [],
    clientRequestId,
  };
  const created = await request("/api/bookings", {
    method: "POST",
    body,
    expected: [201],
    label: "booking create",
  });
  const replayed = await request("/api/bookings", {
    method: "POST",
    body,
    label: "booking replay",
  });
  assert(replayed.data?.idempotentReplay === true, "Booking replay was not idempotent");
  const id = created.data?.data?._id;
  assert(id, "Booking create response is missing an id");
  cleanup.bookingIds.add(id);
  cleanup.auditTargetIds.add(id);
  const invalid = await request(`/api/bookings/${id}/status`, {
    method: "PATCH",
    token: tokens.admin,
    body: { status: "completed", revision: 0 },
    expected: [409],
    label: "booking invalid transition",
  });
  const contacted = await request(`/api/bookings/${id}/status`, {
    method: "PATCH",
    token: tokens.admin,
    body: { status: "contacted", revision: 0 },
    label: "booking contacted",
  });
  const archived = await request(`/api/bookings/${id}/archive`, {
    method: "PATCH",
    token: tokens.admin,
    body: { revision: 1 },
    label: "booking archive",
  });
  assert(archived.data?.data?.isArchived === true, "Booking was not archived");
  addFlow("booking-idempotency-transition-archive", [
    created.status,
    replayed.status,
    invalid.status,
    contacted.status,
    archived.status,
  ]);
};

const testDeposit = async ({ client, tokens }) => {
  const [before, openDeposits] = await Promise.all([
    Wallet.findOne({ userId: client._id }).lean(),
    DepositRequest.countDocuments({ userId: client._id, isOpen: true }),
  ]);
  assert(before?.balance === 0, "Synthetic wallet must begin the deposit test at zero");
  assert(openDeposits === 0, "Synthetic client must not have an open deposit");
  cleanup.walletBaselines.set(before._id.toString(), {
    _id: before._id,
    balance: before.balance,
    version: before.version,
    updatedAt: before.updatedAt,
  });
  const amount = 5000;
  cleanup.depositWindows.push({ userId: client._id, amount });
  const created = await request("/api/deposits", {
    method: "POST",
    token: tokens.client,
    body: { amount },
    expected: [201],
    label: "deposit create",
  });
  const id = created.data?.data?.depositRequestId;
  assert(id, "Deposit create response is missing an id");
  cleanup.depositIds.add(id);
  cleanup.auditTargetIds.add(id);
  const approved = await request(`/api/admin/deposits/${id}/approve`, {
    method: "POST",
    token: tokens.admin,
    label: "deposit approve",
  });
  const approveReplay = await request(`/api/admin/deposits/${id}/approve`, {
    method: "POST",
    token: tokens.admin,
    label: "deposit approve replay",
  });
  assert(approveReplay.data?.skipped === true, "Deposit approval replay was not idempotent");
  const blockedDelete = await request(`/api/admin/deposits/${id}`, {
    method: "DELETE",
    token: tokens.admin,
    expected: [409],
    label: "paid deposit delete",
  });
  const reversed = await request(`/api/admin/deposits/${id}/reverse`, {
    method: "POST",
    token: tokens.admin,
    body: { reason: "Synthetic staging acceptance reversal" },
    label: "deposit reverse",
  });
  const reverseReplay = await request(`/api/admin/deposits/${id}/reverse`, {
    method: "POST",
    token: tokens.admin,
    body: { reason: "Synthetic staging acceptance reversal" },
    label: "deposit reverse replay",
  });
  assert(reverseReplay.data?.skipped === true, "Deposit reversal replay was not idempotent");
  const [wallet, deposit, ledgerCount] = await Promise.all([
    Wallet.findOne({ userId: client._id }).lean(),
    DepositRequest.findById(id).lean(),
    WalletTransaction.countDocuments({ referenceId: id }),
  ]);
  assert(wallet?.balance === 0, "Deposit reversal did not restore wallet balance");
  assert(deposit?.status === "reversed", "Deposit did not reach reversed state");
  assert(ledgerCount === 2, "Deposit ledger must contain credit and reversal entries");
  const reconciliation = await reconcileWallets();
  assert(
    reconciliationIssueDelta(
      reconciliation.totalIssues,
      cleanup.walletReconciliationBaseline,
    ) === 0,
    "Acceptance introduced new wallet reconciliation issues",
  );
  addFlow("deposit-ledger-idempotency-and-reversal", [
    created.status,
    approved.status,
    approveReplay.status,
    blockedDelete.status,
    reversed.status,
    reverseReplay.status,
  ]);
};

const asObjectIds = (values) =>
  [...values]
    .filter((value) => mongoose.isValidObjectId(value))
    .map((value) => new mongoose.Types.ObjectId(value));

const discoverTrackedIds = async () => {
  if (cleanup.recipeSlugs.size) {
    const recipes = await Recipe.collection
      .find({ slug: { $in: [...cleanup.recipeSlugs] } })
      .project({ _id: 1 })
      .toArray();
    for (const recipe of recipes) cleanup.recipeIds.add(recipe._id.toString());
  }

  if (cleanup.bookingRequestIds.size) {
    const bookings = await Booking.collection
      .find({ clientRequestId: { $in: [...cleanup.bookingRequestIds] } })
      .project({ _id: 1 })
      .toArray();
    for (const booking of bookings) {
      cleanup.bookingIds.add(booking._id.toString());
      cleanup.auditTargetIds.add(booking._id.toString());
    }
  }

  if (cleanup.depositWindows.length) {
    const deposits = await DepositRequest.collection
      .find({
        $or: cleanup.depositWindows.map(({ userId, amount }) => ({
          userId,
          amount,
          createdAt: { $gte: runStartedAt },
        })),
      })
      .project({ _id: 1 })
      .toArray();
    for (const deposit of deposits) {
      cleanup.depositIds.add(deposit._id.toString());
      cleanup.auditTargetIds.add(deposit._id.toString());
    }
  }

  if (cleanup.scheduleRequestIds.size) {
    const requestIds = [...cleanup.scheduleRequestIds];
    const [schedules, commands] = await Promise.all([
      TrainingSchedule.collection
        .find({ requestId: { $in: requestIds } })
        .project({ _id: 1 })
        .toArray(),
      TrainingScheduleCommand.collection
        .find({ requestId: { $in: requestIds } })
        .project({ scheduleId: 1 })
        .toArray(),
    ]);
    for (const item of [...schedules, ...commands]) {
      const id = item._id || item.scheduleId;
      if (id) cleanup.scheduleIds.add(id.toString());
    }
  }
};

const cleanupRun = async () => {
  await discoverTrackedIds();
  for (const {
    orderId,
    requestId,
    baselineSessions,
    baselineSessionsExhaustedAt,
    baselineUpdatedAt,
  } of cleanup.checkins) {
    await Checkin.collection.deleteMany({ orderId, clientRequestId: requestId });
    await Order.collection.updateOne(
      { _id: orderId },
      {
        $set: {
          sessions: baselineSessions,
          sessionsExhaustedAt: baselineSessionsExhaustedAt || null,
          updatedAt: baselineUpdatedAt,
        },
      },
    );
  }
  for (const { userId, dateString } of cleanup.coachingKeys) {
    await CoachingDay.collection.deleteMany({ userId, dateString });
  }
  if (cleanup.blogSlugs.size) {
    await BlogPost.collection.deleteMany({ slug: { $in: [...cleanup.blogSlugs] } });
  }

  const recipeIds = asObjectIds(cleanup.recipeIds);
  if (recipeIds.length) {
    await User.collection.updateMany(
      { savedRecipes: { $in: recipeIds } },
      { $pull: { savedRecipes: { $in: recipeIds } } },
    );
    await Recipe.collection.deleteMany({ _id: { $in: recipeIds } });
  }

  const scheduleIds = asObjectIds(cleanup.scheduleIds);
  if (scheduleIds.length || cleanup.scheduleRequestIds.size) {
    const requestIds = [...cleanup.scheduleRequestIds];
    if (scheduleIds.length) {
      await TrainingSlotClaim.collection.deleteMany({ scheduleId: { $in: scheduleIds } });
    }
    await TrainingScheduleCommand.collection.deleteMany({
      $or: [
        { requestId: { $in: requestIds } },
        ...(scheduleIds.length ? [{ scheduleId: { $in: scheduleIds } }] : []),
      ],
    });
    await TrainingSchedule.collection.deleteMany({
      $or: [
        { requestId: { $in: requestIds } },
        ...(scheduleIds.length ? [{ _id: { $in: scheduleIds } }] : []),
      ],
    });
  }

  const bookingIds = asObjectIds(cleanup.bookingIds);
  if (cleanup.bookingRequestIds.size) {
    await Booking.collection.deleteMany({
      clientRequestId: { $in: [...cleanup.bookingRequestIds] },
    });
  }

  const depositIds = asObjectIds(cleanup.depositIds);
  if (depositIds.length) {
    await WalletTransaction.collection.deleteMany({ referenceId: { $in: depositIds } });
    await DepositRequest.collection.deleteMany({ _id: { $in: depositIds } });
  }
  for (const baseline of cleanup.walletBaselines.values()) {
    await Wallet.collection.updateOne(
      { _id: baseline._id },
      {
        $set: {
          balance: baseline.balance,
          version: baseline.version,
          updatedAt: baseline.updatedAt,
        },
      },
    );
  }

  const auditTargetIds = asObjectIds(
    new Set([
      ...cleanup.auditTargetIds,
      ...bookingIds,
      ...depositIds,
      ...scheduleIds,
    ]),
  );
  if (auditTargetIds.length) {
    await AuditLog.collection.deleteMany({ targetId: { $in: auditTargetIds } });
  }
};

const verifyCleanup = async () => {
  await discoverTrackedIds();
  const recipeIds = asObjectIds(cleanup.recipeIds);
  const scheduleIds = asObjectIds(cleanup.scheduleIds);
  const bookingIds = asObjectIds(cleanup.bookingIds);
  const depositIds = asObjectIds(cleanup.depositIds);
  const auditTargetIds = asObjectIds(
    new Set([
      ...cleanup.auditTargetIds,
      ...bookingIds,
      ...depositIds,
      ...scheduleIds,
    ]),
  );
  const counts = {
    blogs: cleanup.blogSlugs.size
      ? await BlogPost.collection.countDocuments({ slug: { $in: [...cleanup.blogSlugs] } })
      : 0,
    recipes: recipeIds.length
      ? await Recipe.collection.countDocuments({ _id: { $in: recipeIds } })
      : 0,
    recipeBookmarks: recipeIds.length
      ? await User.collection.countDocuments({ savedRecipes: { $in: recipeIds } })
      : 0,
    checkins: cleanup.checkins.length
      ? await Checkin.collection.countDocuments({
          $or: cleanup.checkins.map(({ orderId, requestId }) => ({
            orderId,
            clientRequestId: requestId,
          })),
        })
      : 0,
    coachingDays: cleanup.coachingKeys.length
      ? await CoachingDay.collection.countDocuments({
          $or: cleanup.coachingKeys.map(({ userId, dateString }) => ({
            userId,
            dateString,
          })),
        })
      : 0,
    schedules: scheduleIds.length
      ? await TrainingSchedule.collection.countDocuments({ _id: { $in: scheduleIds } })
      : 0,
    scheduleCommands: cleanup.scheduleRequestIds.size
      ? await TrainingScheduleCommand.collection.countDocuments({
          requestId: { $in: [...cleanup.scheduleRequestIds] },
        })
      : 0,
    slotClaims: scheduleIds.length
      ? await TrainingSlotClaim.collection.countDocuments({ scheduleId: { $in: scheduleIds } })
      : 0,
    bookings: bookingIds.length
      ? await Booking.collection.countDocuments({ _id: { $in: bookingIds } })
      : 0,
    deposits: depositIds.length
      ? await DepositRequest.collection.countDocuments({ _id: { $in: depositIds } })
      : 0,
    walletTransactions: depositIds.length
      ? await WalletTransaction.collection.countDocuments({ referenceId: { $in: depositIds } })
      : 0,
    auditLogs: auditTargetIds.length
      ? await AuditLog.collection.countDocuments({ targetId: { $in: auditTargetIds } })
      : 0,
    fixtureStateMismatches: 0,
  };

  for (const item of cleanup.checkins) {
    const order = await Order.findById(item.orderId)
      .select("sessions sessionsExhaustedAt updatedAt")
      .lean();
    if (
      !order ||
      order.sessions !== item.baselineSessions ||
      String(order.sessionsExhaustedAt || "") !==
        String(item.baselineSessionsExhaustedAt || "")
    ) {
      counts.fixtureStateMismatches += 1;
    }
  }
  for (const baseline of cleanup.walletBaselines.values()) {
    const wallet = await Wallet.findById(baseline._id)
      .select("balance version")
      .lean();
    if (
      !wallet ||
      wallet.balance !== baseline.balance ||
      wallet.version !== baseline.version
    ) {
      counts.fixtureStateMismatches += 1;
    }
  }
  const reconciliation = await reconcileWallets();
  counts.walletReconciliationIssueDelta = reconciliationIssueDelta(
    reconciliation.totalIssues,
    cleanup.walletReconciliationBaseline,
  );

  return {
    residue: Object.values(counts).reduce((total, count) => total + count, 0),
    collections: counts,
  };
};

const executeFlows = async () => {
  const actors = await loadActors();
  await testPermissions(actors);
  await testBlog(actors);
  await testRecipe(actors);
  await testCheckin(actors);
  await testCoaching(actors);
  await testScheduleConflict(actors);
  await testBooking(actors);
  await testDeposit(actors);
  return { passed: flows.length, flows };
};

const main = async () => {
  assertStagingOperation({ confirmationVariable: "CONFIRM_STAGING_ACCEPTANCE" });
  const apiOrigin = new URL(process.env.PUBLIC_API_ORIGIN || "").origin;
  assert(apiOrigin === STAGING_API_ORIGIN, "Acceptance target is not the approved staging API");

  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  assert(
    mongoose.connection.db?.databaseName === "htcoaching_staging",
    "Acceptance connection is not using the staging database",
  );
  cleanup.walletReconciliationBaseline = (
    await reconcileWallets()
  ).totalIssues;

  const result = await runWithVerifiedCleanup({
    execute: executeFlows,
    cleanup: cleanupRun,
    verify: verifyCleanup,
  });
  return {
    success: true,
    operation: "staging-acceptance",
    runId,
    marker,
    database: mongoose.connection.db.databaseName,
    startedAt: runStartedAt.toISOString(),
    completedAt: new Date().toISOString(),
    preexistingFindings: {
      walletReconciliationIssues: cleanup.walletReconciliationBaseline,
    },
    ...result.value,
    cleanup: result.cleanup,
  };
};

try {
  const evidence = await main();
  await writeEvidence(evidence);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} catch (error) {
  const evidence = {
    success: false,
    operation: "staging-acceptance",
    runId,
    database: mongoose.connection.db?.databaseName || "not-connected",
    startedAt: runStartedAt.toISOString(),
    completedAt: new Date().toISOString(),
    cleanup: error.cleanup || null,
    error: {
      code: error.code || "STAGING_ACCEPTANCE_FAILED",
      message: error.message,
    },
  };
  await writeEvidence(evidence);
  process.stderr.write(
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  throw error;
} finally {
  await mongoose.disconnect();
}
