import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
const SOURCE_URL = "https://www.hevyapp.com";
const API_BASE = `${SOURCE_URL}/wp-json/wp/v2`;
const CATEGORY_SLUG = "blog";
const PAGE_SIZE = 100;
export const DEFAULT_OUTPUT_DIR = path.resolve(".local-data/hevy-blog");
const USER_AGENT = "HTCoachingResearchCrawler/1.0";
const EXPORT_SCHEMA_VERSION = 1;
const defaultSleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const decodeHtml = (value) => {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return String(value || "").replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
    (entity, decimal, hexadecimal, name) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal) return String.fromCodePoint(parseInt(hexadecimal, 16));
      return named[String(name).toLowerCase()] ?? entity;
    },
  );
};
const retryDelay = (response, attempt) => {
  const retryAfter = response?.headers?.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(seconds * 1_000, 0);
    const dateDelay = new Date(retryAfter).getTime() - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(dateDelay, 0);
  }
  return Math.min(500 * 2 ** (attempt - 1), 10_000);
};
const transientStatus = (status) =>
  [408, 425, 429, 500, 502, 503, 504].includes(status);
export const requestJson = async (
  url,
  {
    fetchImpl = fetch,
    sleep = defaultSleep,
    maxAttempts = 4,
    timeoutMs = 30_000,
  } = {},
) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return { data: await response.json(), headers: response.headers };
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < maxAttempts &&
        (!response || transientStatus(response.status));
      if (!canRetry) throw error;
      await sleep(retryDelay(response, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
};
const isoUtc = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(".000Z", "Z");
};
const compactObject = (value) =>
  Object.values(value).some(
    (entry) => entry !== null && entry !== undefined && entry !== "",
  )
    ? value
    : null;
export const normalizePost = (post) => {
  const sourceId = Number(post?.id);
  const slug = String(post?.slug || "").trim();
  const title = decodeHtml(post?.title?.rendered).trim();
  if (!Number.isSafeInteger(sourceId) || !slug || !title) {
    throw new Error("Post is missing a valid id, slug, or title");
  }
  const yoast = post?.yoast_head_json || {};
  const embeddedAuthor = post?._embedded?.author?.[0] || {};
  const openGraph = compactObject({
    title: yoast.og_title || null,
    description: yoast.og_description || null,
    url: yoast.og_url || null,
    type: yoast.og_type || null,
    images: Array.isArray(yoast.og_image) ? yoast.og_image : null,
  });
  const twitter = compactObject({
    card: yoast.twitter_card || null,
    creator: yoast.twitter_creator || null,
    site: yoast.twitter_site || null,
    misc: yoast.twitter_misc || null,
  });
  return {
    sourceId,
    sourceUrl: String(post.link || ""),
    title,
    slug,
    contentHtml: String(post?.content?.rendered || ""),
    publishedAt: isoUtc(post.date_gmt || post.date),
    modifiedAt: isoUtc(post.modified_gmt || post.modified),
    author: {
      sourceId: Number(post.author) || null,
      name: decodeHtml(embeddedAuthor.name).trim() || null,
      slug: embeddedAuthor.slug || null,
      url: embeddedAuthor.link || null,
    },
    seo: {
      title: decodeHtml(yoast.title || title),
      description: decodeHtml(yoast.description || ""),
      canonical: yoast.canonical || post.link || null,
      robots: yoast.robots || null,
      openGraph,
      twitter,
    },
  };
};
const fileExists = async (filePath) => {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};
const atomicWriteText = async (filePath, content) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, filePath);
};
const atomicWriteJson = (filePath, value) =>
  atomicWriteText(filePath, `${JSON.stringify(value, null, 2)}\n`);
const readJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
};
const postFileName = (post) => `${post.sourceId}-${post.slug}.json`;
const fetchBlogPosts = async ({ fetchImpl, sleep, requestDelayMs }) => {
  const categoryUrl = new URL(`${API_BASE}/categories`);
  categoryUrl.searchParams.set("slug", CATEGORY_SLUG);
  categoryUrl.searchParams.set("_fields", "id,slug,name");
  const categoryResponse = await requestJson(categoryUrl, { fetchImpl, sleep });
  const category = categoryResponse.data?.[0];
  if (!category?.id) throw new Error("Hevy blog category was not found");
  const posts = [];
  let expectedTotal = null;
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    if (requestDelayMs > 0) await sleep(requestDelayMs);
    const pageUrl = new URL(`${API_BASE}/posts`);
    pageUrl.searchParams.set("categories", String(category.id));
    pageUrl.searchParams.set("per_page", String(PAGE_SIZE));
    pageUrl.searchParams.set("page", String(page));
    pageUrl.searchParams.set("orderby", "id");
    pageUrl.searchParams.set("order", "asc");
    pageUrl.searchParams.set("_embed", "author");
    pageUrl.searchParams.set(
      "_fields",
      "id,slug,link,date,date_gmt,modified,modified_gmt,title,content,author,yoast_head_json,_links,_embedded",
    );
    const response = await requestJson(pageUrl, { fetchImpl, sleep });
    if (!Array.isArray(response.data)) throw new Error("Invalid posts response");
    expectedTotal = Number(response.headers.get("x-wp-total"));
    totalPages = Number(response.headers.get("x-wp-totalpages"));
    if (!Number.isSafeInteger(expectedTotal) || !Number.isSafeInteger(totalPages)) {
      throw new Error("WordPress pagination headers are invalid");
    }
    posts.push(...response.data);
  }
  const uniquePosts = [...new Map(posts.map((post) => [post.id, post])).values()];
  if (uniquePosts.length !== expectedTotal) {
    throw new Error(
      `Incomplete crawl: expected ${expectedTotal}, received ${uniquePosts.length}`,
    );
  }
  return { category, posts: uniquePosts, totalPages };
};
export const runCrawler = async ({
  fetchImpl = fetch,
  outputDir = DEFAULT_OUTPUT_DIR,
  sleep = defaultSleep,
  now = () => new Date().toISOString(),
  requestDelayMs = 250,
} = {}) => {
  const startedAt = now();
  const postsDir = path.join(outputDir, "posts");
  const checkpointPath = path.join(outputDir, "checkpoint.json");
  await mkdir(postsDir, { recursive: true });
  const checkpoint = await readJson(checkpointPath, {
    version: 1,
    source: SOURCE_URL,
    category: CATEGORY_SLUG,
    completed: {},
  });
  const { category, posts, totalPages } = await fetchBlogPosts({
    fetchImpl,
    sleep,
    requestDelayMs,
  });
  const normalizedPosts = [];
  const errors = [];
  let written = 0;
  let updated = 0;
  let unchanged = 0;
  for (const rawPost of posts) {
    try {
      const post = normalizePost(rawPost);
      const fileName = postFileName(post);
      const filePath = path.join(postsDir, fileName);
      const previous = checkpoint.completed[String(post.sourceId)];
      if (
        previous?.modifiedAt === post.modifiedAt &&
        previous?.exportSchemaVersion === EXPORT_SCHEMA_VERSION &&
        previous?.file === fileName &&
        (await fileExists(filePath))
      ) {
        unchanged += 1;
      } else {
        await atomicWriteJson(filePath, post);
        if (previous) updated += 1;
        else written += 1;
        if (previous?.file && previous.file !== fileName) {
          await unlink(path.join(postsDir, previous.file)).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
      }
      checkpoint.completed[String(post.sourceId)] = {
        modifiedAt: post.modifiedAt,
        exportSchemaVersion: EXPORT_SCHEMA_VERSION,
        file: fileName,
      };
      checkpoint.updatedAt = now();
      await atomicWriteJson(checkpointPath, checkpoint);
      normalizedPosts.push(post);
    } catch (error) {
      errors.push({ sourceId: rawPost?.id || null, message: error.message });
    }
  }
  normalizedPosts.sort((left, right) =>
    String(right.publishedAt).localeCompare(String(left.publishedAt)),
  );
  await atomicWriteJson(path.join(outputDir, "all-posts.json"), normalizedPosts);
  await atomicWriteText(
    path.join(outputDir, "errors.jsonl"),
    errors.map((error) => JSON.stringify(error)).join("\n") +
      (errors.length ? "\n" : ""),
  );
  const manifest = {
    status: errors.length ? "partial" : "complete",
    source: SOURCE_URL,
    category: { id: category.id, slug: category.slug, name: category.name },
    startedAt,
    completedAt: now(),
    discovered: posts.length,
    exported: normalizedPosts.length,
    written,
    updated,
    unchanged,
    failed: errors.length,
    pagesFetched: totalPages,
    imagesDownloaded: 0,
    outputDir: path.resolve(outputDir),
  };
  await atomicWriteJson(path.join(outputDir, "manifest.json"), manifest);
  return manifest;
};
