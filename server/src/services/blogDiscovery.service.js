import BlogPost from "../models/BlogPost.js";
import "../models/Trainer.js";

const clampLimit = (value) => Math.min(Math.max(Number(value) || 5, 1), 5);

export const getDiscoveryBlogPosts = async ({
  currentPostId,
  currentCategory,
  limit = 5,
}) => {
  const safeLimit = clampLimit(limit);
  const candidates = await BlogPost.find({
    status: "published",
    category: { $ne: currentCategory },
    ...(currentPostId ? { _id: { $ne: currentPostId } } : {}),
  })
    .select("-content")
    .populate("author", "name slug image")
    .sort({ featured: -1, views: -1, publishedAt: -1 })
    .limit(Math.max(safeLimit * 4, 12))
    .lean();

  const selected = [];
  const selectedIds = new Set();
  const categories = new Set();

  for (const post of candidates) {
    if (categories.has(post.category)) continue;
    selected.push(post);
    selectedIds.add(String(post._id));
    categories.add(post.category);
    if (selected.length === safeLimit) return selected;
  }

  for (const post of candidates) {
    if (selectedIds.has(String(post._id))) continue;
    selected.push(post);
    if (selected.length === safeLimit) break;
  }

  return selected;
};
