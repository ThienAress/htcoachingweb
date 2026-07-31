import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  normalizePost,
  requestJson,
  runCrawler,
} from "./hevy-blog-crawler-core.mjs";

const jsonResponse = (body, options = {}) =>
  new Response(JSON.stringify(body), {
    status: options.status || 200,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

test("requestJson retries a transient response", async () => {
  let attempts = 0;
  const waits = [];
  const fetchImpl = async () => {
    attempts += 1;
    return attempts === 1
      ? jsonResponse({ message: "busy" }, { status: 503 })
      : jsonResponse({ ok: true });
  };

  const result = await requestJson("https://example.test/posts", {
    fetchImpl,
    sleep: async (milliseconds) => waits.push(milliseconds),
    maxAttempts: 3,
  });

  assert.deepEqual(result.data, { ok: true });
  assert.equal(attempts, 2);
  assert.equal(waits.length, 1);
});

test("normalizePost keeps the requested article and SEO fields", () => {
  const result = normalizePost({
    id: 42,
    slug: "sample-post",
    link: "https://www.hevyapp.com/sample-post/",
    date_gmt: "2026-01-01T10:00:00",
    modified_gmt: "2026-01-02T10:00:00",
    title: { rendered: "Sample &amp; Post" },
    content: { rendered: "<p>Raw HTML</p>" },
    author: 7,
    yoast_head_json: {
      title: "SEO title",
      description: "SEO description",
      canonical: "https://www.hevyapp.com/sample-post/",
      robots: { index: "index", follow: "follow" },
    },
    _embedded: {
      author: [
        {
          id: 7,
          name: "Author Name",
          slug: "author-name",
          link: "https://www.hevyapp.com/author/author-name/",
        },
      ],
    },
  });

  assert.deepEqual(result, {
    sourceId: 42,
    sourceUrl: "https://www.hevyapp.com/sample-post/",
    title: "Sample & Post",
    slug: "sample-post",
    contentHtml: "<p>Raw HTML</p>",
    publishedAt: "2026-01-01T10:00:00Z",
    modifiedAt: "2026-01-02T10:00:00Z",
    author: {
      sourceId: 7,
      name: "Author Name",
      slug: "author-name",
      url: "https://www.hevyapp.com/author/author-name/",
    },
    seo: {
      title: "SEO title",
      description: "SEO description",
      canonical: "https://www.hevyapp.com/sample-post/",
      robots: { index: "index", follow: "follow" },
      openGraph: null,
      twitter: null,
    },
  });
});

test("runCrawler writes resumable, deduplicated JSON artifacts", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "hevy-crawler-"));
  const post = {
    id: 42,
    slug: "sample-post",
    link: "https://www.hevyapp.com/sample-post/",
    date_gmt: "2026-01-01T10:00:00",
    modified_gmt: "2026-01-02T10:00:00",
    title: { rendered: "Sample Post" },
    content: { rendered: "<p>Raw HTML</p>" },
    author: 7,
    yoast_head_json: {},
    _embedded: { author: [{ id: 7, name: "Author", slug: "author" }] },
  };
  const fetchImpl = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/categories")) {
      return jsonResponse([{ id: 20, slug: "blog" }]);
    }
    assert.match(url.searchParams.get("_fields") || "", /_links/);
    return jsonResponse([post], {
      headers: { "x-wp-total": "1", "x-wp-totalpages": "1" },
    });
  };

  try {
    const firstRun = await runCrawler({
      fetchImpl,
      outputDir,
      sleep: async () => {},
      now: () => "2026-07-30T00:00:00.000Z",
    });
    const secondRun = await runCrawler({
      fetchImpl,
      outputDir,
      sleep: async () => {},
      now: () => "2026-07-30T01:00:00.000Z",
    });
    const allPosts = JSON.parse(
      await readFile(path.join(outputDir, "all-posts.json"), "utf8"),
    );
    const checkpoint = JSON.parse(
      await readFile(path.join(outputDir, "checkpoint.json"), "utf8"),
    );

    assert.equal(firstRun.written, 1);
    assert.equal(secondRun.unchanged, 1);
    assert.equal(allPosts.length, 1);
    assert.equal(Object.keys(checkpoint.completed).length, 1);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
