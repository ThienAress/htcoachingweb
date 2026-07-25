import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByIdAndDelete: vi.fn(),
  findOne: vi.fn(),
  scheduleNetlifyBuild: vi.fn(),
}));

vi.mock("../../models/BlogPost.js", () => ({
  default: {
    create: mocks.create,
    findById: mocks.findById,
    findByIdAndDelete: mocks.findByIdAndDelete,
    findOne: mocks.findOne,
  },
}));

vi.mock("../../utils/triggerBuild.js", () => ({
  scheduleNetlifyBuild: mocks.scheduleNetlifyBuild,
}));

import {
  createBlogPost,
  deleteBlogPost,
  updateBlogPost,
} from "../blog.controller.js";

const makePost = (overrides = {}) => ({
  _id: "post-1",
  title: "Bài viết gốc",
  slug: "bai-viet-goc",
  content: "<p>Nội dung gốc</p>",
  excerpt: "Mô tả ngắn",
  category: "tap-luyen",
  subCategory: "",
  tags: ["gym"],
  coverImage: "https://example.com/cover.jpg",
  author: null,
  metaTitle: "SEO gốc",
  metaDescription: "Mô tả SEO gốc",
  focusKeyword: "tập gym",
  status: "draft",
  featured: false,
  publishedAt: null,
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const bodyFromPost = (post, overrides = {}) => ({
  title: post.title,
  slug: post.slug,
  content: post.content,
  excerpt: post.excerpt,
  category: post.category,
  subCategory: post.subCategory,
  tags: post.tags,
  coverImage: post.coverImage,
  author: post.author,
  metaTitle: post.metaTitle,
  metaDescription: post.metaDescription,
  focusKeyword: post.focusKeyword,
  status: post.status,
  featured: post.featured,
  ...overrides,
});

const makeResponse = () => {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

const runUpdate = async (post, bodyOverrides = {}) => {
  mocks.findById.mockResolvedValue(post);
  mocks.findOne.mockResolvedValue(null);
  await updateBlogPost(
    { params: { id: post._id }, body: bodyFromPost(post, bodyOverrides) },
    makeResponse(),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("blog Netlify build policy", () => {
  it("schedules a build when a new post is published", async () => {
    const post = makePost({ status: "published", publishedAt: new Date() });
    mocks.findOne.mockResolvedValue(null);
    mocks.create.mockResolvedValue(post);

    await createBlogPost({ body: bodyFromPost(post) }, makeResponse());

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith("blog_published");
  });

  it("does not schedule a build while a post remains draft", async () => {
    await runUpdate(makePost(), { title: "Draft đã sửa" });

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("schedules a build when a draft becomes published", async () => {
    await runUpdate(makePost(), { status: "published" });

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith("blog_published");
  });

  it.each([
    ["content", "<p>Nội dung public mới</p>"],
    ["metaTitle", "SEO title mới"],
    ["slug", "slug-public-moi"],
  ])("schedules a build when published %s changes", async (field, value) => {
    const post = makePost({ status: "published", publishedAt: new Date() });

    await runUpdate(post, { [field]: value });

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith("blog_updated");
  });

  it("does not schedule a build for an unchanged published post", async () => {
    const post = makePost({ status: "published", publishedAt: new Date() });

    await runUpdate(post);

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("schedules a build when a published post becomes draft", async () => {
    const post = makePost({ status: "published", publishedAt: new Date() });

    await runUpdate(post, { status: "draft" });

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith("blog_unpublished");
  });

  it("schedules a build when a published post is deleted", async () => {
    mocks.findByIdAndDelete.mockResolvedValue(
      makePost({ status: "published", publishedAt: new Date() }),
    );

    await deleteBlogPost({ params: { id: "post-1" } }, makeResponse());

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith("blog_deleted");
  });
});
