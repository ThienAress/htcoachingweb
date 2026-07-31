import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  convertBlogExport,
  htmlToMarkdown,
  renderPostMarkdown,
} from "./hevy-blog-markdown-core.mjs";

const samplePost = {
  sourceId: 42,
  sourceUrl: "https://www.hevyapp.com/sample-post/",
  title: "Sample: Post",
  slug: "sample-post",
  contentHtml: `
    <style>.hidden { display: none; }</style>
    <h2>Key Takeaways</h2>
    <p>Use <strong>good form</strong> and read <a href="https://example.com/guide">the guide</a>.</p>
    <ol><li>First step</li><li>Second step</li></ol>
    <table><thead><tr><th>Exercise</th><th>Reps</th></tr></thead><tbody><tr><td>Squat</td><td>8</td></tr></tbody></table>
    <figure><img data-src="https://images.example.com/squat.jpg" src="data:image/gif;base64,stub" alt="Squat"><figcaption>Squat form</figcaption></figure>
    <iframe src="https://www.youtube.com/embed/example"></iframe>
  `,
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
  },
};

test("htmlToMarkdown preserves readable article structures", () => {
  const markdown = htmlToMarkdown(samplePost.contentHtml);

  assert.match(markdown, /## Key Takeaways/);
  assert.match(markdown, /1\.\s+First step/);
  assert.match(markdown, /\| Exercise \| Reps \|/);
  assert.match(markdown, /!\[Squat\]\(https:\/\/images\.example\.com\/squat\.jpg\)/);
  assert.match(markdown, /\[Embedded media\]\(https:\/\/www\.youtube\.com\/embed\/example\)/);
  assert.doesNotMatch(markdown, /display:\s*none/);
});

test("renderPostMarkdown adds front matter and a visible source link", () => {
  const markdown = renderPostMarkdown(samplePost);

  assert.match(markdown, /^---\nsource_id: 42\n/);
  assert.match(markdown, /title: "Sample: Post"/);
  assert.match(markdown, /# Sample: Post/);
  assert.match(markdown, /> Original: \[Hevy\]\(https:\/\/www\.hevyapp\.com\/sample-post\/\)/);
});

test("convertBlogExport writes one Markdown file per JSON post and an index", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hevy-markdown-"));
  const inputDir = path.join(root, "input");
  const outputDir = path.join(root, "markdown");

  try {
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(inputDir, { recursive: true }),
    );
    await writeFile(
      path.join(inputDir, "all-posts.json"),
      `${JSON.stringify([samplePost])}\n`,
      "utf8",
    );

    const manifest = await convertBlogExport({
      inputDir,
      outputDir,
      now: () => "2026-07-30T04:00:00.000Z",
    });
    const article = await readFile(path.join(outputDir, "sample-post.md"), "utf8");
    const index = await readFile(path.join(outputDir, "README.md"), "utf8");

    assert.equal(manifest.exported, 1);
    assert.match(article, /## Key Takeaways/);
    assert.match(index, /\[Sample: Post\]\(\.\/sample-post\.md\)/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
