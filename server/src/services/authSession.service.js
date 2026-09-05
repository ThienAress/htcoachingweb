import crypto from "node:crypto";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import User from "../models/User.js";
import { safeLog } from "../utils/safeLogger.js";

export const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const REFRESH_TOKEN_SELECT = "+refreshToken +refreshSession";
const REFRESH_TOKEN_DIGEST_DOMAIN = "htcoaching.refresh-token.v1\0";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class AuthSessionError extends Error {
  constructor(code = "AUTH_REFRESH_INVALID") {
    super(code);
    this.name = "AuthSessionError";
    this.code = code;
  }
}

export const isAuthSessionError = (error) =>
  error instanceof AuthSessionError;

const invalidRefresh = () => new AuthSessionError();

const digestRefreshToken = (token) =>
  crypto
    .createHmac("sha256", process.env.REFRESH_SECRET)
    .update(REFRESH_TOKEN_DIGEST_DOMAIN, "utf8")
    .update(token, "utf8")
    .digest("hex");

const tokenDigestMatches = (token, storedDigest) => {
  if (typeof storedDigest !== "string" || !/^[0-9a-f]{64}$/iu.test(storedDigest)) {
    return false;
  }
  const presented = Buffer.from(digestRefreshToken(token), "hex");
  const stored = Buffer.from(storedDigest, "hex");
  return crypto.timingSafeEqual(presented, stored);
};

const signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "15m" },
  );

const remainingSeconds = (expiresAt) =>
  Math.floor((expiresAt.getTime() - Date.now()) / 1000);

const signRefreshToken = (user, { familyId, jti, expiresAt }) => {
  if (remainingSeconds(expiresAt) < 1) throw invalidRefresh();

  return jwt.sign(
    {
      id: user._id,
      familyId,
      exp: Math.floor(expiresAt.getTime() / 1000),
    },
    process.env.REFRESH_SECRET,
    { algorithm: "HS256", jwtid: jti },
  );
};

const verifyRefreshToken = (token, { ignoreExpiration = false } = {}) => {
  try {
    const decoded = jwt.verify(token, process.env.REFRESH_SECRET, {
      algorithms: ["HS256"],
      ignoreExpiration,
    });
    if (
      !decoded ||
      typeof decoded !== "object" ||
      !mongoose.isValidObjectId(decoded.id)
    ) {
      throw invalidRefresh();
    }
    return decoded;
  } catch {
    throw invalidRefresh();
  }
};

const readFamilyClaims = (decoded) => {
  const hasFamilyClaim = Object.hasOwn(decoded, "familyId");
  const hasJtiClaim = Object.hasOwn(decoded, "jti");
  if (!hasFamilyClaim && !hasJtiClaim) return null;

  if (
    typeof decoded.familyId !== "string" ||
    typeof decoded.jti !== "string" ||
    !UUID_PATTERN.test(decoded.familyId) ||
    !UUID_PATTERN.test(decoded.jti)
  ) {
    throw invalidRefresh();
  }

  return { familyId: decoded.familyId, jti: decoded.jti };
};

const sessionResult = ({ user, accessToken, refreshToken, expiresAt }) => {
  const refreshTokenMaxAgeMs = expiresAt.getTime() - Date.now();
  if (refreshTokenMaxAgeMs <= 0) throw invalidRefresh();

  return {
    user,
    accessToken,
    refreshToken,
    refreshTokenMaxAgeMs,
  };
};

const revokeLegacyVerifier = (userId) =>
  User.updateOne(
    { _id: userId, refreshSession: { $exists: false } },
    { $set: { refreshToken: null } },
  );

const revokeFamily = async (userId, familyId, reason) => {
  const revokedAt = new Date();
  return User.updateOne(
    {
      _id: userId,
      "refreshSession.familyId": familyId,
      "refreshSession.revokedAt": null,
    },
    {
      $set: {
        refreshToken: null,
        "refreshSession.revokedAt": revokedAt,
        "refreshSession.revokeReason": reason,
      },
    },
  );
};

const reportReuse = () => {
  safeLog.security("auth.refresh_reuse_detected", {
    outcome: "family_revoked",
  });
};

export const createAuthSession = async (user) => {
  const familyId = crypto.randomUUID();
  const currentJti = crypto.randomUUID();
  const expiresAt = new Date(
    Math.floor((Date.now() + REFRESH_TOKEN_MAX_AGE_MS) / 1000) * 1000,
  );
  const refreshToken = signRefreshToken(user, {
    familyId,
    jti: currentJti,
    expiresAt,
  });
  const refreshTokenDigest = digestRefreshToken(refreshToken);
  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        refreshToken: refreshTokenDigest,
        refreshSession: {
          familyId,
          currentJti,
          expiresAt,
          revokedAt: null,
          revokeReason: null,
        },
      },
    },
    { returnDocument: "after", runValidators: true },
  );

  if (!updatedUser) throw new Error("Auth session user no longer exists");

  return sessionResult({
    user: updatedUser,
    accessToken: signAccessToken(updatedUser),
    refreshToken,
    expiresAt,
  });
};

const rotateFamilySession = async (token, user, claims) => {
  const session = user.refreshSession;
  if (!session || session.familyId !== claims.familyId) {
    throw invalidRefresh();
  }

  if (
    session.revokedAt ||
    !(session.expiresAt instanceof Date) ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    throw invalidRefresh();
  }

  const currentTokenMatches =
    session.currentJti === claims.jti &&
    user.refreshToken &&
    tokenDigestMatches(token, user.refreshToken);
  if (!currentTokenMatches) {
    await revokeFamily(user._id, claims.familyId, "reuse");
    reportReuse();
    throw invalidRefresh();
  }

  const nextJti = crypto.randomUUID();
  const nextRefreshToken = signRefreshToken(user, {
    familyId: claims.familyId,
    jti: nextJti,
    expiresAt: session.expiresAt,
  });
  const nextDigest = digestRefreshToken(nextRefreshToken);
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      refreshToken: user.refreshToken,
      "refreshSession.familyId": claims.familyId,
      "refreshSession.currentJti": claims.jti,
      "refreshSession.revokedAt": null,
      "refreshSession.expiresAt": { $gt: new Date() },
    },
    {
      $set: {
        refreshToken: nextDigest,
        "refreshSession.currentJti": nextJti,
      },
    },
    { returnDocument: "after", runValidators: true },
  );

  if (!updatedUser) {
    await revokeFamily(user._id, claims.familyId, "reuse");
    reportReuse();
    throw invalidRefresh();
  }

  return sessionResult({
    user: updatedUser,
    accessToken: signAccessToken(updatedUser),
    refreshToken: nextRefreshToken,
    expiresAt: session.expiresAt,
  });
};

export const rotateAuthSession = async (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);
  const claims = readFamilyClaims(decoded);
  if (!claims) {
    await revokeLegacyVerifier(decoded.id);
    throw invalidRefresh();
  }
  const user = await User.findById(decoded.id).select(REFRESH_TOKEN_SELECT);
  if (!user) throw invalidRefresh();

  return rotateFamilySession(refreshToken, user, claims);
};

export const revokeAuthSession = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken, { ignoreExpiration: true });
  } catch (error) {
    if (isAuthSessionError(error)) return false;
    throw error;
  }

  let claims;
  try {
    claims = readFamilyClaims(decoded);
  } catch (error) {
    if (isAuthSessionError(error)) return false;
    throw error;
  }
  if (!claims) {
    const result = await revokeLegacyVerifier(decoded.id);
    return result.modifiedCount === 1;
  }
  const user = await User.findById(decoded.id).select(REFRESH_TOKEN_SELECT);
  if (!user?.refreshToken) return false;

  if (user.refreshSession?.familyId !== claims.familyId) return false;
  const result = await revokeFamily(user._id, claims.familyId, "logout");
  return result.modifiedCount === 1;
};
