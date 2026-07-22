import "../config/env.js";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { assertStagingOperation } from "../config/stagingOperationSafety.js";
import ChatConversation from "../models/ChatConversation.js";
import User from "../models/User.js";
import {
  destroyCloudinaryAsset,
  uploadBufferToCloudinary,
} from "../utils/cloudinaryUpload.js";

const STAGING_API_ORIGIN = "https://htcoachingweb-staging.onrender.com";
const STAGING_CLIENT_ORIGIN = "https://staging--htcoachingweb.netlify.app";
const SYNTHETIC_CLIENT_EMAIL = "staging.client@example.invalid";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=",
  "base64",
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const csrfToken = crypto.randomBytes(32).toString("hex");
let conversationId = null;
let uploadedPublicId = null;

const authHeaders = (token, includeJson = false) => {
  const headers = {
    Accept: "application/json",
    Cookie: `csrfToken=${csrfToken}; accessToken=${token}`,
    "User-Agent": "htcoaching-staging-integrations/1.0",
    "X-CSRF-Token": csrfToken,
  };
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
};

const testGoogleOAuth = async () => {
  const startedAt = Date.now();
  const url = new URL("/api/auth/google", STAGING_API_ORIGIN);
  url.searchParams.set("client_url", STAGING_CLIENT_ORIGIN);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
    headers: { "User-Agent": "htcoaching-staging-integrations/1.0" },
  });
  assert([301, 302, 303, 307, 308].includes(response.status), "OAuth did not redirect");
  const location = new URL(response.headers.get("location"));
  assert(
    location.hostname === "accounts.google.com",
    "OAuth redirect did not target Google",
  );
  assert(location.searchParams.get("client_id"), "OAuth redirect is missing client_id");
  assert(location.searchParams.get("state"), "OAuth redirect is missing signed state");
  assert(
    location.searchParams.get("redirect_uri") ===
      `${STAGING_API_ORIGIN}/api/auth/google/callback`,
    "OAuth redirect_uri is not isolated to staging",
  );
  return { status: response.status, durationMs: Date.now() - startedAt };
};

const testAi = async (user, token) => {
  const startedAt = Date.now();
  const response = await fetch(new URL("/api/ai/chat", STAGING_API_ORIGIN), {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify({
      message: "Staging integration health check. Reply only with STAGING_AI_OK.",
      requestId: crypto.randomUUID(),
      context: { pageType: "general", page: "/staging-integration-check" },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  assert(response.status === 200, `AI integration returned ${response.status}`);
  assert(
    response.headers.get("content-type")?.includes("text/event-stream"),
    "AI integration did not return an SSE stream",
  );

  const stream = await response.text();
  const events = stream
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return { type: "invalid" };
      }
    });
  const conversationEvent = events.find((event) => event.type === "conversation");
  const textLength = events
    .filter((event) => event.type === "text")
    .reduce((total, event) => total + String(event.content || "").length, 0);
  assert(conversationEvent?.conversationId, "AI stream omitted the conversation event");
  conversationId = conversationEvent.conversationId;
  assert(textLength > 0, "AI stream returned no assistant text");
  assert(events.some((event) => event.type === "done"), "AI stream omitted done");
  assert(!events.some((event) => event.type === "error"), "AI stream emitted an error");

  const persisted = await ChatConversation.findOne({
    _id: conversationId,
    userId: user._id,
  }).lean();
  assert(
    persisted?.messages?.some(
      (message) => message.role === "assistant" && message.content,
    ),
    "AI response was not persisted",
  );

  const deleted = await fetch(
    new URL(`/api/ai/conversations/${conversationId}`, STAGING_API_ORIGIN),
    {
      method: "DELETE",
      headers: authHeaders(token),
      signal: AbortSignal.timeout(60_000),
    },
  );
  assert(deleted.status === 200, `AI cleanup returned ${deleted.status}`);
  conversationId = null;
  return {
    status: response.status,
    eventTypes: [...new Set(events.map((event) => event.type))],
    textLength,
    durationMs: Date.now() - startedAt,
    cleanedUp: true,
  };
};

const testCloudinary = async () => {
  const startedAt = Date.now();
  const result = await uploadBufferToCloudinary(PNG_1X1, {
    folder: "htcoaching/integration-tests",
    public_id: `staging-acceptance-${crypto.randomBytes(5).toString("hex")}`,
    resource_type: "image",
    allowed_formats: ["png"],
  });
  uploadedPublicId = result.public_id;
  assert(result.url?.startsWith("https://"), "Cloudinary did not return an HTTPS URL");
  assert(
    uploadedPublicId.startsWith("htcoaching/staging/integration-tests/"),
    "Cloudinary asset was not isolated under the staging prefix",
  );
  await destroyCloudinaryAsset(uploadedPublicId);
  uploadedPublicId = null;
  return {
    uploaded: true,
    stagingPrefix: true,
    cleanedUp: true,
    durationMs: Date.now() - startedAt,
  };
};

const main = async () => {
  assertStagingOperation({ confirmationVariable: "CONFIRM_STAGING_INTEGRATIONS" });
  assert(
    new URL(process.env.PUBLIC_API_ORIGIN || "").origin === STAGING_API_ORIGIN,
    "Integration target is not the approved staging API",
  );
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  assert(
    mongoose.connection.db?.databaseName === "htcoaching_staging",
    "Integration connection is not using the staging database",
  );

  const user = await User.findOne({
    email: SYNTHETIC_CLIENT_EMAIL,
    role: "user",
  });
  assert(user, "Synthetic staging client is missing");
  const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

  const googleOAuth = await testGoogleOAuth();
  const ai = await testAi(user, token);
  const cloudinary = await testCloudinary();

  console.log(
    JSON.stringify(
      {
        operation: "staging-integrations",
        database: mongoose.connection.db.databaseName,
        googleOAuth,
        ai,
        cloudinary,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} finally {
  if (conversationId && mongoose.connection.readyState === 1) {
    await ChatConversation.deleteOne({ _id: conversationId });
  }
  if (uploadedPublicId) {
    await destroyCloudinaryAsset(uploadedPublicId);
  }
  await mongoose.disconnect();
}
