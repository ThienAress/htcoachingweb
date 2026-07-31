import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { gfm } from "@truto/turndown-plugin-gfm";
import TurndownService from "turndown";

export const DEFAULT_INPUT_DIR = path.resolve(".local-data/hevy-blog");

const createTurndownService = () => {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  service.use(gfm);
  service.remove(["style", "script", "noscript", "form", "button", "svg"]);
  service.addRule("lazyImages", {
    filter: "img",
    replacement: (_content, node) => {
      const source =
        node.getAttribute("data-lazy-src") ||
        node.getAttribute("data-src") ||
        node.getAttribute("src") ||
        "";
      if (!source || source.startsWith("data:")) return "";
      const alt = String(node.getAttribute("alt") || "Image")
        .replace(/[\[\]]/g, "")
        .trim();
      const destination = /[\s()]/.test(source)
        ? `<${source.replace(/>/g, "%3E")}>`
        : source;
      return `![${alt}](${destination})`;
    },
  });
  service.addRule("embeddedMedia", {
    filter: "iframe",
    replacement: (_content, node) => {
      const source = String(node.getAttribute("src") || "").trim();
      return source ? `[Embedded media](${source})` : "";
    },
  });

  return service;
};

const yamlValue = (value) =>
  value === null || value === undefined || value === ""
    ? "null"
    : JSON.stringify(value);

const markdownLinkText = (value) =>
  String(value || "").replace(/([\\[\]])/g, "\\$1");

const validatePost = (post) => {
  if (!Number.isSafeInteger(post?.sourceId)) {
    throw new Error("Post is missing a valid sourceId");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(post?.slug || ""))) {
    throw new Error(`Post ${post.sourceId} has an unsafe slug`);
  }
  if (!String(post?.title || "").trim()) {
    throw new Error(`Post ${post.sourceId} is missing a title`);
  }
  if (!String(post?.contentHtml || "").trim()) {
    throw new Error(`Post ${post.sourceId} is missing contentHtml`);
  }
};

export const htmlToMarkdown = (html) => {
  const markdown = createTurndownService().turndown(String(html || ""));
  return markdown
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const renderPostMarkdown = (post) => {
  validatePost(post);
  const body = htmlToMarkdown(post.contentHtml);
  const authorName = post.author?.name || null;
  const metadata = [
    "---",
    `source_id: ${post.sourceId}`,
    `title: ${yamlValue(post.title)}`,
    `slug: ${yamlValue(post.slug)}`,
    `source_url: ${yamlValue(post.sourceUrl)}`,
    `published_at: ${yamlValue(post.publishedAt)}`,
    `modified_at: ${yamlValue(post.modifiedAt)}`,
    `author_name: ${yamlValue(authorName)}`,
    `author_url: ${yamlValue(post.author?.url)}`,
    `seo_title: ${yamlValue(post.seo?.title)}`,
    `seo_description: ${yamlValue(post.seo?.description)}`,
    `canonical: ${yamlValue(post.seo?.canonical)}`,
    `robots: ${yamlValue(post.seo?.robots)}`,
    "---",
  ];
  const visibleMetadata = [
    `> Original: [Hevy](${post.sourceUrl})`,
    authorName ? `> Author: ${authorName}` : null,
    post.publishedAt ? `> Published: ${post.publishedAt.slice(0, 10)}` : null,
  ].filter(Boolean);

  return `${metadata.join("\n")}\n\n# ${post.title}\n\n${visibleMetadata.join("\n>\n")}\n\n${body}\n`;
};

const atomicWrite = async (filePath, content) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, filePath);
};

const renderIndex = (posts, generatedAt) => {
  const lines = [
    "# Hevy Blog Markdown Export",
    "",
    `- Source: https://www.hevyapp.com/blog/`,
    `- Generated: ${generatedAt}`,
    `- Articles: ${posts.length}`,
    "- Images: referenced by original URL; not downloaded",
    "",
    "## Articles",
    "",
  ];
  for (const post of posts) {
    const date = post.publishedAt?.slice(0, 10) || "Unknown date";
    const author = post.author?.name ? ` — ${post.author.name}` : "";
    lines.push(
      `- ${date} — [${markdownLinkText(post.title)}](./${post.slug}.md)${author}`,
    );
  }
  return `${lines.join("\n")}\n`;
};

export const convertBlogExport = async ({
  inputDir = DEFAULT_INPUT_DIR,
  outputDir = path.join(inputDir, "markdown"),
  now = () => new Date().toISOString(),
} = {}) => {
  const sourcePath = path.join(inputDir, "all-posts.json");
  const posts = JSON.parse(await readFile(sourcePath, "utf8"));
  if (!Array.isArray(posts)) throw new Error("all-posts.json must contain an array");

  const slugs = new Set();
  for (const post of posts) {
    validatePost(post);
    if (slugs.has(post.slug)) throw new Error(`Duplicate post slug: ${post.slug}`);
    slugs.add(post.slug);
  }
  posts.sort((left, right) =>
    String(right.publishedAt).localeCompare(String(left.publishedAt)),
  );

  await mkdir(outputDir, { recursive: true });
  for (const post of posts) {
    await atomicWrite(
      path.join(outputDir, `${post.slug}.md`),
      renderPostMarkdown(post),
    );
  }

  const generatedAt = now();
  await atomicWrite(path.join(outputDir, "README.md"), renderIndex(posts, generatedAt));
  const manifest = {
    status: "complete",
    source: "https://www.hevyapp.com/blog/",
    generatedAt,
    input: path.resolve(sourcePath),
    output: path.resolve(outputDir),
    discovered: posts.length,
    exported: posts.length,
    imagesDownloaded: 0,
    format: "markdown",
  };
  await atomicWrite(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
};
