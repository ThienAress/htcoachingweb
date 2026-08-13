const GITHUB_API_HOST = "api.github.com";
const MAX_RESPONSE_BYTES = 384 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;

class SkillRadarSourceError extends Error {
  constructor(message, { code, status, retryAt = null } = {}) {
    super(message);
    this.name = "SkillRadarSourceError";
    this.code = code;
    this.status = status;
    this.retryAt = retryAt;
  }
}

const sourceError = (message, details) =>
  new SkillRadarSourceError(message, details);

const asIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeGitHubName = (value, fallback) => {
  const normalized = String(value || fallback || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return normalized || String(fallback || "repository").slice(0, 120);
};

const normalizeGitHubSummary = (value) => {
  const normalized = String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return normalized || "Repository GitHub cần review nội dung.";
};

const retryAtFromHeaders = (headers, now = new Date()) => {
  const epoch = Number(headers?.get?.("x-ratelimit-reset"));
  if (Number.isFinite(epoch) && epoch > 0) return new Date(epoch * 1000).toISOString();
  const retryAfter = headers?.get?.("retry-after");
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return new Date(now.getTime() + seconds * 1000).toISOString();
  }
  const date = retryAfter ? new Date(retryAfter) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};

export const canonicalizeGithubRepositoryUrl = (value) => {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw sourceError("URL GitHub repository không hợp lệ", {
      code: "INVALID_SOURCE_URL",
      status: 400,
    });
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "github.com" ||
    segments.length !== 2 ||
    !/^[A-Za-z0-9_.-]+$/.test(segments[0]) ||
    !/^[A-Za-z0-9_.-]+(?:\.git)?$/.test(segments[1])
  ) {
    throw sourceError("Chỉ chấp nhận URL HTTPS của GitHub repository", {
      code: "INVALID_SOURCE_URL",
      status: 400,
    });
  }
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");
  return {
    owner,
    repo,
    sourceKey: `${owner}/${repo}`.toLowerCase(),
    sourceRepo: `${owner}/${repo}`,
    repoUrl: `https://github.com/${owner}/${repo}`,
  };
};

const sanitizeSourceError = (error) => {
  const code = typeof error?.code === "string" ? error.code : "GITHUB_UNAVAILABLE";
  const status = Number.isInteger(error?.status) ? error.status : 503;
  const safeMessages = {
    GITHUB_INVALID_RESPONSE: "GitHub trả dữ liệu không hợp lệ",
    GITHUB_TIMEOUT: "GitHub phản hồi quá thời gian",
    GITHUB_UNAVAILABLE: "Không thể đọc GitHub repository",
    INVALID_SOURCE_URL: "URL GitHub repository không hợp lệ",
    SKILL_RADAR_INVALID_URL: "URL GitHub repository không hợp lệ",
    SOURCE_NOT_FOUND: "Không tìm thấy GitHub repository",
    UPSTREAM_MISMATCH: "GitHub trả về repository không khớp",
    UPSTREAM_TOO_LARGE: "GitHub response quá lớn",
  };
  if (code === "GITHUB_RATE_LIMITED" || code === "SKILL_RADAR_GITHUB_RATE_LIMITED") {
    return sourceError("GitHub API đang giới hạn lượt gọi", {
      code: "SKILL_RADAR_GITHUB_RATE_LIMITED",
      status: 429,
      retryAt: error?.retryAt || null,
    });
  }
  if (code === "INVALID_SOURCE_URL" || code === "SKILL_RADAR_INVALID_URL") {
    return sourceError(safeMessages[code], {
      code: "SKILL_RADAR_INVALID_URL",
      status: 400,
    });
  }
  return sourceError(safeMessages[code] || "Không thể đọc GitHub repository", {
    code,
    status,
  });
};

const readTextLimited = async (response, maxBytes) => {
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (declared > maxBytes) throw Object.assign(new Error("GitHub response quá lớn"), { code: "UPSTREAM_TOO_LARGE" });
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw Object.assign(new Error("GitHub response quá lớn"), { code: "UPSTREAM_TOO_LARGE" });
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw Object.assign(new Error("GitHub response quá lớn"), { code: "UPSTREAM_TOO_LARGE" });
  return text;
};

const readJsonLimited = async (response, maxBytes) => {
  const text = await readTextLimited(response, maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("GitHub trả dữ liệu không hợp lệ"), {
      code: "GITHUB_INVALID_RESPONSE",
      status: 502,
    });
  }
};

const classify = ({ sourceRepo, name, description = "", topics = [], readme = "" }) => {
  const haystack = `${sourceRepo} ${name} ${description} ${topics.join(" ")} ${readme}`.toLowerCase();
  const agentMemory = /(agent.?memory|memory.?hub|long.?term.?memory|code.?graph)/.test(haystack);
  const sourceType = /(^|[-_\s])skills?($|[-_\s])|agent.?skills?|skill\.md/.test(haystack)
    && !agentMemory ? "skill" : "repository";
  if (agentMemory) {
    return { sourceType, domain: "AI Memory", localTargets: ["$ai-chat-system", "AI Memory architecture"] };
  }
  if (/seo|search.?engine/.test(haystack)) {
    return { sourceType, domain: "SEO", localTargets: ["$seo-check"] };
  }
  if (/security|appsec|owasp/.test(haystack)) {
    return { sourceType, domain: "Security", localTargets: ["$audit", "security rules"] };
  }
  if (/react|frontend|design|ui|ux/.test(haystack)) {
    return { sourceType, domain: "UI / Frontend", localTargets: ["$ui-quality", "$ui-check"] };
  }
  return { sourceType, domain: "Công nghệ khác", localTargets: ["Cần review local"] };
};

export const createSkillRadarGithubService = ({
  fetchImpl = globalThis.fetch,
  token = process.env.SKILL_RADAR_GITHUB_TOKEN,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = MAX_RESPONSE_BYTES,
} = {}) => ({
  async analyze(sourceUrl, now = new Date()) {
    if (typeof fetchImpl !== "function") {
      throw Object.assign(new Error("GitHub client chưa được cấu hình"), {
        code: "GITHUB_UNAVAILABLE",
        status: 503,
      });
    }
    const canonical = canonicalizeGithubRepositoryUrl(sourceUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    timeout.unref?.();
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "HTCOACHING-skill-radar",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    try {
      const response = await fetchImpl(
        `https://${GITHUB_API_HOST}/repos/${encodeURIComponent(canonical.owner)}/${encodeURIComponent(canonical.repo)}`,
        { headers, signal: controller.signal, redirect: "error" },
      );
      if (response.status >= 300 && response.status < 400) {
        throw Object.assign(new Error("GitHub redirect không được phép"), {
          code: "GITHUB_UNAVAILABLE",
          status: 502,
        });
      }
      if (!response.ok) {
        const limited = response.status === 429 || response.status === 403;
        const error = new Error(limited ? "GitHub API đang giới hạn lượt gọi" : "Không thể đọc GitHub repository");
        error.code = limited ? "GITHUB_RATE_LIMITED" : response.status === 404 ? "SOURCE_NOT_FOUND" : "GITHUB_UNAVAILABLE";
        error.status = limited ? 429 : response.status === 404 ? 404 : 503;
        error.retryAt = limited ? retryAtFromHeaders(response.headers, now) : null;
        throw error;
      }
      const metadata = await readJsonLimited(response, maxBytes);
      if (String(metadata.full_name || "").toLowerCase() !== canonical.sourceRepo.toLowerCase()) {
        throw Object.assign(new Error("GitHub trả về repository không khớp"), { code: "UPSTREAM_MISMATCH" });
      }
      const readmeResponse = await fetchImpl(
        `https://${GITHUB_API_HOST}/repos/${encodeURIComponent(canonical.owner)}/${encodeURIComponent(canonical.repo)}/readme`,
        {
          headers: { ...headers, Accept: "application/vnd.github.raw+json" },
          signal: controller.signal,
          redirect: "error",
        },
      );
      if (readmeResponse.status >= 300 && readmeResponse.status < 400) {
        throw Object.assign(new Error("GitHub redirect không được phép"), {
          code: "GITHUB_UNAVAILABLE",
          status: 502,
        });
      }
      let readme = "";
      if (readmeResponse.status !== 404) {
        if (!readmeResponse.ok) {
          const limited = readmeResponse.status === 429 || readmeResponse.status === 403;
          throw Object.assign(
            new Error(limited ? "GitHub API đang giới hạn lượt gọi" : "Không thể đọc GitHub README"),
            {
              code: limited ? "GITHUB_RATE_LIMITED" : "GITHUB_UNAVAILABLE",
              status: limited ? 429 : 503,
              retryAt: limited ? retryAtFromHeaders(readmeResponse.headers, now) : null,
            },
          );
        }
        readme = await readTextLimited(readmeResponse, maxBytes);
      }
      const inferred = classify({
        sourceRepo: canonical.sourceRepo,
        name: metadata.name || canonical.repo,
        description: metadata.description || "",
        topics: Array.isArray(metadata.topics) ? metadata.topics.slice(0, 20) : [],
        readme,
      });
      return {
        ...canonical,
        ...inferred,
        name: normalizeGitHubName(metadata.name, canonical.repo),
        summary: normalizeGitHubSummary(metadata.description),
        lifecycle: "candidate",
        drift: "review_due",
        trustTier: "community",
        reviewIntervalDays: 30,
        license: String(metadata.license?.spdx_id || "NOASSERTION").slice(0, 80),
        repositoryArchived: Boolean(metadata.archived || metadata.disabled),
        lastUpstreamCommitAt: asIso(metadata.pushed_at),
        lastCheckedAt: now.toISOString(),
        lastReviewedAt: null,
        nextCheckAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        rateLimitRetryAt: null,
        decision: "pending",
        skillsShUrl: null,
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw sanitizeSourceError(Object.assign(error, {
          code: "GITHUB_TIMEOUT",
          status: 503,
        }));
      }
      throw sanitizeSourceError(error);
    } finally {
      clearTimeout(timeout);
    }
  },
});

export const skillRadarGithubService = createSkillRadarGithubService();
