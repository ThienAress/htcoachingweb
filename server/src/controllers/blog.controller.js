import path from "path";
import BlogPost from "../models/BlogPost.js";
import "../models/Trainer.js";
import sanitizeHtml from "sanitize-html";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { scheduleNetlifyBuild } from "../utils/triggerBuild.js";
import { trackDbQuery } from "../observability/queryTelemetry.js";
import { safeLog } from "../utils/safeLogger.js";
import { getDiscoveryBlogPosts } from "../services/blogDiscovery.service.js";
import {
  getBlogSubCategoryFilter,
  isBlogCategory,
  isBlogSubCategory,
  normalizeBlogSubCategory,
} from "../constants/blogCategories.js";

// Cấu hình sanitize — Tầng 1 bảo mật chống XSS
const sanitizeOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "strong", "em", "u", "s", "del",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
    "div", "span",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    "*": ["class", "style"],
  },
  allowedSchemes: ["http", "https", "data"],
  // Loại bỏ mọi event handler (onerror, onload, onclick...)
  disallowedTagsMode: "discard",
};

const sanitizeContent = (html) => {
  if (!html) return "";
  return sanitizeHtml(html, sanitizeOptions);
};

const slugify = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const publicBuildFields = [
  "title",
  "slug",
  "content",
  "excerpt",
  "category",
  "subCategory",
  "tags",
  "coverImage",
  "author",
  "metaTitle",
  "metaDescription",
  "focusKeyword",
  "featured",
];

const publicBuildFieldsChanged = (post, payload) =>
  publicBuildFields.some((field) => {
    const currentValue = post.get?.(field) ?? post[field] ?? null;
    const nextValue = payload[field] ?? null;
    return JSON.stringify(currentValue) !== JSON.stringify(nextValue);
  });

const getBlogPayload = (body = {}, existingPost = null) => {
  const title = String(body.title || "").trim();
  const rawSlug = String(body.slug || "").trim();
  const status = body.status === "published" ? "published" : "draft";
  const wasPublished = existingPost?.status === "published";

  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t || "").trim()).filter(Boolean)
    : [];

  return {
    title,
    slug: slugify(rawSlug || title),
    content: sanitizeContent(String(body.content || "")),
    excerpt: String(body.excerpt || "").trim(),
    category: String(body.category || "tap-luyen").trim(),
    subCategory: normalizeBlogSubCategory(
      String(body.subCategory || "").trim(),
    ),
    tags,
    coverImage: String(body.coverImage || "").trim(),
    author: body.author || null,
    metaTitle: String(body.metaTitle || "").trim().slice(0, 70),
    metaDescription: String(body.metaDescription || "").trim().slice(0, 200),
    focusKeyword: String(body.focusKeyword || "").trim(),
    status,
    featured: Boolean(body.featured),
    publishedAt:
      status === "published"
        ? existingPost?.publishedAt || new Date()
        : wasPublished
          ? null
          : existingPost?.publishedAt || null,
  };
};

const getClassificationError = ({ category, subCategory }) => {
  if (!isBlogCategory(category)) {
    return "Chủ đề blog không hợp lệ";
  }
  if (!isBlogSubCategory(category, subCategory)) {
    return "Danh mục con không thuộc chủ đề đã chọn";
  }
  return "";
};

// ==================== PUBLIC ====================

export const getPublicBlogPosts = async (req, res) => {
  try {
    const category = String(req.query.category || "").trim();
    const subCategory = String(req.query.subCategory || "").trim();
    const sort = req.query.sort === "popular"
      ? { views: -1, publishedAt: -1 }
      : { publishedAt: -1 };
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 50);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const query = { status: "published" };
    if (isBlogCategory(category)) {
      query.category = category;
    }
    if (subCategory) {
      query.subCategory = getBlogSubCategoryFilter(subCategory.slice(0, 100));
    }

    const [total, posts] = await trackDbQuery("blog.public.list", () =>
      Promise.all([
        BlogPost.countDocuments(query),
        BlogPost.find(query)
          .select("-content")
          .populate("author", "name slug image")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
      ]),
    );

    res.json({
      success: true,
      data: posts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    safeLog.error("blog.public_list_failed", err);
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách bài viết" });
  }
};

export const getPublicBlogPostBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase().trim().slice(0, 180);

    const post = await BlogPost.findOne({ status: "published", slug })
      .populate("author", "name slug image title experience philosophy socialLinks")
      .lean();

    if (!post) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết" });
    }

    const relatedByTags = post.tags?.length
      ? await BlogPost.find({
          status: "published",
          category: post.category,
          tags: { $in: post.tags.slice(0, 20) },
          _id: { $ne: post._id },
        })
          .select("-content")
          .populate("author", "name slug image")
          .sort({ featured: -1, views: -1, publishedAt: -1 })
          .limit(4)
          .lean()
      : [];

    const excludedIds = [post._id, ...relatedByTags.map((item) => item._id)];
    const relatedFallback = relatedByTags.length < 4
      ? await BlogPost.find({
          status: "published",
          category: post.category,
          _id: { $nin: excludedIds },
        })
          .select("-content")
          .populate("author", "name slug image")
          .sort({ views: -1, publishedAt: -1 })
          .limit(4 - relatedByTags.length)
          .lean()
      : [];
    const relatedPosts = [...relatedByTags, ...relatedFallback];
    const discoveryPosts = await trackDbQuery("blog.public.discovery", () =>
      getDiscoveryBlogPosts({
        currentPostId: post._id,
        currentCategory: post.category,
        limit: 5,
      }),
    );

    if (req.query.view !== "prerender") {
      await BlogPost.updateOne({ _id: post._id }, { $inc: { views: 1 } });
    }

    res.json({ success: true, data: post, relatedPosts, discoveryPosts });
  } catch (err) {
    safeLog.error("blog.public_detail_failed", err);
    res.status(500).json({ success: false, message: "Lỗi lấy chi tiết bài viết" });
  }
};

// ==================== ADMIN ====================

export const getAdminBlogPosts = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const status = String(req.query.status || "").trim();
    const category = String(req.query.category || "").trim();
    const subCategory = String(req.query.subCategory || "").trim();
    const search = String(req.query.search || "").trim().slice(0, 100);

    const query = {};
    if (["draft", "published"].includes(status)) query.status = status;
    if (isBlogCategory(category)) {
      query.category = category;
    }
    if (subCategory) {
      query.subCategory = getBlogSubCategoryFilter(subCategory);
    }
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { slug: { $regex: safeSearch, $options: "i" } },
        { tags: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const [total, posts] = await Promise.all([
      BlogPost.countDocuments(query),
      BlogPost.find(query)
        .select("-content")
        .populate("author", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: posts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    safeLog.error("blog.admin_list_failed", err);
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách bài viết" });
  }
};

export const getAdminBlogPostById = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id)
      .populate("author", "name slug")
      .lean();
    if (!post) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết" });
    }
    res.json({ success: true, data: post });
  } catch (err) {
    safeLog.error("blog.admin_detail_failed", err);
    res.status(500).json({ success: false, message: "Lỗi lấy chi tiết bài viết" });
  }
};

export const createBlogPost = async (req, res) => {
  try {
    const payload = getBlogPayload(req.body);

    if (!payload.title || !payload.slug) {
      return res.status(400).json({ success: false, message: "Tiêu đề bài viết là bắt buộc" });
    }
    const classificationError = getClassificationError(payload);
    if (classificationError) {
      return res.status(400).json({ success: false, message: classificationError });
    }

    const existing = await BlogPost.findOne({ slug: payload.slug });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Slug đã tồn tại. Vui lòng chọn tiêu đề khác hoặc sửa slug.",
      });
    }

    const post = await BlogPost.create(payload);
    
    if (post.status === "published") {
      scheduleNetlifyBuild("blog_published");
    }
    
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    safeLog.error("blog.create_failed", err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Slug đã tồn tại" });
    }
    res.status(500).json({ success: false, message: "Lỗi tạo bài viết" });
  }
};

export const updateBlogPost = async (req, res) => {
  try {
    const existingPost = await BlogPost.findById(req.params.id);
    if (!existingPost) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết" });
    }

    const wasPublished = existingPost.status === "published";
    const payload = getBlogPayload(req.body, existingPost);
    if (!payload.title || !payload.slug) {
      return res.status(400).json({ success: false, message: "Tiêu đề bài viết là bắt buộc" });
    }
    const classificationError = getClassificationError(payload);
    if (classificationError) {
      return res.status(400).json({ success: false, message: classificationError });
    }

    const existingSlug = await BlogPost.findOne({ slug: payload.slug, _id: { $ne: req.params.id } });
    if (existingSlug) {
      return res.status(409).json({
        success: false,
        message: "Đường dẫn (slug) đã bị trùng với bài viết khác.",
      });
    }

    const publicContentChanged = publicBuildFieldsChanged(existingPost, payload);
    Object.assign(existingPost, payload);
    await existingPost.save();

    const isPublished = existingPost.status === "published";
    if (!wasPublished && isPublished) {
      scheduleNetlifyBuild("blog_published");
    } else if (wasPublished && !isPublished) {
      scheduleNetlifyBuild("blog_unpublished");
    } else if (wasPublished && publicContentChanged) {
      scheduleNetlifyBuild("blog_updated");
    }

    res.json({ success: true, data: existingPost });
  } catch (err) {
    safeLog.error("blog.update_failed", err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Slug đã tồn tại" });
    }
    res.status(500).json({ success: false, message: "Lỗi cập nhật bài viết" });
  }
};

export const deleteBlogPost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết" });
    }

    if (post.status === "published") {
      scheduleNetlifyBuild("blog_deleted");
    }

    res.json({ success: true, message: "Xóa bài viết thành công" });
  } catch (err) {
    safeLog.error("blog.delete_failed", err);
    res.status(500).json({ success: false, message: "Lỗi xóa bài viết" });
  }
};

export const uploadBlogImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
    }

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const safeBaseName = path
      .basename(req.file.originalname || "blog-image", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "htcoaching/blog",
      public_id: `${Date.now()}-${safeBaseName}`,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [
        { width: 1200, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    res.status(201).json({
      success: true,
      data: { url: result.url, filename: result.public_id },
    });
  } catch (err) {
    safeLog.error("blog.image_upload_failed", err);
    res.status(500).json({ success: false, message: "Lỗi upload ảnh bài viết" });
  }
};
