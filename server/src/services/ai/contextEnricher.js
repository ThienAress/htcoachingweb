import Recipe from "../../models/Recipe.js";
import Trainer from "../../models/Trainer.js";
import CustomerStory from "../../models/CustomerStory.js";
import BlogPost from "../../models/BlogPost.js";

/**
 * Trích xuất slug từ pathname
 * Ví dụ: "/cong-thuc-nau-an/ga-xao-sa-ot" -> "ga-xao-sa-ot"
 */
function extractSlug(pathname) {
  if (!pathname) return null;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1]; // Lấy phần cuối cùng làm slug
  }
  return null;
}

/**
 * Lấy data từ DB dựa trên trang user đang xem để bơm vào System Prompt
 * @param {Object} context - Object context từ frontend (page, pageType, pageTitle)
 * @returns {Object} enrichedData - Data bổ sung
 */
export async function enrichContextWithDbData(context) {
  if (!context || !context.pageType || !context.page) return null;

  const slug = extractSlug(context.page);

  let enrichedData = null;

  try {
    switch (context.pageType) {
      case 'recipe': {
        if (!slug) break; // Trang list /cong-thuc-nau-an không có slug
        const recipe = await Recipe.findOne({ slug }).lean();
        if (recipe) {
          enrichedData = {
            name: recipe.name,
            category: recipe.category,
            area: recipe.area,
            prepTime: recipe.prepTime,
            ingredients: recipe.ingredients?.map(i => `${i.name}${i.measure ? ` (${i.measure})` : ''}`).join(', '),
            instructions: recipe.instructions?.slice(0, 5).join(' → '), // Tóm tắt 5 bước đầu
            tags: recipe.tags?.join(', '),
          };
        }
        break;
      }

      case 'exercises': {
        // Exercise model không có slug — trang /exercises là list page, không cần enrich chi tiết
        break;
      }

      case 'blog': {
        if (!slug) break;
        const post = await BlogPost.findOne({ slug, status: 'published' }).lean();
        if (post) {
          // Cắt content HTML thành plain text, giới hạn 1000 ký tự cho prompt
          const plainContent = post.content
            ?.replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 1000);
          enrichedData = {
            title: post.title,
            category: post.category,
            excerpt: post.excerpt,
            tags: post.tags?.join(', '),
            readTime: post.readTime,
            content: plainContent,
          };
        }
        break;
      }

      case 'trainer_profile': {
        if (!slug) break;
        const trainer = await Trainer.findOne({ slug }).lean();
        if (trainer) {
          enrichedData = {
            name: trainer.userId?.name || trainer.name,
            specialties: trainer.specialties?.map(s => s.label?.vi || s.label).join(', '),
            achievements: trainer.achievements?.map(a => a.vi || a).join('; '),
            philosophy: trainer.philosophy?.vi || trainer.philosophy,
          };
        }
        break;
      }

      case 'customer_story': {
        if (!slug) break;
        const story = await CustomerStory.findOne({ slug }).lean();
        if (story) {
          enrichedData = {
            name: story.name,
            age: story.age,
            goal: story.goal,
            startWeight: story.startWeight,
            endWeight: story.endWeight,
            duration: story.duration,
            result: story.result,
            problem: story.problem,
            solution: story.solution,
            message: story.message,
            quote: story.quote,
          };
        }
        break;
      }
    }
  } catch (error) {
    console.error(`[ContextEnricher] Lỗi khi query data cho page ${context.page}:`, error.message);
  }

  return enrichedData;
}
