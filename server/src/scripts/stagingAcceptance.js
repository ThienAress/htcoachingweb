import "../config/env.js";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { assertStagingOperation } from "../config/stagingOperationSafety.js";
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

const STAGING_API_ORIGIN = "https://htcoachingweb-staging.onrender.com";
const FIXTURE_EMAILS = {
  trainer: "staging.trainer@example.invalid",
  client: "staging.client@example.invalid",
  secondClient: "staging.client.two@example.invalid",
};

const csrfToken = crypto.randomBytes(32).toString("hex");
const runSuffix = crypto.randomBytes(5).toString("hex");
const flows = [];
const cleanup = {
  blogSlugs: new Set(),
  recipeSlugs: new Set(),
  coachingKeys: [],
  checkins: [],
  scheduleRequestIds: new Set(),
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
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
      content: "<p>Staging acceptance content</p><script>blocked()</script>",
      excerpt: "Synthetic staging acceptance article.",
      category: "tap-luyen",
      tags: ["staging", "acceptance"],
      status: "published",
    },
  });
  const id = created.data?.data?._id;
  assert(id, "Blog create response is missing an id");

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
      instructions: ["Validate the staging workflow."],
      tags: ["staging"],
      source: "manual",
    },
  });
  const id = created.data?.data?._id;
  assert(id && created.data.data.isPublished === false, "Recipe must start as a draft");

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
  cleanup.checkins.push({ orderId: firstOrder._id, requestId, baselineSessions });
  const body = {
    orderId: firstOrder._id.toString(),
    clientRequestId: requestId,
    time: new Date().toISOString(),
    muscle: "Staging full body",
    note: "Synthetic acceptance check-in",
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
  cleanup.checkins = cleanup.checkins.filter((item) => item.requestId !== requestId);
  addFlow("checkin-idempotency-and-session-restore", [
    created.status,
    replayed.status,
    deleted.status,
  ]);
};

const testCoaching = async ({ client, tokens }) => {
  const dateString = dateKeyIn(20);
  cleanup.coachingKeys.push({ userId: client._id, dateString });
  await CoachingDay.deleteOne({ userId: client._id, dateString });
  const baseBody = {
    dateString,
    title: "Staging Acceptance Training Day",
    note: "Synthetic coaching plan",
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
    note: "Synthetic coaching plan updated",
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
  cleanup.coachingKeys = cleanup.coachingKeys.filter(
    (item) => item.dateString !== dateString,
  );
  addFlow("coaching-revision-feedback-crud", [
    created.status,
    updated.status,
    stale.status,
    feedback.status,
    deleted.status,
  ]);
};

const testScheduleConflict = async ({ client, secondClient, tokens }) => {
  const occurrenceDateKey = dateKeyIn(10);
  const shared = {
    occurrenceDateKey,
    startTime: "09:00",
    endTime: "10:00",
    exerciseType: "Gym",
    notes: "Synthetic conflict test",
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
  const body = {
    name: "Staging Acceptance Client",
    phone: "0900000000",
    email: "staging.acceptance.fixture@gmail.com",
    gym: "Staging Demo Gym",
    schedule: "Monday 09:00",
    note: "Synthetic staging lead",
    package: "1-1 - Staging",
    sessions: 10,
    gifts: [],
    clientRequestId: crypto.randomUUID(),
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
  const before = await Wallet.findOne({ userId: client._id }).lean();
  assert(before?.balance === 0, "Synthetic wallet must begin the deposit test at zero");
  const created = await request("/api/deposits", {
    method: "POST",
    token: tokens.client,
    body: { amount: 5000 },
    expected: [201],
    label: "deposit create",
  });
  const id = created.data?.data?.depositRequestId;
  assert(id, "Deposit create response is missing an id");
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
  assert(reconciliation.totalIssues === 0, "Wallet reconciliation found staging issues");
  addFlow("deposit-ledger-idempotency-and-reversal", [
    created.status,
    approved.status,
    approveReplay.status,
    blockedDelete.status,
    reversed.status,
    reverseReplay.status,
  ]);
};

const cleanupFailedRun = async () => {
  for (const { orderId, requestId, baselineSessions } of cleanup.checkins) {
    await Checkin.collection.deleteMany({ orderId, clientRequestId: requestId });
    await Order.collection.updateOne(
      { _id: orderId },
      { $set: { sessions: baselineSessions } },
    );
  }
  for (const { userId, dateString } of cleanup.coachingKeys) {
    await CoachingDay.collection.deleteMany({ userId, dateString });
  }
  if (cleanup.blogSlugs.size) {
    await BlogPost.collection.deleteMany({ slug: { $in: [...cleanup.blogSlugs] } });
  }
  if (cleanup.recipeSlugs.size) {
    const recipes = await Recipe.collection
      .find({ slug: { $in: [...cleanup.recipeSlugs] } })
      .project({ _id: 1 })
      .toArray();
    const ids = recipes.map((recipe) => recipe._id);
    await Recipe.collection.deleteMany({ _id: { $in: ids } });
    if (ids.length) {
      await User.collection.updateMany({}, { $pull: { savedRecipes: { $in: ids } } });
    }
  }
  if (cleanup.scheduleRequestIds.size) {
    const requestIds = [...cleanup.scheduleRequestIds];
    const schedules = await TrainingSchedule.collection
      .find({ requestId: { $in: requestIds } })
      .project({ _id: 1 })
      .toArray();
    const scheduleIds = schedules.map((schedule) => schedule._id);
    await TrainingSlotClaim.collection.deleteMany({ scheduleId: { $in: scheduleIds } });
    await TrainingScheduleCommand.collection.deleteMany({
      $or: [
        { requestId: { $in: requestIds } },
        { scheduleId: { $in: scheduleIds } },
      ],
    });
    await TrainingSchedule.collection.deleteMany({ _id: { $in: scheduleIds } });
  }
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

  const actors = await loadActors();
  await testPermissions(actors);
  await testBlog(actors);
  await testRecipe(actors);
  await testCheckin(actors);
  await testCoaching(actors);
  await testScheduleConflict(actors);
  await testBooking(actors);
  await testDeposit(actors);

  console.log(
    JSON.stringify(
      {
        operation: "staging-acceptance",
        database: mongoose.connection.db.databaseName,
        passed: flows.length,
        flows,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} catch (error) {
  if (mongoose.connection.readyState === 1) await cleanupFailedRun();
  throw error;
} finally {
  await mongoose.disconnect();
}
