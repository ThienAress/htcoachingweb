const PRODUCTION_API_BASE = "https://api.htcoachingweb.io.vn/api";

const emptyContent = () => ({
  stories: [],
  trainers: [],
  blogs: [],
  recipes: [],
});

const sourceDefinitions = [
  {
    key: "stories",
    label: "customer stories",
    path: "/customer-stories?limit=100",
    extract: (response) => response?.data?.data,
  },
  {
    key: "trainers",
    label: "trainers",
    path: "/trainers",
    extract: (response) =>
      Array.isArray(response?.data?.data) ? response.data.data : response?.data,
  },
  {
    key: "blogs",
    label: "blog posts",
    path: "/blog?limit=100",
    extract: (response) => response?.data?.data,
  },
  {
    key: "recipes",
    label: "recipes",
    path: "/recipes?limit=500",
    extract: (response) => response?.data?.data,
  },
];

const failureReason = (error) => {
  const status = Number(error?.response?.status);
  if (Number.isInteger(status) && status >= 100 && status <= 599) {
    return "HTTP " + status;
  }
  const code = String(error?.code || "");
  if (/^[A-Z0-9_]{2,40}$/.test(code)) return code;
  return error?.name === "TypeError" ? "invalid response" : "request failed";
};

const isTransientFailure = (error) => {
  const status = Number(error?.response?.status);
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true;
  return [
    "ECONNABORTED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ETIMEDOUT",
  ].includes(String(error?.code || "").toUpperCase());
};

const fetchWithRetry = async ({
  fetchApi,
  path,
  maxAttempts,
  retryDelayMs,
}) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchApi(path);
    } catch (error) {
      lastError = error;
      if (!isTransientFailure(error) || attempt === maxAttempts) throw error;
      if (retryDelayMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs * attempt),
        );
      }
    }
  }
  throw lastError;
};

export const resolveDynamicRoutePolicy = (env = process.env) => {
  const skip = env.SKIP_DYNAMIC_ROUTES === "true";
  const netlifyProduction =
    env.NETLIFY === "true" && env.CONTEXT === "production";
  const requireDynamic =
    env.REQUIRE_DYNAMIC_ROUTES === "true" || netlifyProduction;

  if (skip && requireDynamic) {
    throw new Error(
      "SKIP_DYNAMIC_ROUTES cannot be enabled for a strict production build",
    );
  }

  return { skip, requireDynamic, netlifyProduction };
};

export const normalizeDynamicRouteApiUrl = (value, policy) => {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new Error("Dynamic route API URL is invalid");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Dynamic route API URL must be a credential-free HTTPS URL");
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
  const normalized = parsed.origin + normalizedPath;
  if (policy.netlifyProduction && normalized !== PRODUCTION_API_BASE) {
    throw new Error(
      "Netlify production builds must use the approved production API",
    );
  }
  return normalized;
};

export const fetchDynamicRouteContent = async ({
  fetchApi,
  policy,
  logger = console,
  maxAttempts = policy.requireDynamic ? 3 : 2,
  retryDelayMs = 500,
}) => {
  if (policy.skip) {
    return { content: emptyContent(), failures: [], skipped: true };
  }

  const content = emptyContent();
  const failures = [];
  await Promise.all(
    sourceDefinitions.map(async (source) => {
      try {
        const response = await fetchWithRetry({
          fetchApi,
          path: source.path,
          maxAttempts,
          retryDelayMs,
        });
        const items = source.extract(response);
        if (!Array.isArray(items)) {
          throw new TypeError("Dynamic route source did not return an array");
        }
        content[source.key] = items;
      } catch (error) {
        const failure = {
          key: source.key,
          label: source.label,
          reason: failureReason(error),
        };
        failures.push(failure);
        logger.error(
          "Failed to fetch " + source.label + " for dynamic routes: " + failure.reason,
        );
      }
    }),
  );

  failures.sort((left, right) => left.key.localeCompare(right.key));
  if (policy.requireDynamic && failures.length > 0) {
    throw new Error(
      "Required dynamic route sources failed: " +
        failures
          .map((failure) => failure.label + " (" + failure.reason + ")")
          .join(", "),
    );
  }

  return { content, failures, skipped: false };
};

export const dynamicRouteTestConstants = {
  productionApiBase: PRODUCTION_API_BASE,
  sourceCount: sourceDefinitions.length,
};
