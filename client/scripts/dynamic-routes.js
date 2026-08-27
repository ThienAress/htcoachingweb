const PRODUCTION_API_BASE = "https://api.htcoachingweb.io.vn/api";
const RECIPE_PAGE_SIZE = 50;
const EXERCISE_PAGE_SIZE = 500;
const DYNAMIC_PAGE_CONCURRENCY = 4;
const MAX_DYNAMIC_PAGES = 1_000;

const emptyContent = () => ({
  stories: [],
  trainers: [],
  blogs: [],
  recipes: [],
  exercises: [],
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
    path: `/recipes?limit=${RECIPE_PAGE_SIZE}&page=1&view=prerender`,
    pagePath: (page) =>
      `/recipes?limit=${RECIPE_PAGE_SIZE}&page=${page}&view=prerender`,
    extract: (response) => response?.data?.data,
    extractPagination: (response) => response?.data?.pagination,
    itemIdentity: (item) => String(item?.slug || ""),
  },
  {
    key: "exercises",
    label: "exercises",
    path: `/exercises?limit=${EXERCISE_PAGE_SIZE}&page=1`,
    pagePath: (page) =>
      `/exercises?limit=${EXERCISE_PAGE_SIZE}&page=${page}`,
    extract: (response) => response?.data?.data,
    extractPagination: (response) => response?.data?.pagination,
    itemIdentity: (item) => String(item?._id || ""),
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

const extractSourceItems = (source, response) => {
  const items = source.extract(response);
  if (!Array.isArray(items)) {
    throw new TypeError("Dynamic route source did not return an array");
  }
  return items;
};

const parsePagination = (source, response) => {
  const pagination = source.extractPagination?.(response);
  const parsed = {
    total: Number(pagination?.total),
    page: Number(pagination?.page),
    limit: Number(pagination?.limit),
    totalPages: Number(pagination?.totalPages),
  };
  if (
    !Number.isSafeInteger(parsed.total) ||
    parsed.total < 0 ||
    !Number.isSafeInteger(parsed.page) ||
    parsed.page < 1 ||
    !Number.isSafeInteger(parsed.limit) ||
    parsed.limit < 1 ||
    !Number.isSafeInteger(parsed.totalPages) ||
    parsed.totalPages < 0 ||
    parsed.totalPages > MAX_DYNAMIC_PAGES ||
    parsed.totalPages !== Math.ceil(parsed.total / parsed.limit)
  ) {
    throw new TypeError("Dynamic route pagination is invalid");
  }
  return parsed;
};

const fetchSourceContent = async ({
  source,
  fetchApi,
  maxAttempts,
  retryDelayMs,
  fetchAllPages,
}) => {
  const firstResponse = await fetchWithRetry({
    fetchApi,
    path: source.path,
    maxAttempts,
    retryDelayMs,
  });
  const items = extractSourceItems(source, firstResponse);

  if (!source.pagePath || !fetchAllPages) return items;
  const firstPagination = parsePagination(source, firstResponse);
  if (firstPagination.page !== 1 || items.length > firstPagination.limit) {
    throw new TypeError("Dynamic route pagination is inconsistent");
  }

  for (
    let batchStart = 2;
    batchStart <= firstPagination.totalPages;
    batchStart += DYNAMIC_PAGE_CONCURRENCY
  ) {
    const batchEnd = Math.min(
      batchStart + DYNAMIC_PAGE_CONCURRENCY - 1,
      firstPagination.totalPages,
    );
    const pages = Array.from(
      { length: batchEnd - batchStart + 1 },
      (_, index) => batchStart + index,
    );
    const batchItems = await Promise.all(
      pages.map(async (page) => {
        const response = await fetchWithRetry({
          fetchApi,
          path: source.pagePath(page),
          maxAttempts,
          retryDelayMs,
        });
        const pagination = parsePagination(source, response);
        const pageItems = extractSourceItems(source, response);
        if (
          pagination.total !== firstPagination.total ||
          pagination.page !== page ||
          pagination.limit !== firstPagination.limit ||
          pagination.totalPages !== firstPagination.totalPages ||
          pageItems.length > pagination.limit
        ) {
          throw new TypeError("Dynamic route pagination changed while fetching");
        }
        return pageItems;
      }),
    );
    items.push(...batchItems.flat());
  }

  if (items.length !== firstPagination.total) {
    throw new TypeError("Dynamic route pagination is incomplete");
  }

  const identities = items.map((item) => source.itemIdentity?.(item) || "");
  if (
    identities.some((identity) => !identity) ||
    new Set(identities).size !== identities.length
  ) {
    throw new TypeError("Dynamic route pagination contains invalid identities");
  }

  return items;
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
  fetchAllPages = false,
}) => {
  if (policy.skip) {
    return { content: emptyContent(), failures: [], skipped: true };
  }

  const content = emptyContent();
  const failures = [];
  await Promise.all(
    sourceDefinitions.map(async (source) => {
      try {
        content[source.key] = await fetchSourceContent({
          source,
          fetchApi,
          maxAttempts,
          retryDelayMs,
          fetchAllPages,
        });
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
