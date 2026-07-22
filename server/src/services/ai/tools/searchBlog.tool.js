// Search Blog Tool — Query BlogPost model (read-only)

import BlogPost from "../../../models/BlogPost.js";
import { escapeRegex } from "../../../utils/escapeRegex.js";

const CATEGORY_LABELS = {
  "tap-luyen": "Tập luyện",
  "dinh-duong": "Dinh dưỡng",
  "hieu-co-the": "Hiểu cơ thể",
  "tu-duy-loi-song": "Tư duy & Lối sống",
};

/**
 * Tìm bài viết blog theo từ khóa hoặc danh mục
 * @param {{ query?: string, category?: string, limit?: number }} params
 * @returns {{ text: string, uiCard: object|null }}
 */
export async function searchBlog(params) {
  try {
    const { query, category, limit = 5 } = params;

    const filter = { status: "published" };

    if (category) {
      const matched = Object.keys(CATEGORY_LABELS).find(
        (k) => k === category || CATEGORY_LABELS[k].toLowerCase().includes(category.toLowerCase())
      );
      if (matched) filter.category = matched;
    }

    let posts;

    if (query) {
      // Text search theo title, excerpt, tags
      const terms = query
        .split(/\s+/)
        .map((term) => escapeRegex(term, 50))
        .filter(Boolean)
        .slice(0, 10);
      const regex = new RegExp(terms.join("|"), "i");
      posts = await BlogPost.find({
        ...filter,
        $or: [
          { title: regex },
          { excerpt: regex },
          { tags: regex },
          { focusKeyword: regex },
        ],
      })
        .sort({ views: -1, publishedAt: -1 })
        .limit(Math.min(limit, 10))
        .select("title slug excerpt category coverImage readTime publishedAt views")
        .lean();
    } else {
      // Không có query → lấy bài mới nhất (hoặc theo category)
      posts = await BlogPost.find(filter)
        .sort({ publishedAt: -1 })
        .limit(Math.min(limit, 10))
        .select("title slug excerpt category coverImage readTime publishedAt views")
        .lean();
    }

    if (!posts || posts.length === 0) {
      const hint = query ? ` về "${query}"` : "";
      return {
        text: `Hiện tại chưa có bài viết${hint} trên blog. Tuy nhiên, bạn có thể hỏi tôi trực tiếp về chủ đề này — tôi sẵn sàng tư vấn! 😊`,
        uiCard: null,
      };
    }

    // Text cho LLM
    let text = query
      ? `📝 Tìm thấy **${posts.length} bài viết** liên quan đến "${query}":\n`
      : `📝 **${posts.length} bài viết mới nhất**:\n`;

    posts.forEach((post, i) => {
      const catLabel = CATEGORY_LABELS[post.category] || post.category;
      const date = post.publishedAt
        ? new Date(post.publishedAt).toLocaleDateString("vi-VN")
        : "";
      text += `\n${i + 1}. **${post.title}** — ${catLabel}`;
      if (date) text += ` (${date})`;
      text += ` | ${post.readTime} phút đọc`;
      if (post.excerpt) {
        text += `\n   ${post.excerpt.substring(0, 100)}${post.excerpt.length > 100 ? "..." : ""}`;
      }
      text += `\n   👉 [Đọc bài viết](/blog/${post.slug})`;
    });

    // UI Card data
    const uiCard = {
      cardType: "blogList",
      data: {
        posts: posts.map((post) => ({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt || "",
          category: post.category,
          categoryLabel: CATEGORY_LABELS[post.category] || post.category,
          coverImage: post.coverImage || "",
          readTime: post.readTime,
          publishedAt: post.publishedAt,
        })),
        query: query || null,
      },
    };

    return { text, uiCard };
  } catch {
    return {
      text: "Hiện tại chưa có bài viết nào trên blog. Bạn có thể hỏi tôi trực tiếp về chủ đề này nhé!",
      uiCard: null,
    };
  }
}
