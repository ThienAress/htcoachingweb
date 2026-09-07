import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import { createAuthSession } from "../services/authSession.service.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const cookiePrefix = (name) => `${name}=`;

export const readSetCookieValue = (setCookies, name) => {
  const prefix = cookiePrefix(name);
  const matching = (setCookies || []).filter((entry) => entry.startsWith(prefix));
  const value = matching.at(-1)?.slice(prefix.length).split(";", 1)[0];
  return value || null;
};

export const hasClearedCookie = (setCookies, name) => {
  const prefix = cookiePrefix(name);
  return (setCookies || []).some((entry) => {
    if (!entry.startsWith(prefix) || entry.slice(prefix.length).split(";", 1)[0]) {
      return false;
    }
    return /(?:Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT)/iu.test(entry);
  });
};

export const testStagingAuthCutover = async ({
  addFlow,
  registerUser,
  request,
  runSuffix,
}) => {
  assert(process.env.REFRESH_SECRET, "Staging refresh secret is unavailable");

  const authUser = await User.create({
    name: `Staging Auth ${runSuffix}`,
    email: `staging.auth.${runSuffix}@example.invalid`,
    role: "user",
  });
  registerUser(authUser._id);

  const legacyToken = jwt.sign(
    { id: authUser._id.toString() },
    process.env.REFRESH_SECRET,
    { algorithm: "HS256", expiresIn: "7d" },
  );
  await User.updateOne(
    { _id: authUser._id },
    {
      $set: { refreshToken: await bcrypt.hash(legacyToken, 10) },
      $unset: { refreshSession: 1 },
    },
  );

  const legacy = await request("/api/auth/refresh", {
    method: "POST",
    cookies: [`refreshToken=${legacyToken}`],
    expected: [403],
    label: "legacy refresh cutover",
  });
  assert(
    legacy.data?.success === false &&
      legacy.data?.message === "Invalid refresh token" &&
      hasClearedCookie(legacy.setCookies, "refreshToken"),
    "Legacy refresh did not fail closed with a cleared cookie",
  );
  assert(
    !JSON.stringify(legacy.data).includes(legacyToken),
    "Legacy refresh token leaked in the response body",
  );

  const freshSession = await createAuthSession(authUser);
  const rotation = await request("/api/auth/refresh", {
    method: "POST",
    cookies: [`refreshToken=${freshSession.refreshToken}`],
    label: "fresh refresh rotation",
  });
  const successor = readSetCookieValue(rotation.setCookies, "refreshToken");
  assert(successor, "Refresh rotation did not set a successor cookie");
  assert(
    !JSON.stringify(rotation.data).includes(successor),
    "Successor refresh token leaked in the response body",
  );

  const replay = await request("/api/auth/refresh", {
    method: "POST",
    cookies: [`refreshToken=${freshSession.refreshToken}`],
    expected: [403],
    label: "rotated refresh replay",
  });
  const revokedSuccessor = await request("/api/auth/refresh", {
    method: "POST",
    cookies: [`refreshToken=${successor}`],
    expected: [403],
    label: "replay-revoked successor",
  });

  const logoutSession = await createAuthSession(authUser);
  const expiredAccessToken = jwt.sign(
    { id: authUser._id.toString(), role: authUser.role },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: -1 },
  );
  const logout = await request("/api/auth/logout", {
    method: "POST",
    cookies: [
      `accessToken=${expiredAccessToken}`,
      `refreshToken=${logoutSession.refreshToken}`,
    ],
    label: "logout with expired access token",
  });
  assert(
    hasClearedCookie(logout.setCookies, "accessToken") &&
      hasClearedCookie(logout.setCookies, "refreshToken"),
    "Logout did not clear Auth cookies",
  );
  const loggedOutRefresh = await request("/api/auth/refresh", {
    method: "POST",
    cookies: [`refreshToken=${logoutSession.refreshToken}`],
    expected: [403],
    label: "logged-out refresh rejection",
  });

  addFlow("auth-cutover-refresh-replay-logout", [
    legacy.status,
    rotation.status,
    replay.status,
    revokedSuccessor.status,
    logout.status,
    loggedOutRefresh.status,
  ]);
};
