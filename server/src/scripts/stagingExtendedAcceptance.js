import "../config/env.js";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import sharp from "sharp";

import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import AuditLog from "../models/AuditLog.js";
import Contract from "../models/Contract.js";
import F1AiReport from "../models/F1AiReport.js";
import F1Assessment from "../models/F1Assessment.js";
import F1Customer from "../models/F1Customer.js";
import F1DataDeletionJob from "../models/F1DataDeletionJob.js";
import F1Intake from "../models/F1Intake.js";
import F1Media from "../models/F1Media.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import {
  processF1DataDeletionBatch,
  requestF1CustomerDeletion,
} from "../services/f1PrivacyLifecycle.service.js";

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
  knowledgeId: null,
  contractId: null,
  f1CustomerId: null,
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const createToken = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

const authHeaders = (token, mutation = false) => {
  const cookies = [`csrfToken=${csrfToken}`];
  if (token) cookies.push(`accessToken=${token}`);
  return {
    Accept: "application/json",
    "User-Agent": "htcoaching-staging-extended-acceptance/1.0",
    Cookie: cookies.join("; "),
    ...(mutation && { "X-CSRF-Token": csrfToken }),
  };
};

const request = async (
  path,
  {
    method = "GET",
    token,
    body,
    form,
    expected = [200],
    label = path,
    redirect = "follow",
  } = {},
) => {
  const mutation = !["GET", "HEAD"].includes(method);
  const headers = authHeaders(token, mutation);
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(new URL(path, STAGING_API_ORIGIN), {
    method,
    headers,
    body: form || (body === undefined ? undefined : JSON.stringify(body)),
    redirect,
    signal: AbortSignal.timeout(120_000),
  });
  const responseText = await response.text();
  let data = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = null;
  }

  if (!expected.includes(response.status)) {
    throw new Error(
      `${label} returned ${response.status}; expected ${expected.join("/")}; code=${data?.code || "none"}`,
    );
  }
  return { status: response.status, data, headers: response.headers };
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

  const order = await Order.findOne({
    userId: client._id,
    trainerId: trainer._id,
    status: "approved",
  });
  assert(order, "Staging approved order is missing");

  return {
    admin,
    trainer,
    client,
    secondClient,
    order,
    tokens: {
      admin: createToken(admin),
      trainer: createToken(trainer),
      client: createToken(client),
      secondClient: createToken(secondClient),
    },
  };
};

const testKnowledgeBase = async ({ tokens }) => {
  const question = `How does the isolated staging knowledge check work ${runSuffix}?`;
  const created = await request("/api/knowledge-base", {
    method: "POST",
    token: tokens.admin,
    expected: [201],
    label: "knowledge entry create",
    body: {
      question,
      answer: "It verifies embedding, publication, semantic search, variants, and cleanup only in staging.",
      category: "platform",
      tags: ["staging", "acceptance"],
      status: "published",
      skipDuplicateCheck: true,
    },
  });
  cleanup.knowledgeId = created.data?.data?._id;
  assert(cleanup.knowledgeId, "Knowledge entry create response is missing an id");
  assert(
    created.data?.data?.embeddingStatus === "ready" &&
      created.data?.data?.status === "published",
    "Knowledge entry embedding was not ready for publication",
  );

  const search = await request(
    `/api/knowledge-base/search?q=${encodeURIComponent(question)}&limit=5&threshold=0.1`,
    { token: tokens.admin, label: "knowledge semantic search" },
  );
  assert(
    search.data?.data?.some(
      (entry) => String(entry._id) === String(cleanup.knowledgeId),
    ),
    "Knowledge semantic search did not return the created entry",
  );

  const merged = await request(`/api/knowledge-base/${cleanup.knowledgeId}/merge`, {
    method: "POST",
    token: tokens.admin,
    label: "knowledge variant merge",
    body: { question: `Alternative staging knowledge question ${runSuffix}?` },
  });
  assert(merged.data?.variantCount === 1, "Knowledge variant count was not updated");

  const variants = await request(
    `/api/knowledge-base/${cleanup.knowledgeId}/variants`,
    { token: tokens.admin, label: "knowledge variants read" },
  );
  assert(
    variants.data?.data?.variants?.length === 1 &&
      variants.data.data.variants[0].hasEmbedding === true,
    "Knowledge variant embedding is missing",
  );

  const deleted = await request(`/api/knowledge-base/${cleanup.knowledgeId}`, {
    method: "DELETE",
    token: tokens.admin,
    label: "knowledge entry delete",
  });
  cleanup.knowledgeId = null;
  flows.push({
    name: "knowledge-embedding-search-variant-cleanup",
    checks: [
      created.status,
      search.status,
      merged.status,
      variants.status,
      deleted.status,
    ],
  });
};

const testContract = async ({ order, tokens }) => {
  const existing = await Contract.findOne({ orderId: order._id, isActive: true });
  assert(!existing, "Synthetic staging order already has an active contract");

  const created = await request("/api/contracts", {
    method: "POST",
    token: tokens.admin,
    expected: [201],
    label: "contract draft create",
    body: { orderId: order._id.toString() },
  });
  cleanup.contractId = created.data?.data?._id;
  assert(
    cleanup.contractId && created.data?.data?.status === "draft",
    "Contract was not created as a draft",
  );

  const ownerRead = await request(`/api/contracts/${cleanup.contractId}`, {
    token: tokens.client,
    label: "contract owner read",
  });
  const deniedRead = await request(`/api/contracts/${cleanup.contractId}`, {
    token: tokens.secondClient,
    expected: [403],
    label: "contract cross-client read",
  });
  const deleted = await request(`/api/contracts/${cleanup.contractId}`, {
    method: "DELETE",
    token: tokens.admin,
    label: "contract draft delete",
  });
  cleanup.contractId = null;
  flows.push({
    name: "contract-draft-owner-idor-cleanup",
    checks: [created.status, ownerRead.status, deniedRead.status, deleted.status],
  });
};

const buildIntakePayload = () => ({
  customerInfo: {
    fullName: "Staging F1 Client",
    age: 30,
    gender: "male",
    occupation: "Tester",
    phone: "0900000001",
    email: "staging.f1.fixture@gmail.com",
  },
  healthScreening: {
    hasPainNow: false,
    painLocation: [],
    painLevel: 0,
    injuries: "",
    currentConditions: "",
    surgeries: "",
    medications: "",
    doctorRestrictions: "",
    warningSigns: [],
  },
  lifestyleNutrition: {
    mealsPerDay: 3,
    usuallyEatOut: false,
    foodAllergies: "",
    drinkEnoughWater: true,
    sleepHours: 8,
    stressLevel: "low",
    workActivityLevel: "active",
  },
  bodyMetrics: {
    heightCm: 170,
    weightKg: 70,
    bodyFatPercent: 18,
    waistCm: 80,
    hipCm: 95,
    restingHeartRate: 65,
  },
  trainingProfileGoal: {
    currentlyTraining: true,
    trainingDaysPerWeek: 3,
    sessionDurationMinutes: 60,
    sportsHistory: ["gym"],
    trainingExperience: "intermediate",
    breakDuration: "",
    primaryGoal: "muscle_gain",
    targetWeightKg: 72,
  },
  consent: {
    allowDataStorage: true,
    allowMediaStorage: true,
    allowAiAnalysis: true,
  },
});

const createSyntheticImage = (background) =>
  sharp({
    create: {
      width: 64,
      height: 96,
      channels: 3,
      background,
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();

const uploadF1Media = async ({ customerId, intakeId, type, token, buffer }) => {
  const form = new FormData();
  form.append("type", type);
  form.append("intakeId", intakeId);
  form.append("file", new Blob([buffer], { type: "image/jpeg" }), `${type}.jpg`);
  return request(`/api/f1-customers/${customerId}/media`, {
    method: "POST",
    token,
    form,
    expected: [201],
    label: `F1 ${type} upload`,
  });
};

const processF1Deletion = async (customerId) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const job = await F1DataDeletionJob.findOne({ customerId }).lean();
    if (job?.status === "completed") return job;
    await processF1DataDeletionBatch({
      batchSize: 10,
      now: new Date(Date.now() + 120_000),
    });
  }
  return F1DataDeletionJob.findOne({ customerId }).lean();
};

const testF1Lifecycle = async ({ trainer, tokens }) => {
  const created = await request("/api/f1-customers", {
    method: "POST",
    token: tokens.trainer,
    expected: [201],
    label: "F1 customer create",
    body: {
      fullName: "Staging F1 Client",
      age: 30,
      gender: "male",
      occupation: "Tester",
      phone: "0900000001",
      email: "staging.f1.fixture@gmail.com",
      source: "manual",
    },
  });
  cleanup.f1CustomerId = created.data?.data?._id;
  assert(cleanup.f1CustomerId, "F1 customer create response is missing an id");

  const deniedCustomerRead = await request(
    `/api/f1-customers/${cleanup.f1CustomerId}`,
    {
      token: tokens.secondClient,
      expected: [403],
      label: "F1 unauthorized role read",
    },
  );

  const intake = await request(
    `/api/f1-customers/${cleanup.f1CustomerId}/intake/submit`,
    {
      method: "POST",
      token: tokens.trainer,
      label: "F1 intake submit",
      body: buildIntakePayload(),
    },
  );
  const intakeId = intake.data?.data?._id;
  assert(
    intakeId && intake.data?.data?.isDraft === false,
    "F1 intake was not submitted",
  );

  const [frontBuffer, sideBuffer] = await Promise.all([
    createSyntheticImage({ r: 18, g: 130, b: 85 }),
    createSyntheticImage({ r: 235, g: 180, b: 45 }),
  ]);
  const front = await uploadF1Media({
    customerId: cleanup.f1CustomerId,
    intakeId,
    type: "posture_front",
    token: tokens.trainer,
    buffer: frontBuffer,
  });
  const side = await uploadF1Media({
    customerId: cleanup.f1CustomerId,
    intakeId,
    type: "posture_side",
    token: tokens.trainer,
    buffer: sideBuffer,
  });
  const mediaResponses = [front.data?.data, side.data?.data];
  assert(
    mediaResponses.every(
      (media) =>
        media?._id &&
        media.status === "ready" &&
        media.contentPath &&
        media.storageKey === undefined &&
        media.publicId === undefined &&
        media.url === undefined,
    ),
    "F1 media response exposed storage details or was not ready",
  );

  const mediaList = await request(
    `/api/f1-customers/${cleanup.f1CustomerId}/media`,
    { token: tokens.trainer, label: "F1 private media list" },
  );
  assert(
    mediaList.data?.data?.length === 2 &&
      mediaList.data.data.every(
        (media) =>
          media.storageKey === undefined &&
          media.publicId === undefined &&
          media.url === undefined,
      ),
    "F1 media list did not preserve storage privacy",
  );

  const mediaRead = await request(front.data.data.contentPath, {
    token: tokens.trainer,
    expected: [302],
    label: "F1 authorized private media read",
    redirect: "manual",
  });
  assert(
    mediaRead.headers.get("location")?.startsWith("https://"),
    "F1 private media read did not return a signed HTTPS redirect",
  );

  const assessment = await request(
    `/api/f1-customers/${cleanup.f1CustomerId}/assessments`,
    {
      method: "POST",
      token: tokens.trainer,
      expected: [201],
      label: "F1 assessment create",
      body: { assessorNotes: "Synthetic staging acceptance assessment." },
    },
  );
  assert(assessment.data?.data?._id, "F1 assessment response is missing an id");

  const reportRequestId = crypto.randomUUID();
  const report = await request(
    `/api/f1-customers/${cleanup.f1CustomerId}/ai-reports/generate`,
    {
      method: "POST",
      token: tokens.trainer,
      expected: [201],
      label: "F1 report generate",
      body: { requestId: reportRequestId },
    },
  );
  const reportId = report.data?.data?._id;
  assert(reportId, "F1 report response is missing an id");
  const reportReplay = await request(
    `/api/f1-customers/${cleanup.f1CustomerId}/ai-reports/generate`,
    {
      method: "POST",
      token: tokens.trainer,
      label: "F1 report replay",
      body: { requestId: reportRequestId },
    },
  );
  assert(reportReplay.data?.idempotentReplay === true, "F1 report replay was not idempotent");
  const approved = await request(
    `/api/f1-customers/${cleanup.f1CustomerId}/ai-reports/${reportId}/approve`,
    {
      method: "PATCH",
      token: tokens.trainer,
      label: "F1 report approve",
      body: {
        approvedByCoach: true,
        coachNote: "Synthetic staging acceptance approval.",
      },
    },
  );
  assert(approved.data?.data?.approvedByCoach === true, "F1 report approval failed");

  const deletion = await request(`/api/f1-customers/${cleanup.f1CustomerId}`, {
    method: "DELETE",
    token: tokens.trainer,
    expected: [202],
    label: "F1 privacy deletion request",
    body: { reason: "admin_request" },
  });
  const deletionJob = await processF1Deletion(cleanup.f1CustomerId);
  const [pseudonymized, dependentCounts] = await Promise.all([
    F1Customer.findById(cleanup.f1CustomerId).lean(),
    Promise.all([
      F1Intake.countDocuments({ customerId: cleanup.f1CustomerId }),
      F1Media.countDocuments({ customerId: cleanup.f1CustomerId }),
      F1Assessment.countDocuments({ customerId: cleanup.f1CustomerId }),
      F1AiReport.countDocuments({ customerId: cleanup.f1CustomerId }),
    ]),
  ]);
  assert(
    deletionJob?.status === "completed" &&
      pseudonymized?.deletedAt &&
      pseudonymized.fullName === "Deleted F1 Customer" &&
      dependentCounts.every((count) => count === 0),
    "F1 privacy deletion did not complete cleanly",
  );

  await Promise.all([
    AuditLog.deleteMany({ targetId: cleanup.f1CustomerId }),
    F1DataDeletionJob.deleteOne({ customerId: cleanup.f1CustomerId }),
    F1Customer.deleteOne({ _id: cleanup.f1CustomerId }),
  ]);
  cleanup.f1CustomerId = null;
  flows.push({
    name: "f1-private-lifecycle-idempotency-deletion",
    checks: [
      created.status,
      deniedCustomerRead.status,
      intake.status,
      front.status,
      side.status,
      mediaList.status,
      mediaRead.status,
      assessment.status,
      report.status,
      reportReplay.status,
      approved.status,
      deletion.status,
    ],
    privateMedia: true,
    privacyDeletion: deletionJob.status,
  });
  assert(trainer._id, "Synthetic trainer reference was unexpectedly missing");
};

const cleanupFailedRun = async (actors) => {
  if (cleanup.knowledgeId) {
    await KnowledgeEntry.deleteOne({ _id: cleanup.knowledgeId });
  }
  if (cleanup.contractId) {
    await Contract.deleteOne({ _id: cleanup.contractId, status: "draft" });
  }
  if (!cleanup.f1CustomerId) return;

  const customer = await F1Customer.findById(cleanup.f1CustomerId);
  if (customer && !customer.deletionRequestedAt) {
    await requestF1CustomerDeletion({
      customer,
      actorId: actors?.trainer?._id || customer.createdBy,
      actorRole: "trainer",
      reason: "admin_request",
      requestContext: { requestId: `staging-cleanup-${runSuffix}` },
    });
  }
  await processF1Deletion(cleanup.f1CustomerId);
};

const main = async () => {
  assertStagingOperation({
    confirmationVariable: "CONFIRM_STAGING_EXTENDED_ACCEPTANCE",
  });
  assert(
    new URL(process.env.PUBLIC_API_ORIGIN || "").origin === STAGING_API_ORIGIN,
    "Extended acceptance target is not the approved staging API",
  );
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  assert(
    mongoose.connection.db?.databaseName === "htcoaching_staging",
    "Extended acceptance connection is not using the staging database",
  );

  const actors = await loadActors();
  try {
    await testKnowledgeBase(actors);
    await testContract(actors);
    await testF1Lifecycle(actors);
  } catch (error) {
    await cleanupFailedRun(actors);
    throw error;
  }

  console.log(
    JSON.stringify(
      {
        operation: "staging-extended-acceptance",
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
} finally {
  await mongoose.disconnect();
}
