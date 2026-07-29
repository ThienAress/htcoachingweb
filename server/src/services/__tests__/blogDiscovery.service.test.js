import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  clearCollections,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import BlogPost from "../../models/BlogPost.js";
import { getDiscoveryBlogPosts } from "../blogDiscovery.service.js";

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

const createPost = (slug, category, overrides = {}) =>
  BlogPost.create({
    title: slug,
    slug,
    category,
    status: "published",
    publishedAt: new Date(),
    ...overrides,
  });

describe("getDiscoveryBlogPosts", () => {
  it("trả tối đa 5 bài đã publish thuộc chủ đề khác bài hiện tại", async () => {
    const current = await createPost("current", "tap-luyen");
    await Promise.all([
      createPost("nutrition-1", "dinh-duong", { views: 50 }),
      createPost("body-1", "hieu-co-the", { views: 40 }),
      createPost("mindset-1", "tu-duy-loi-song", { views: 30 }),
      createPost("tools-1", "cong-cu-tinh-toan", { views: 20 }),
      createPost("nutrition-2", "dinh-duong", { views: 10 }),
      createPost("same-topic", "tap-luyen", { views: 100 }),
      createPost("draft-other", "hieu-co-the", { status: "draft" }),
    ]);

    const posts = await getDiscoveryBlogPosts({
      currentPostId: current._id,
      currentCategory: current.category,
      limit: 5,
    });

    expect(posts).toHaveLength(5);
    expect(posts.every((post) => post.category !== current.category)).toBe(true);
    expect(new Set(posts.slice(0, 4).map((post) => post.category)).size).toBe(4);
  });
});
