import sanitizeHtml from "sanitize-html";

import BlogPost from "../../models/BlogPost.js";
import CustomerStory from "../../models/CustomerStory.js";
import Recipe from "../../models/Recipe.js";
import Trainer from "../../models/Trainer.js";
import { safeLog } from "../../utils/safeLogger.js";

const DEFAULT_CONTENT_LIMIT = 1800;
const EXPANDED_CONTENT_LIMIT = 24000;
const MAX_RECIPE_STEPS = 50;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PAGE_ROUTES = [
  ["/", "home", "Trang chủ HTCOACHING", "Giới thiệu dịch vụ, công cụ miễn phí, bảng giá và cách đăng ký tư vấn."],
  ["/ket-qua-khach-hang", "customer_story", "Kết quả khách hàng", "Giải thích hành trình, phương pháp và kết quả thực tế đã công bố."],
  ["/huan-luyen-vien", "trainer_profile", "Huấn luyện viên", "Giới thiệu chuyên môn HLV và hỗ trợ chọn người phù hợp."],
  ["/quet-mon-an", "meal_scan", "Quét món ăn", "Giải thích ước tính calo/macro và nhắc xác nhận khẩu phần, dầu, sốt."],
  ["/blog", "blog", "Trang Blog", "Tóm tắt, giải thích và gợi ý cách áp dụng bài viết đang đọc."],
  ["/club", "club", "Danh sách phòng tập", "Hỗ trợ chọn phòng tập theo vị trí và nhu cầu."],
  ["/exercises", "exercises", "Thư viện bài tập", "Tìm và giải thích bài tập theo nhóm cơ hoặc mục tiêu."],
  ["/checkin", "checkin", "Check-in", "Giải thích quy trình check-in; dữ liệu cá nhân chỉ đọc qua tool có auth."],
  ["/my-history", "history", "Lịch sử tập luyện", "Hỗ trợ đọc lịch sử của chính user khi đã xác thực."],
  ["/wallet", "wallet", "Ví của tôi", "Dữ liệu ví chỉ được đọc qua tool có auth và ownership."],
  ["/training-schedule", "training_schedule", "Lịch tập", "Hỗ trợ xem lịch tập của chính user khi đã xác thực."],
  ["/workout-plans", "workout_plan", "Giáo án tập luyện", "Giải thích giáo án; dữ liệu cá nhân chỉ đọc qua tool có auth."],
  ["/online-coaching", "online_coaching", "Online Coaching", "Hỗ trợ người đã mua gói sử dụng khu vực coaching."],
  ["/account", "account", "Tài khoản", "Hướng dẫn quản lý tài khoản mà không yêu cầu dữ liệu bí mật."],
  ["/dashboard", "dashboard", "Customer Dashboard", "Hỗ trợ điều hướng các module theo dõi hằng ngày."],
  ["/today", "dashboard", "Theo dõi hôm nay", "Hỗ trợ điều hướng hoạt động tập luyện và dinh dưỡng hôm nay."],
  ["/progress", "progress", "Tiến trình", "Giải thích tiến trình của chính user khi đã xác thực."],
  ["/notifications", "notifications", "Thông báo", "Hỗ trợ hiểu thông báo của chính user khi đã xác thực."],
  ["/contracts", "contract", "Hợp đồng", "Hướng dẫn quy trình ký; không đọc nội dung hợp đồng từ pathname."],
  ["/tdee-calculator", "tdee_calculator", "Trang tính TDEE", "Giải thích TDEE, macro và cách dùng kết quả an toàn."],
  ["/mealplan", "meal_plan", "Trang Thực đơn", "Hỗ trợ cá nhân hóa thực đơn theo mục tiêu và macro."],
  ["/cong-thuc-nau-an", "recipe", "Công thức nấu ăn", "Giải thích nguyên liệu, các bước và cách điều chỉnh món ăn."],
  ["/book-training", "booking", "Đăng ký lịch tập", "Hướng dẫn chọn lịch và đăng ký tư vấn tập luyện."],
];

const PAGE_DESCRIPTORS = PAGE_ROUTES.map(([path, pageType, name, hint]) => ({
  path,
  pageType,
  name,
  hint,
}));

export const normalizePagePath = (value) => {
  if (typeof value !== "string") return "";
  const input = value.trim().slice(0, 300);
  if (!input.startsWith("/") || input.startsWith("//")) return "";
  const pathname = input.split(/[?#]/, 1)[0].replace(/\/{2,}/g, "/");
  if (pathname.includes("..") || pathname.includes("\0")) return "";
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
};

export const getPageDescriptor = (value) => {
  const page = normalizePagePath(value);
  if (!page) return null;
  const exact = PAGE_DESCRIPTORS.find((item) => item.path === page);
  if (exact) return { ...exact, page, isDetail: false, slug: null };

  const parent = PAGE_DESCRIPTORS
    .filter((item) => item.path !== "/" && page.startsWith(`${item.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0];
  if (!parent) return null;

  const resourceParts = page
    .slice(parent.path.length + 1)
    .split("/")
    .filter(Boolean);
  const resourcePart = resourceParts[0];
  const slug =
    resourceParts.length === 1 && SLUG_PATTERN.test(resourcePart)
      ? resourcePart
      : null;
  return { ...parent, page, isDetail: true, slug };
};

export const canonicalizePageContext = (context = {}) => {
  const page = normalizePagePath(context.page);
  const lastPage = normalizePagePath(context.lastPage);
  const descriptor = getPageDescriptor(page || lastPage);
  return {
    ...(page && { page }),
    ...(lastPage && { lastPage }),
    ...(context.pageTitle && { pageTitle: context.pageTitle }),
    ...(descriptor && { pageType: descriptor.pageType }),
    ...(context.userMetrics && { userMetrics: context.userMetrics }),
  };
};

const plainText = (value, limit) => {
  const text = sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
  return {
    text: text.slice(0, limit),
    truncated: text.length > limit,
  };
};

const joinBounded = (values, separator = ", ", limit = 12000) =>
  (values || [])
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(separator)
    .slice(0, limit);

async function loadRecipe(slug, expandContent) {
  const recipe = await Recipe.findOne({ slug, isPublished: true })
    .select("name category area prepTime ingredients instructions tags")
    .lean();
  if (!recipe) return null;
  const steps = expandContent
    ? recipe.instructions?.slice(0, MAX_RECIPE_STEPS)
    : recipe.instructions?.slice(0, 8);
  return {
    name: recipe.name,
    category: recipe.category,
    area: recipe.area,
    prepTime: recipe.prepTime,
    ingredients: joinBounded(
      recipe.ingredients?.map((item) =>
        `${item.name}${item.measure ? ` (${item.measure})` : ""}`,
      ),
    ),
    instructions: joinBounded(steps, " → ", 16000),
    contentTruncated: Boolean(
      recipe.instructions?.length > (expandContent ? MAX_RECIPE_STEPS : 8),
    ),
    tags: joinBounded(recipe.tags),
  };
}

async function loadBlog(slug, expandContent) {
  const post = await BlogPost.findOne({ slug, status: "published" })
    .select("title category excerpt tags readTime content")
    .lean();
  if (!post) return null;
  const content = plainText(
    post.content,
    expandContent ? EXPANDED_CONTENT_LIMIT : DEFAULT_CONTENT_LIMIT,
  );
  return {
    title: post.title,
    category: post.category,
    excerpt: String(post.excerpt || "").slice(0, 1200),
    tags: joinBounded(post.tags),
    readTime: post.readTime,
    content: content.text,
    contentTruncated: content.truncated,
  };
}

async function loadTrainer(slug) {
  const trainer = await Trainer.findOne({ slug, status: "published" })
    .select("name title experience bio specialties achievements philosophy headline")
    .lean();
  if (!trainer) return null;
  return {
    name: trainer.name,
    title: trainer.title,
    experience: trainer.experience,
    bio: plainText(trainer.bio, 2400).text,
    specialties: joinBounded(trainer.specialties?.map((item) => item.label)),
    achievements: joinBounded(trainer.achievements, "; "),
    philosophy: plainText(trainer.philosophy, 1600).text,
    headline: trainer.headline,
  };
}

async function loadCustomerStory(slug) {
  const story = await CustomerStory.findOne({ slug, status: "published" })
    .select("name age goal startWeight endWeight duration result problem solution message quote")
    .lean();
  if (!story) return null;
  return {
    name: String(story.name || "").slice(0, 200),
    age: String(story.age || "").slice(0, 40),
    goal: String(story.goal || "").slice(0, 800),
    startWeight: String(story.startWeight || "").slice(0, 40),
    endWeight: String(story.endWeight || "").slice(0, 40),
    duration: String(story.duration || "").slice(0, 200),
    result: String(story.result || "").slice(0, 1600),
    problem: String(story.problem || "").slice(0, 1600),
    solution: String(story.solution || "").slice(0, 1600),
    message: String(story.message || "").slice(0, 1600),
    quote: String(story.quote || "").slice(0, 800),
  };
}

const DATA_LOADERS = {
  recipe: loadRecipe,
  blog: loadBlog,
  trainer_profile: loadTrainer,
  customer_story: loadCustomerStory,
};

export const shouldExpandPageContent = (message) =>
  /\b(tóm tắt|tom tat|ý chính|y chinh|summar(?:y|ize)|giải thích bài|các bước|cac buoc)\b/i.test(
    String(message || ""),
  );

export async function resolvePageContext(context = {}, options = {}) {
  const canonical = canonicalizePageContext(context);
  const descriptor = getPageDescriptor(canonical.page || canonical.lastPage);
  const result = {
    ...canonical,
    pageType: descriptor?.pageType || canonical.pageType || "general",
    pageInfo: descriptor
      ? { name: descriptor.name, hint: descriptor.hint }
      : null,
    pageData: null,
  };
  if (!descriptor?.isDetail || !descriptor.slug) return result;
  const loader = DATA_LOADERS[descriptor.pageType];
  if (!loader) return result;

  try {
    result.pageData = await loader(
      descriptor.slug,
      Boolean(options.expandContent),
    );
  } catch (error) {
    safeLog.error("ai.context_enrichment_failed", error, {
      page: descriptor.page,
    });
  }
  return result;
}

// Backward-compatible seam cho các consumer cũ.
export async function enrichContextWithDbData(context) {
  return (await resolvePageContext(context)).pageData;
}
