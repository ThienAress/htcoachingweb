import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  TEST_JWT_SECRET,
  TEST_REFRESH_SECRET,
  teardownTestDB,
} from "../../__tests__/setup.js";
import User from "../../models/User.js";
import authRoutes from "../../routes/auth.routes.js";
import { safeLog } from "../../utils/safeLogger.js";
import {
  getMetricsSnapshot,
  resetMetricsForTests,
} from "../../observability/metrics.js";

const CSRF_TOKEN = ["logout", "session", "csrf"].join("-");

const postLogout = (app, cookies = []) =>
  request(app)
    .post("/api/auth/logout")
    .set("Cookie", [...cookies, `csrfToken=${CSRF_TOKEN}`])
    .set("X-CSRF-Token", CSRF_TOKEN);

const readSetCookie = (response, name) =>
  response.headers["set-cookie"]?.find((entry) =>
    entry.startsWith(`${name}=`),
  ) || null;

describe("refresh-backed logout", () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    app.use("/api/auth", authRoutes);
  });

  afterEach(async () => {
    resetMetricsForTests();
    await clearCollections();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  it("revokes through the refresh cookie when the access token is expired", async () => {
    const { user, refreshToken } = await createTestUser({
      email: "refresh-logout@example.com",
    });
    const expiredAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      TEST_JWT_SECRET,
      { expiresIn: -1 },
    );

    const response = await postLogout(app, [
      `accessToken=${expiredAccessToken}`,
      `refreshToken=${refreshToken}`,
    ]);
    const stored = await User.findById(user._id)
      .select("+refreshToken +refreshSession")
      .lean();

    expect({
      status: response.status,
      verifier: stored?.refreshToken,
      revoked: stored?.refreshSession?.revokedAt instanceof Date,
      reason: stored?.refreshSession?.revokeReason,
      refreshCookieCleared: readSetCookie(response, "refreshToken")?.startsWith(
        "refreshToken=;",
      ),
      accessCookieCleared: readSetCookie(response, "accessToken")?.startsWith(
        "accessToken=;",
      ),
      csrfCookieCleared: readSetCookie(response, "csrfToken")?.startsWith(
        "csrfToken=;",
      ),
      logoutMetric: getMetricsSnapshot().counters["auth.logout_succeeded"],
    }).toEqual({
      status: 200,
      verifier: null,
      revoked: true,
      reason: "logout",
      refreshCookieCleared: true,
      accessCookieCleared: true,
      csrfCookieCleared: true,
      logoutMetric: 1,
    });
  });

  it("keeps logout CSRF-protected before any family revocation", async () => {
    const { user, refreshToken } = await createTestUser({
      email: "refresh-logout-csrf@example.com",
    });

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [`refreshToken=${refreshToken}`]);
    const stored = await User.findById(user._id)
      .select("+refreshToken +refreshSession")
      .lean();

    expect({
      status: response.status,
      stillActive: Boolean(
        stored?.refreshToken && !stored?.refreshSession?.revokedAt,
      ),
    }).toEqual({ status: 403, stillActive: true });
  });

  it("clears cookies idempotently when no usable refresh token exists", async () => {
    const missing = await postLogout(app);
    const invalidRefreshCookie = [["refresh", "Token"].join(""), "not-a-jwt"].join("=");
    const invalid = await postLogout(app, [invalidRefreshCookie]);

    expect({
      missingStatus: missing.status,
      invalidStatus: invalid.status,
      missingCleared: readSetCookie(
        missing,
        "refreshToken",
      )?.startsWith("refreshToken=;"),
      invalidCleared: readSetCookie(
        invalid,
        "refreshToken",
      )?.startsWith("refreshToken=;"),
    }).toEqual({
      missingStatus: 200,
      invalidStatus: 200,
      missingCleared: true,
      invalidCleared: true,
    });
  });

  it("treats signed but incomplete family claims as an invalid idempotent logout", async () => {
    const { user, refreshToken } = await createTestUser({
      email: "refresh-logout-claims@example.com",
    });
    const { familyId } = jwt.decode(refreshToken);
    const incompleteToken = jwt.sign(
      { id: user._id, familyId },
      TEST_REFRESH_SECRET,
      { expiresIn: "5m" },
    );

    const response = await postLogout(app, [
      `refreshToken=${incompleteToken}`,
    ]);
    const stored = await User.findById(user._id)
      .select("+refreshToken +refreshSession")
      .lean();

    expect({
      status: response.status,
      currentFamilyStillActive: Boolean(
        stored?.refreshToken && !stored?.refreshSession?.revokedAt,
      ),
    }).toEqual({ status: 200, currentFamilyStillActive: true });
  });

  it("surfaces an unexpected persistence failure and still clears cookies", async () => {
    const { refreshToken } = await createTestUser({
      email: "refresh-logout-persistence@example.com",
    });
    const persistenceFailure = vi
      .spyOn(User, "updateOne")
      .mockRejectedValueOnce(new Error("test persistence failure"));
    const errorLog = vi.spyOn(safeLog, "error").mockImplementation(() => {});
    let response;
    let logEvent;
    try {
      response = await postLogout(app, [`refreshToken=${refreshToken}`]);
      logEvent = errorLog.mock.calls[0]?.[0];
    } finally {
      persistenceFailure.mockRestore();
      errorLog.mockRestore();
    }

    expect({
      status: response.status,
      cookieCleared: readSetCookie(response, "refreshToken")?.startsWith(
        "refreshToken=;",
      ),
      logEvent,
      logoutMetric: getMetricsSnapshot().counters["auth.logout_failed"],
    }).toEqual({
      status: 500,
      cookieCleared: true,
      logEvent: "LOGOUT",
      logoutMetric: 1,
    });
  });
});
