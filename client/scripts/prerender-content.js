import { mapWithConcurrency } from "./prerender-routes.js";

const PAGE_SIZE = 50;
const PAGE_CONCURRENCY = 4;
const MAX_PAGES = 1_000;
const DETAIL_CONCURRENCY = 2;
const DETAIL_MAX_ATTEMPTS = 3;
const EXERCISE_PAGE_SIZE = 500;

const STORY_ROUTE_PREFIX = "/ket-qua-khach-hang/";
const BLOG_ROUTE_PREFIX = "/blog/";
const EXERCISE_ROUTE_PREFIX = "/exercises/";
const STORY_RELATED_PATH = "/customer-stories?limit=20&lang=vi";

const exercisePagePath = (page) =>
  `/exercises?limit=${EXERCISE_PAGE_SIZE}&page=${page}`;

const recipePagePath = (page) =>
  `/recipes?limit=${PAGE_SIZE}&page=${page}&view=prerender`;

const parsePage = (response, expectedPage) => {
  const items = response?.data?.data;
  const pagination = response?.data?.pagination;
  const parsed = {
    total: Number(pagination?.total),
    page: Number(pagination?.page),
    limit: Number(pagination?.limit),
    totalPages: Number(pagination?.totalPages),
  };
  if (
    !Array.isArray(items) ||
    !Number.isSafeInteger(parsed.total) ||
    parsed.total < 0 ||
    parsed.page !== expectedPage ||
    parsed.limit !== PAGE_SIZE ||
    !Number.isSafeInteger(parsed.totalPages) ||
    parsed.totalPages < 0 ||
    parsed.totalPages > MAX_PAGES ||
    parsed.totalPages !== Math.ceil(parsed.total / parsed.limit) ||
    items.length > parsed.limit
  ) {
    throw new Error("Prerender recipe pagination is invalid");
  }
  return { items, pagination: parsed };
};

export const fetchPrerenderRecipes = async (fetchApi) => {
  const first = parsePage(await fetchApi(recipePagePath(1)), 1);
  const remainingPages = Array.from(
    { length: Math.max(first.pagination.totalPages - 1, 0) },
    (_, index) => index + 2,
  );
  const remaining = await mapWithConcurrency(
    remainingPages,
    PAGE_CONCURRENCY,
    async (page) => parsePage(await fetchApi(recipePagePath(page)), page),
  );
  const recipes = [first, ...remaining].flatMap((entry) => entry.items);
  const slugs = recipes.map((recipe) => String(recipe?.slug || "").trim());

  if (
    recipes.length !== first.pagination.total ||
    slugs.some((slug) => !slug) ||
    new Set(slugs).size !== slugs.length
  ) {
    throw new Error("Prerender recipe content is incomplete");
  }
  return recipes;
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

const fetchWithRetry = async (
  fetchApi,
  path,
  { maxAttempts = DETAIL_MAX_ATTEMPTS, retryDelayMs = 500 } = {},
) => {
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

const detailDescriptorForRoute = (route) => {
  if (route.startsWith(STORY_ROUTE_PREFIX)) {
    const slug = route.slice(STORY_ROUTE_PREFIX.length);
    return slug
      ? {
          kind: "story",
          slug,
          path: `/customer-stories/${encodeURIComponent(slug)}?lang=vi`,
        }
      : null;
  }
  if (route.startsWith(BLOG_ROUTE_PREFIX)) {
    const slug = route.slice(BLOG_ROUTE_PREFIX.length);
    return slug
      ? {
          kind: "blog",
          slug,
          path: `/blog/${encodeURIComponent(slug)}?view=prerender`,
        }
      : null;
  }
  if (route.startsWith(EXERCISE_ROUTE_PREFIX)) {
    const [exerciseId] = route
      .slice(EXERCISE_ROUTE_PREFIX.length)
      .split("/");
    return /^[a-f0-9]{24}$/i.test(exerciseId)
      ? {
          kind: "exercise",
          id: exerciseId,
          path: `/exercises/${encodeURIComponent(exerciseId)}`,
        }
      : null;
  }
  return null;
};

const assertDetailResponse = (response, descriptor) => {
  const body = response?.data;
  if (
    body?.success !== true ||
    !body.data ||
    (descriptor.kind === "exercise"
      ? String(body.data._id || "") !== descriptor.id
      : String(body.data.slug || "") !== descriptor.slug)
  ) {
    throw new Error(`Invalid prerender ${descriptor.kind} detail response`);
  }
  return body;
};

const parseExercisePage = (response, expectedPage) => {
  const body = response?.data;
  const items = body?.data;
  const pagination = body?.pagination;
  const parsed = {
    total: Number(pagination?.total),
    page: Number(pagination?.page),
    limit: Number(pagination?.limit),
    totalPages: Number(pagination?.totalPages),
  };
  if (
    body?.success !== true ||
    !Array.isArray(items) ||
    !Number.isSafeInteger(parsed.total) ||
    parsed.total < 0 ||
    parsed.page !== expectedPage ||
    parsed.limit !== EXERCISE_PAGE_SIZE ||
    !Number.isSafeInteger(parsed.totalPages) ||
    parsed.totalPages < 0 ||
    parsed.totalPages > MAX_PAGES ||
    parsed.totalPages !== Math.ceil(parsed.total / parsed.limit) ||
    items.length > parsed.limit
  ) {
    throw new Error("Prerender exercise pagination is invalid");
  }
  return { items, pagination: parsed };
};

const fetchPrerenderExercises = async (
  descriptors,
  fetchApi,
  retryOptions,
) => {
  if (descriptors.length === 0) return [];

  const first = parseExercisePage(
    await fetchWithRetry(fetchApi, exercisePagePath(1), retryOptions),
    1,
  );
  const remainingPages = Array.from(
    { length: Math.max(first.pagination.totalPages - 1, 0) },
    (_, index) => index + 2,
  );
  const remaining = await mapWithConcurrency(
    remainingPages,
    PAGE_CONCURRENCY,
    async (page) =>
      parseExercisePage(
        await fetchWithRetry(fetchApi, exercisePagePath(page), retryOptions),
        page,
      ),
  );
  const exercises = [first, ...remaining].flatMap((entry) => entry.items);
  const exerciseIds = exercises.map((exercise) =>
    String(exercise?._id || ""),
  );
  const byId = new Map(
    exercises.map((exercise, index) => [exerciseIds[index], exercise]),
  );
  const requiredIds = descriptors.map(({ id }) => id);

  if (
    exercises.length !== first.pagination.total ||
    remaining.some(
      ({ pagination }) =>
        pagination.total !== first.pagination.total ||
        pagination.limit !== first.pagination.limit ||
        pagination.totalPages !== first.pagination.totalPages,
    ) ||
    exerciseIds.some((id) => !/^[a-f0-9]{24}$/i.test(id)) ||
    byId.size !== exercises.length ||
    requiredIds.some((id) => !byId.has(id))
  ) {
    throw new Error("Prerender exercise content is incomplete");
  }

  return requiredIds.map((id) => ({
    descriptor: { kind: "exercise", id },
    body: { success: true, data: byId.get(id) },
  }));
};

export const fetchPrerenderPageData = async (
  routes,
  fetchApi,
  retryOptions,
) => {
  const descriptors = routes
    .map(detailDescriptorForRoute)
    .filter(Boolean);
  const uniqueDescriptors = [
    ...new Map(
      descriptors.map((descriptor) => [
        `${descriptor.kind}:${descriptor.id || descriptor.slug}`,
        descriptor,
      ]),
    ).values(),
  ];

  const storyListResponse = uniqueDescriptors.some(
    ({ kind }) => kind === "story",
  )
    ? await fetchWithRetry(fetchApi, STORY_RELATED_PATH, retryOptions)
    : null;
  if (
    storyListResponse &&
    (storyListResponse.data?.success !== true ||
      !Array.isArray(storyListResponse.data?.data))
  ) {
    throw new Error("Invalid prerender customer story list response");
  }

  const exerciseDescriptors = uniqueDescriptors.filter(
    ({ kind }) => kind === "exercise",
  );
  const contentDescriptors = uniqueDescriptors.filter(
    ({ kind }) => kind !== "exercise",
  );
  const [contentDetails, exerciseDetails] = await Promise.all([
    mapWithConcurrency(
      contentDescriptors,
      DETAIL_CONCURRENCY,
      async (descriptor) => ({
        descriptor,
        body: assertDetailResponse(
          await fetchWithRetry(fetchApi, descriptor.path, retryOptions),
          descriptor,
        ),
      })),
    fetchPrerenderExercises(exerciseDescriptors, fetchApi, retryOptions),
  ]);
  const details = [...contentDetails, ...exerciseDetails];

  return {
    storyList: storyListResponse?.data || null,
    stories: new Map(
      details
        .filter(({ descriptor }) => descriptor.kind === "story")
        .map(({ descriptor, body }) => [descriptor.slug, body]),
    ),
    blogs: new Map(
      details
        .filter(({ descriptor }) => descriptor.kind === "blog")
        .map(({ descriptor, body }) => [descriptor.slug, body]),
    ),
    exercises: new Map(
      details
        .filter(({ descriptor }) => descriptor.kind === "exercise")
        .map(({ descriptor, body }) => [descriptor.id, body]),
    ),
  };
};

export const createPrerenderResponseCache = (
  recipes,
  pageData = {},
) => ({
  recipes: new Map(recipes.map((recipe) => [String(recipe.slug), recipe])),
  storyList: pageData.storyList || null,
  stories: pageData.stories || new Map(),
  blogs: pageData.blogs || new Map(),
  exercises: pageData.exercises || new Map(),
});

const jsonResponse = (status, body) => ({
  status,
  contentType: "application/json; charset=utf-8",
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(body),
});

export const responseForPrerenderRequest = (requestUrl, cache) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(requestUrl);
  } catch {
    return null;
  }
  const { pathname, searchParams } = parsedUrl;

  if (pathname.endsWith("/api/user/me")) {
    return jsonResponse(401, { success: false, message: "Unauthenticated" });
  }

  if (
    pathname.endsWith("/api/customer-stories") &&
    searchParams.get("limit") === "20" &&
    searchParams.get("lang") === "vi" &&
    cache.storyList
  ) {
    return jsonResponse(200, cache.storyList);
  }

  const storyMarker = "/api/customer-stories/";
  const storyMarkerIndex = pathname.lastIndexOf(storyMarker);
  if (storyMarkerIndex !== -1) {
    const slug = decodeURIComponent(
      pathname.slice(storyMarkerIndex + storyMarker.length),
    );
    const story = cache.stories.get(slug);
    if (story) return jsonResponse(200, story);
  }

  const blogMarker = "/api/blog/";
  const blogMarkerIndex = pathname.lastIndexOf(blogMarker);
  if (blogMarkerIndex !== -1) {
    const slug = decodeURIComponent(
      pathname.slice(blogMarkerIndex + blogMarker.length),
    );
    const blog = cache.blogs.get(slug);
    if (blog) return jsonResponse(200, blog);
  }

  const exerciseMarker = "/api/exercises/";
  const exerciseMarkerIndex = pathname.lastIndexOf(exerciseMarker);
  if (exerciseMarkerIndex !== -1) {
    const suffix = pathname.slice(
      exerciseMarkerIndex + exerciseMarker.length,
    );
    const [exerciseId, child] = suffix.split("/");
    const exercise = cache.exercises.get(decodeURIComponent(exerciseId));
    if (child === "reviews") {
      return exercise
        ? jsonResponse(200, {
            success: true,
            data: {
              items: [],
              summary: { total: 0, averageRating: 0 },
              myReview: null,
              pagination: {
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 0,
              },
            },
          })
        : jsonResponse(404, {
            success: false,
            message: "Exercise not found",
          });
    }
    if (!child) {
      return exercise
        ? jsonResponse(200, exercise)
        : jsonResponse(404, {
            success: false,
            message: "Exercise not found",
          });
    }
  }

  const marker = "/api/recipes/detail/";
  const markerIndex = pathname.lastIndexOf(marker);
  if (markerIndex === -1) return null;

  const slug = decodeURIComponent(pathname.slice(markerIndex + marker.length));
  const recipe = cache.recipes.get(slug);
  return recipe
    ? jsonResponse(200, { success: true, data: recipe })
    : jsonResponse(404, { success: false, message: "Recipe not found" });
};
