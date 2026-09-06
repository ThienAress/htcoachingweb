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
import bcrypt from "bcryptjs";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  TEST_REFRESH_SECRET,
  teardownTestDB,
} from "../../__tests__/setup.js";
import User from "../../models/User.js";
import authRoutes from "../../routes/auth.routes.js";
import { createAuthSession } from "../../services/authSession.service.js";
import { safeLog } from "../../utils/safeLogger.js";
import {
  getMetricsSnapshot,
  resetMetricsForTests,
} from "../../observability/metrics.js";

const CSRF_TOKEN = ["refresh", "session", "csrf"].join("-");

const postAuth = (app, path, cookies = []) =>
  request(app)
    .post(`/api/auth/${path}`)
    .set("Cookie", [...cookies, `csrfToken=${CSRF_TOKEN}`])
    .set("X-CSRF-Token", CSRF_TOKEN);

const readCookie = (response, name) => {
  const cookie = response.headers["set-cookie"]?.find((entry) =>
    entry.startsWith(`${name}=`),
  );
  return cookie?.slice(name.length + 1).split(";", 1)[0] || null;
};

const readSetCookie = (response, name) =>
  response.headers["set-cookie"]?.find((entry) =>
    entry.startsWith(`${name}=`),
  ) || null;

describe("refresh-session security", () => {
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

  it("rotates within one signed family and persists only the new current JTI", async () => {
    const { user, refreshToken } = await createTestUser({
      email: "refresh-family@example.com",
    });
    const before = jwt.decode(refreshToken);

    const response = await postAuth(app, "refresh", [
      `refreshToken=${refreshToken}`,
    ]);
    const nextRefreshToken = readCookie(response, "refreshToken");
    const after = jwt.decode(nextRefreshToken);
    const accessCookieHeader = readSetCookie(response, "accessToken");
    const refreshCookieHeader = readSetCookie(response, "refreshToken");
    const stored = await User.findById(user._id)
      .select("+refreshToken +refreshSession")
      .lean();

    expect({
      status: response.status,
      beforeFamily: before?.familyId,
      afterFamily: after?.familyId,
      jtiChanged: before?.jti !== after?.jti,
      storedFamily: stored?.refreshSession?.familyId,
      storedJti: stored?.refreshSession?.currentJti,
      storedVerifierIsFullDigest: /^[0-9a-f]{64}$/u.test(
        stored?.refreshToken || "",
      ),
      accessCookieHttpOnly: /; HttpOnly(?:;|$)/u.test(accessCookieHeader || ""),
      refreshCookieHttpOnly: /; HttpOnly(?:;|$)/u.test(
        refreshCookieHeader || "",
      ),
      responseLeaksCredential:
        /accessToken|refreshToken|familyId|currentJti|refreshSession/u.test(
          JSON.stringify(response.body),
        ),
      refreshMetric:
        getMetricsSnapshot().counters["auth.refresh_succeeded"],
    }).toEqual({
      status: 200,
      beforeFamily: expect.any(String),
      afterFamily: before?.familyId,
      jtiChanged: true,
      storedFamily: before?.familyId,
      storedJti: after?.jti,
      storedVerifierIsFullDigest: true,
      accessCookieHttpOnly: true,
      refreshCookieHttpOnly: true,
      responseLeaksCredential: false,
      refreshMetric: 1,
    });
  });

  it("counts missing, rejected and unexpected refresh outcomes separately", async () => {
    const missing = await postAuth(app, "refresh");
    const rejected = await postAuth(app, "refresh", [
      "refreshToken=not-a-refresh-token",
    ]);
    const { refreshToken } = await createTestUser({
      email: "refresh-metric-failure@example.com",
    });
    const persistenceFailure = vi
      .spyOn(User, "findById")
      .mockRejectedValueOnce(new Error("test persistence failure"));
    const errorLog = vi.spyOn(safeLog, "error").mockImplementation(() => {});
    let failed;
    try {
      failed = await postAuth(app, "refresh", [
        `refreshToken=${refreshToken}`,
      ]);
    } finally {
      persistenceFailure.mockRestore();
      errorLog.mockRestore();
    }

    expect({
      statuses: [missing.status, rejected.status, failed.status],
      counters: getMetricsSnapshot().counters,
    }).toMatchObject({
      statuses: [401, 403, 500],
      counters: {
        "auth.refresh_missing": 1,
        "auth.refresh_rejected": 1,
        "auth.refresh_failed": 1,
      },
    });
  });

  it("keeps a normally rotated successor usable within the same family", async () => {
    const { refreshToken } = await createTestUser({
      email: "refresh-successor@example.com",
    });

    const first = await postAuth(app, "refresh", [
      `refreshToken=${refreshToken}`,
    ]);
    const successor = readCookie(first, "refreshToken");
    const second = await postAuth(app, "refresh", [
      `refreshToken=${successor}`,
    ]);

    expect({
      statuses: [first.status, second.status],
      familyPreserved:
        jwt.decode(refreshToken)?.familyId ===
        jwt.decode(readCookie(second, "refreshToken"))?.familyId,
    }).toEqual({ statuses: [200, 200], familyPreserved: true });
  });

  it("keeps refresh CSRF-protected before any token rotation", async () => {
    const { refreshToken } = await createTestUser({
      email: "refresh-csrf@example.com",
    });

    const withoutCsrf = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshToken}`]);
    const withCsrf = await postAuth(app, "refresh", [
      `refreshToken=${refreshToken}`,
    ]);

    expect({
      rejectedBeforeRotation: withoutCsrf.status,
      originalTokenStillUsable: withCsrf.status,
    }).toEqual({ rejectedBeforeRotation: 403, originalTokenStillUsable: 200 });
  });

  it("keeps the initial access and refresh JWT lifetimes at 15 minutes and 7 days", async () => {
    const { accessToken, refreshToken } = await createTestUser({
      email: "refresh-duration@example.com",
    });
    const accessClaims = jwt.decode(accessToken);
    const refreshClaims = jwt.decode(refreshToken);

    expect({
      accessLifetimeSeconds: accessClaims?.exp - accessClaims?.iat,
      refreshLifetimeWithinOneSecondOfSevenDays: [
        7 * 24 * 60 * 60 - 1,
        7 * 24 * 60 * 60,
      ].includes(refreshClaims?.exp - refreshClaims?.iat),
    }).toEqual({
      accessLifetimeSeconds: 15 * 60,
      refreshLifetimeWithinOneSecondOfSevenDays: true,
    });
  });

  it("allows at most one concurrent rotation and revokes its successor", async () => {
    const { refreshToken } = await createTestUser({
      email: "refresh-race@example.com",
    });

    const responses = await Promise.all([
      postAuth(app, "refresh", [`refreshToken=${refreshToken}`]),
      postAuth(app, "refresh", [`refreshToken=${refreshToken}`]),
    ]);
    const statuses = responses.map(({ status }) => status).sort();
    const winner = responses.find(({ status }) => status === 200);
    const successor = winner ? readCookie(winner, "refreshToken") : null;
    const successorResponse = successor
      ? await postAuth(app, "refresh", [`refreshToken=${successor}`])
      : null;

    expect({ statuses, successorStatus: successorResponse?.status }).toEqual({
      statuses: [200, 403],
      successorStatus: 403,
    });
  });

  it("revokes the active successor when an already-rotated token is replayed", async () => {
    const { refreshToken } = await createTestUser({
      email: "refresh-replay@example.com",
    });
    const securityLog = vi
      .spyOn(safeLog, "security")
      .mockImplementation(() => {});
    let first;
    let successor;
    let replay;
    let afterReplay;
    let reuseLog;
    try {
      first = await postAuth(app, "refresh", [
        `refreshToken=${refreshToken}`,
      ]);
      successor = readCookie(first, "refreshToken");

      replay = await postAuth(app, "refresh", [
        `refreshToken=${refreshToken}`,
      ]);
      afterReplay = await postAuth(app, "refresh", [
        `refreshToken=${successor}`,
      ]);
      reuseLog = securityLog.mock.calls.find(
        ([event]) => event === "auth.refresh_reuse_detected",
      );
    } finally {
      securityLog.mockRestore();
    }

    expect({
      first: first.status,
      replay: replay.status,
      successorAfterReplay: afterReplay.status,
      reuseLog,
      reuseMetric:
        getMetricsSnapshot().counters["auth.refresh_reuse_detected"],
    }).toEqual({
      first: 200,
      replay: 403,
      successorAfterReplay: 403,
      reuseLog: [
        "auth.refresh_reuse_detected",
        { outcome: "family_revoked" },
      ],
      reuseMetric: 1,
    });
  });

  it("never extends the initial absolute refresh expiry", async () => {
    const { user, refreshToken } = await createTestUser({
      email: "refresh-absolute-expiry@example.com",
    });
    const absoluteExpiresAt = new Date(
      Math.floor((Date.now() + 60_000) / 1000) * 1000,
    );
    await User.updateOne(
      { _id: user._id },
      { $set: { "refreshSession.expiresAt": absoluteExpiresAt } },
    );

    const response = await postAuth(app, "refresh", [
      `refreshToken=${refreshToken}`,
    ]);
    const successor = readCookie(response, "refreshToken");
    const successorClaims = jwt.decode(successor);
    const cookieHeader = readSetCookie(response, "refreshToken");
    const cookieExpiresMatch = cookieHeader?.match(/Expires=([^;]+)/u);
    const cookieExpiresAt = cookieExpiresMatch
      ? new Date(cookieExpiresMatch[1]).getTime()
      : Number.NaN;

    expect({
      status: response.status,
      jwtBounded: successorClaims?.exp * 1000 <= absoluteExpiresAt.getTime(),
      cookieBounded: cookieExpiresAt <= absoluteExpiresAt.getTime(),
    }).toEqual({ status: 200, jwtBounded: true, cookieBounded: true });
  });

  it("fails closed when the absolute expiry passes after the rotation CAS", async () => {
    const { user, refreshToken } = await createTestUser({
      email: "refresh-expiry-after-cas@example.com",
    });
    const absoluteExpiresAt = new Date(
      Math.floor((Date.now() + 60_000) / 1000) * 1000,
    );
    await User.updateOne(
      { _id: user._id },
      { $set: { "refreshSession.expiresAt": absoluteExpiresAt } },
    );

    const originalFindOneAndUpdate = User.findOneAndUpdate.bind(User);
    let clock;
    let casCommitted = false;
    const rotationCas = vi
      .spyOn(User, "findOneAndUpdate")
      .mockImplementation(async (...args) => {
        const updatedUser = await originalFindOneAndUpdate(...args);
        casCommitted = Boolean(updatedUser);
        clock = vi
          .spyOn(Date, "now")
          .mockReturnValue(absoluteExpiresAt.getTime() + 1);
        return updatedUser;
      });
    let response;
    try {
      response = await postAuth(app, "refresh", [
        `refreshToken=${refreshToken}`,
      ]);
    } finally {
      clock?.mockRestore();
      rotationCas.mockRestore();
    }

    expect({
      casCommitted,
      status: response.status,
      cookieCleared: readSetCookie(response, "refreshToken")?.startsWith(
        "refreshToken=;",
      ),
    }).toEqual({ casCommitted: true, status: 403, cookieCleared: true });
  });

  it("fails closed for legacy bcrypt refresh tokens without family claims", async () => {
    const user = await User.create({
      name: "Legacy Session",
      email: "refresh-legacy@example.com",
      role: "user",
    });
    const legacyToken = jwt.sign(
      { id: user._id },
      TEST_REFRESH_SECRET,
      { expiresIn: "7d" },
    );
    await User.updateOne(
      { _id: user._id },
      { $set: { refreshToken: await bcrypt.hash(legacyToken, 10) } },
    );

    const response = await postAuth(app, "refresh", [
      `refreshToken=${legacyToken}`,
    ]);
    const stored = await User.findById(user._id).select("+refreshToken").lean();

    expect({
      status: response.status,
      cookieCleared: readSetCookie(response, "refreshToken")?.startsWith(
        "refreshToken=;",
      ),
      bodyLeaksToken: JSON.stringify(response.body).includes(legacyToken),
      storedVerifier: stored?.refreshToken,
    }).toEqual({
      status: 403,
      cookieCleared: true,
      bodyLeaksToken: false,
      storedVerifier: null,
    });
  });

  it("does not let an older family revoke the user's current login family", async () => {
    const previousFamily = await createTestUser({
      email: "refresh-old-family@example.com",
    });
    const { user } = previousFamily;
    const previousFamilyToken = previousFamily.refreshToken;
    const currentSession = await createAuthSession(user);

    const staleFamily = await postAuth(app, "refresh", [
      `refreshToken=${previousFamilyToken}`,
    ]);
    const currentFamily = await postAuth(app, "refresh", [
      `refreshToken=${currentSession.refreshToken}`,
    ]);

    expect({
      staleFamily: staleFamily.status,
      currentFamily: currentFamily.status,
    }).toEqual({ staleFamily: 403, currentFamily: 200 });
  });

  it("hides refresh-family metadata from the default User projection", async () => {
    const { user } = await createTestUser({
      email: "refresh-hidden-metadata@example.com",
    });

    const defaultUser = await User.findById(user._id).lean();
    const explicitUser = await User.findById(user._id)
      .select("+refreshToken +refreshSession")
      .lean();

    expect({
      defaultVerifier: defaultUser?.refreshToken,
      defaultSession: defaultUser?.refreshSession,
      explicitVerifier: Boolean(explicitUser?.refreshToken),
      explicitFamily: Boolean(explicitUser?.refreshSession?.familyId),
    }).toEqual({
      defaultVerifier: undefined,
      defaultSession: undefined,
      explicitVerifier: true,
      explicitFamily: true,
    });
  });
});
