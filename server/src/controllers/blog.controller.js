import BlogPost from "../models/BlogPost.js";
import sanitizeHtml from "sanitize-html";

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
    category: body.category || "kien-thuc-nen",
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

// ==================== PUBLIC ====================

export const getPublicBlogPosts = async (req, res) => {
  try {
    const category = String(req.query.category || "").trim();
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 50);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const query = { status: "published" };
    if (["kien-thuc-nen", "giao-an-opt", "danh-gia-f1", "dinh-duong"].includes(category)) {
      query.category = category;
    }

    const [total, posts] = await Promise.all([
      BlogPost.countDocuments(query),
      BlogPost.find(query)
        .select("-content")
        .populate("author", "name slug image")
        .sort({ publishedAt: -1 })
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
    console.error("GET PUBLIC BLOG POSTS ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách bài viết" });
  }
};

export const getPublicBlogPostBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase().trim();

    const post = await BlogPost.findOne({ status: "published", slug })
      .populate("author", "name slug image title experience philosophy socialLinks")
      .lean();

    if (!post) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài viết" });
    }

    // Tăng views (fire-and-forget)
    BlogPost.updateOne({ _id: post._id }, { $inc: { views: 1 } }).catch(() => {});

    res.json({ success: true, data: post });
  } catch (err) {
    console.error("GET PUBLIC BLOG POST DETAIL ERROR:", err);
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
    const search = String(req.query.search || "").trim();

    const query = {};
    if (["draft", "published"].includes(status)) query.status = status;
    if (["kien-thuc-nen", "giao-an-opt", "danh-gia-f1", "dinh-duong"].includes(category)) {
      query.category = category;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
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
    console.error("GET ADMIN BLOG POSTS ERROR:", err);
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
    console.error("GET ADMIN BLOG POST DETAIL ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi lấy chi tiết bài viết" });
  }
};

export const createBlogPost = async (req, res) => {
  try {
    const payload = getBlogPayload(req.body);

    if (!payload.title || !payload.slug) {
      return res.status(400).json({ success: false, message: "Tiêu đề bài viết là bắt buộc" });
    }

    const existing = await BlogPost.findOne({ slug: payload.slug });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Slug đã tồn tại. Vui lòng chọn tiêu đề khác hoặc sửa slug.",
      });
    }

    const post = await BlogPost.create(payload);
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    console.error("CREATE BLOG POST ERROR:", err);
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

    const payload = getBlogPayload(req.body, existingPost);
    if (!payload.title || !payload.slug) {
      return res.status(400).json({ success: false, message: "Tiêu đề bài viết là bắt buộc" });
    }

    const existingSlug = await BlogPost.findOne({ slug: payload.slug, _id: { $ne: req.params.id } });
    if (existingSlug) {
      return res.status(409).json({
        success: false,
        message: "Đường dẫn (slug) đã bị trùng với bài viết khác.",
      });
    }

    Object.assign(existingPost, payload);
    await existingPost.save();

    res.json({ success: true, data: existingPost });
  } catch (err) {
    console.error("UPDATE BLOG POST ERROR:", err);
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
    res.json({ success: true, message: "Xóa bài viết thành công" });
  } catch (err) {
    console.error("DELETE BLOG POST ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi xóa bài viết" });
  }
};

export const uploadBlogImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn ảnh" });
    }
    res.status(201).json({
      success: true,
      data: { url: req.file.path, filename: req.file.filename },
    });
  } catch (err) {
    console.error("UPLOAD BLOG IMAGE ERROR:", err);
    res.status(500).json({ success: false, message: "Lỗi upload ảnh bài viết" });
  }
};
