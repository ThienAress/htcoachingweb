import { createHash } from "node:crypto";

const DASH_LIKE_PATTERN = /[\p{Pd}\u2212]/gu;
const INVISIBLE_FORMAT_PATTERN =
  /(?:\p{Cf}|\p{Default_Ignorable_Code_Point})/gu;
const GOOGLE_APP_PASSWORD_BODY = String.raw`[a-z]{4}(?:[ \t]+[a-z]{4}){3}`;
const GOOGLE_APP_PASSWORD_ASSIGNMENT_PATTERN = new RegExp(
  String.raw`\b(?:gmail|google)(?:[ _-]+)app(?:[ _-]+)password\b["']?[ \t]*[:=][ \t]*["']?${GOOGLE_APP_PASSWORD_BODY}(?=["']?[ \t]*(?:$|[#;,]))`,
  "im",
);
const GOOGLE_APP_PASSWORD_PATH_PATTERN = new RegExp(
  String.raw`(?:^|[/\\])${GOOGLE_APP_PASSWORD_BODY}(?=(?:\.[^/\\\s]+)?(?:[/\\]|$))`,
  "i",
);
const GOOGLE_APP_PASSWORD_STANDALONE_PATTERN = new RegExp(
  String.raw`^[ \t]*${GOOGLE_APP_PASSWORD_BODY}[ \t]*$`,
  "im",
);
const BEARER_TOKEN_PATTERN =
  /\bBearer[ \t]+([A-Za-z0-9._~+\/-]{12,}={0,})(?=$|[\s"'`,;)\]}])/gim;
const CREDENTIAL_NAME_BODY = String.raw`(?:password|token|secret|(?:api|access|refresh|auth|session|id)[_-]?token|(?:client|jwt|session|webhook|cookie|csrf)[_-]?secret|(?:api|private|encryption|signing)[_-]?key|(?:db|database|mongo|gmail|google|smtp)[_-]?password)`;
const CREDENTIAL_ASSIGNMENT_PATTERN = new RegExp(
  String.raw`(?:^|[^A-Za-z0-9])(?<name>${CREDENTIAL_NAME_BODY})["']?[ \t]*(?:=|:(?!-))[ \t]*(?:(?:\r?\n[ \t]*)?(?<quote>["'\x60])(?<quoted>[^\r\n]{8,}?)\k<quote>(?=[ \t]*(?:$|[#;,)\]}]))|(?<unquoted>[^\s#;,"'\x60]{8,}))`,
  "gim",
);
const CREDENTIAL_RUNTIME_FALLBACK_PATTERN = new RegExp(
  String.raw`(?:^|[^A-Za-z0-9])(?<name>${CREDENTIAL_NAME_BODY})["']?[ \t]*(?:=|:(?!-))[ \t]*(?:process\.env(?:\.[A-Z_][A-Z0-9_]*|\[["'][A-Z_][A-Z0-9_]*["']\]))[ \t]*(?:\|\||\?\?)[ \t]*(?<quote>["'\x60])(?<fallback>[^\r\n]{8,}?)\k<quote>`,
  "gim",
);
const SYNTHETIC_CREDENTIAL_PATTERNS = [
  /^<[^>\r\n]+>$/,
  /^(?:dummy|example|fake|fixture|mock|placeholder|redacted|sample|synthetic)(?:[-_.:/+][A-Za-z0-9]+)*$/i,
  /^(?:must-not-leak|not-a-secret|local-only|radar-read)$/i,
  /^local-only-(?:jwt|refresh|log-hash)-not-a-secret(?:-local-only-(?:jwt|refresh|log-hash)(?:-not-a-secret)?)?$/i,
  /^docker-local-not-a-secret$/i,
];
const SYNTHETIC_CREDENTIAL_DIGESTS = new Set([
  // Exact committed test sentinels. Hashes avoid embedding credential-shaped fixtures here.
  "11bd7e415f291f5fedc0cff63971d7c629f1bd56cb7f4c9de12981652f976a28",
  "0a07fcd62fbb9ac6ba3faa9b5c04e4238e5fe53e63364c12c3a5f760fa9a158c",
  "1eb8628fb10c492573b4f64799261ed94fcd592a268612be9008d7d0016b8977",
  "41a4d1352715a0e1d43a8f3e27aa8b061ffd87f45097ed85fdca9a7e89b92760",
  "47c68758d8f19cd287de9ace5d389d63405c231b4fa957ca834f0b733d7ada55",
  "4d8f49d8c9549096146fd49659128aac2680063f35d09fdd45ebc7f080e1ca81",
  "5e3f350d3ec7d46787b8bb78104e2338487ecc21b74f9655fa1155e2ae1a1191",
  "602728528f07b3e3514bb0b5fecb93fb5f10ac888e072272a810823f0819c290",
  "6993a5194706d104d6c58d98a01c4a4418b1dfe724d0351cda0c423b8297734d",
  "7b2f372de4dfc46bda7103389219e120e34ac9f74bbc87db41368dd657c6e600",
  "8c394ed08c54e9e79a152fdb9c3b95c1f18110ee2036840e0b6c7cf4094b4a54",
  "95176946acf81aae6ce467b09acef1ab7d031800bfe211fa5eff0447d14ac1dd",
  "a7358cb51ceddf990aa1733967b941df754c451d7dd81721a5a31f58120b8392",
  "b3f6ad09d9aa279c265d43ccf430a9c41931050aa39b7eba2b34ecec9ebc2527",
  "b68624b51837ac063ad4fa5f6f1f2a8266a93b9c1fd277abf577037920d3c705",
  "d43d4b96505fb9b487cfab30695d823a0b362961a3e6c008339642ab35860112",
  "e34401f5292db4289d1bd0d31cc9569a2a17a5b776d700c97472b465db7075db",
  "e5392ee9c796a624e4af586d2f78f6a2f0de3417505d58f7da20f8ba70aa2a4e",
  "e6449f967c2700489c669e8402ac4bccf97029fdd604033a79f5e1e132dfec97",
  "ee1d5749f83f0aa240a0f3814f2910f65258040c64f1654d637818e37f9e5339",
  "ef11aea036258808bd97a3a2051947d2fc70627af13c1eca524f75ec7547cabd",
  "fd58f93cf1e28a47f6dacfed7cbf22ab2f90c74294dbe363a7b9ef29e29802ef",
  "f39dac6cbaba535e2c207cd0cd8f154974223c848f727f98b3564cea569b41cf",
]);

const isSyntheticCredentialValue = (value, additionalDigests) => {
  const candidate = String(value ?? "").trim();
  const digest = createHash("sha256").update(candidate).digest("hex");
  return SYNTHETIC_CREDENTIAL_PATTERNS.some((pattern) => pattern.test(candidate))
    || SYNTHETIC_CREDENTIAL_DIGESTS.has(digest)
    || additionalDigests?.has(digest);
};

const isRuntimeCredentialReference = (value) => {
  const candidate = String(value ?? "");
  if (
    /^(?:process\.)?env(?:ironment)?(?:\.[A-Z_][A-Z0-9_]*|\[["'][A-Z_][A-Z0-9_]*["']\])$/i
      .test(candidate)
  ) {
    return true;
  }
  if (/^\$\{[A-Z_][A-Z0-9_]*(?::\?[^}\r\n]*)?\}$/i.test(candidate)) {
    return true;
  }
  if (/^\$\{[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*\}$/.test(candidate)) {
    return true;
  }
  const shellFallback = candidate.match(
    /^\$\{[A-Z_][A-Z0-9_]*:-(?<fallback>[^}\r\n]*)\}$/i,
  );
  return Boolean(
    shellFallback
    && (
      shellFallback.groups?.fallback === ""
      || isSyntheticCredentialValue(shellFallback.groups?.fallback)
    )
  );
};

const allowedCredentialName = (name, policy) => (
  policy === "all" || String(name).replace(/[_-]/g, "").toLowerCase() === "apikey"
);

export const normalizeSensitiveText = (value) => String(value ?? "")
  .normalize("NFKC")
  .replace(DASH_LIKE_PATTERN, "-")
  .replace(INVISIBLE_FORMAT_PATTERN, "");

const decodeBytes = (bytes, encoding) => new TextDecoder(encoding, { fatal: true })
  .decode(bytes);

export const decodeSensitiveTextBytes = (value) => {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  let content;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    if ((bytes.length - 2) % 2 !== 0) throw new Error("Sensitive text encoding is invalid");
    content = decodeBytes(bytes.subarray(2), "utf-16le");
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    if ((bytes.length - 2) % 2 !== 0) throw new Error("Sensitive text encoding is invalid");
    content = decodeBytes(bytes.subarray(2), "utf-16be");
  } else {
    content = decodeBytes(bytes, "utf-8");
  }
  if (content.includes("\0")) throw new Error("Sensitive text encoding is invalid");
  return content;
};

export const CANONICAL_SECRET_DEFINITIONS = Object.freeze([
  Object.freeze(["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]),
  Object.freeze(["mongodb-credentials", /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@/i]),
  Object.freeze(["cloudinary-credentials", /cloudinary:\/\/[^:\s]+:[^@\s]+@/i]),
  Object.freeze(["openai-key", /\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{20,}\b/]),
  Object.freeze(["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/]),
  Object.freeze(["google-app-password", GOOGLE_APP_PASSWORD_ASSIGNMENT_PATTERN]),
  Object.freeze([
    "github-token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  ]),
  Object.freeze(["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/]),
  Object.freeze(["resend-key", /\bre_[A-Za-z0-9]{24,}\b/]),
  Object.freeze(["stripe-secret", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/]),
  Object.freeze(["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/]),
  Object.freeze(["npm-token", /\bnpm_[A-Za-z0-9]{36}\b/]),
  Object.freeze(["bearer-token", BEARER_TOKEN_PATTERN]),
  Object.freeze([
    "credential-assignment",
    CREDENTIAL_ASSIGNMENT_PATTERN,
  ]),
]);

const EXTRA_SENSITIVE_PATTERNS = Object.freeze([
  /(?:^|[^A-Za-z0-9])sk[-_](?:(?:proj|live|test)[-_])?[A-Za-z0-9_-]{12,}/i,
  /(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{16,}/i,
  /mongodb(?:\+srv)?:\/\/[^\s]+/i,
  /\b[0-9a-f]{32,}\b/i,
]);

export const findCanonicalSecretTypes = (
  value,
  {
    allowStandaloneGoogleAppPassword = false,
    allowBearerToken = true,
    allowCredentialAssignment = true,
    allowUnquotedCredentialAssignment = true,
    credentialNamePolicy = "all",
    minimumBearerLength = 12,
    minimumCredentialLength = 8,
    credentialValueDigestAllowlist,
    repositoryPath = false,
  } = {},
) => {
  const normalized = normalizeSensitiveText(value);
  const types = CANONICAL_SECRET_DEFINITIONS
    .filter(([type, pattern]) => {
      if (type === "bearer-token") {
        if (!allowBearerToken) return false;
        return [...normalized.matchAll(BEARER_TOKEN_PATTERN)]
          .some((match) => (
            match[1].length >= minimumBearerLength
            && !isSyntheticCredentialValue(match[1], credentialValueDigestAllowlist)
          ));
      }
      if (type === "credential-assignment") {
        if (!allowCredentialAssignment) return false;
        const hardcodedFallback = [...normalized.matchAll(CREDENTIAL_RUNTIME_FALLBACK_PATTERN)]
          .some((match) => (
            allowedCredentialName(match.groups?.name, credentialNamePolicy)
            && String(match.groups?.fallback || "").length >= minimumCredentialLength
            && !isSyntheticCredentialValue(
              match.groups?.fallback,
              credentialValueDigestAllowlist,
            )
          ));
        return hardcodedFallback || [...normalized.matchAll(CREDENTIAL_ASSIGNMENT_PATTERN)].some((match) => {
          const credentialValue = match.groups?.quoted || match.groups?.unquoted || "";
          return allowedCredentialName(match.groups?.name, credentialNamePolicy)
            && (allowUnquotedCredentialAssignment || match.groups?.quote)
            && credentialValue.length >= minimumCredentialLength
            && !isRuntimeCredentialReference(credentialValue)
            && !isSyntheticCredentialValue(
              credentialValue,
              credentialValueDigestAllowlist,
            );
        });
      }
      return pattern.test(normalized);
    })
    .map(([type]) => type);
  if (
    !types.includes("google-app-password")
    && (
      (repositoryPath && GOOGLE_APP_PASSWORD_PATH_PATTERN.test(normalized))
      || (
        allowStandaloneGoogleAppPassword
        && GOOGLE_APP_PASSWORD_STANDALONE_PATTERN.test(normalized)
      )
    )
  ) {
    types.push("google-app-password");
  }
  return types;
};

export const hasSecretLikeText = (value, options) => {
  const normalized = normalizeSensitiveText(value);
  return findCanonicalSecretTypes(normalized, options).length > 0
    || EXTRA_SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
};
