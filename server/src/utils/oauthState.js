import crypto from "crypto";

export const OAUTH_STATE_MAX_AGE_MS = 5 * 60 * 1000;

const timingSafeTextEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const signData = (data, secret) =>
  crypto.createHmac("sha256", secret).update(data).digest("base64url");

export const generateOAuthNonce = () =>
  crypto.randomBytes(32).toString("base64url");

export const createOAuthState = ({
  secret,
  clientUrl,
  nonce,
  now = Date.now(),
}) => {
  if (!secret || !nonce) {
    throw new Error("OAuth state secret and nonce are required");
  }
  const data = Buffer.from(
    JSON.stringify({
      clientUrl: String(clientUrl || ""),
      nonce: String(nonce),
      iat: now,
    }),
  ).toString("base64url");
  return `${data}.${signData(data, secret)}`;
};

export const verifyOAuthState = ({
  state,
  secret,
  expectedNonce,
  now = Date.now(),
  maxAgeMs = OAUTH_STATE_MAX_AGE_MS,
}) => {
  if (!secret || !expectedNonce || typeof state !== "string") return null;
  const parts = state.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [data, signature] = parts;
  if (!timingSafeTextEqual(signature, signData(data, secret))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    );
    const age = now - Number(payload.iat);
    if (!Number.isFinite(age) || age < -60_000 || age > maxAgeMs) return null;
    if (!timingSafeTextEqual(payload.nonce, expectedNonce)) return null;
    return payload;
  } catch {
    return null;
  }
};

export const isDevLoginEnabled = (env = process.env) =>
  env.NODE_ENV === "development" &&
  String(env.ENABLE_DEV_LOGIN || "").toLowerCase() === "true";

export const isLoopbackAddress = (value) => {
  const address = String(value || "").trim().toLowerCase();
  return (
    address === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(address) ||
    /^::ffff:127(?:\.\d{1,3}){3}$/.test(address)
  );
};
