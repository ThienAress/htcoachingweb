import CustomerStory from "../models/CustomerStory.js";
import Trainer from "../models/Trainer.js";

const getPublicStoryQuery = () => ({
  status: "published",
});

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

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

const normalizeMilestones = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((milestone, index) => ({
    title: String(milestone?.title || "").trim(),
    subtitle: String(milestone?.subtitle || "").trim(),
    content: String(milestone?.content || "").trim(),
    beforeImg: String(milestone?.beforeImg || "").trim(),
    afterImg: String(milestone?.afterImg || "").trim(),
    bullets: normalizeStringArray(milestone?.bullets),
    sortOrder: Number.isFinite(Number(milestone?.sortOrder))
      ? Number(milestone.sortOrder)
      : index,
  }));
};

const getStoryPayload = (body = {}, existingStory = null) => {
  const name = String(body.name || "").trim();
  const rawSlug = String(body.slug || "").trim();
  const fallbackSlug = slugify(`${name}-${body.duration || ""}`);
  const status = body.status === "published" ? "published" : "draft";
  const wasPublished = existingStory?.status === "published";

  const payload = {
    slug: slugify(rawSlug || fallbackSlug),
    name,
    age: String(body.age || "").trim(),
    job: String(body.job || "").trim(),
    result: String(body.result || "").trim(),
    duration: String(body.duration || "").trim(),
    packageName: String(body.packageName || "").trim(),
    goal: String(body.goal || "").trim(),
    startWeight: String(body.startWeight || "").trim(),
    endWeight: String(body.endWeight || "").trim(),
    schedule: String(body.schedule || "").trim(),
    message: String(body.message || "").trim(),
    problem: String(body.problem || "").trim(),
    solution: String(body.solution || "").trim(),
    quote: String(body.quote || "").trim(),
    beforeImg: String(body.beforeImg || "").trim(),
    afterImg: String(body.afterImg || "").trim(),
    heroImage: String(body.heroImage || "").trim(),
    highlights: normalizeStringArray(body.highlights),
    milestones: normalizeMilestones(body.milestones),
    status,
    featured: Boolean(body.featured),
    isContinuing: Boolean(body.isContinuing),
    sortOrder: Number.isFinite(Number(body.sortOrder))
      ? Number(body.sortOrder)
      : 0,
    publishedAt:
      status === "published"
        ? existingStory?.publishedAt || new Date()
        : wasPublished
          ? null
          : existingStory?.publishedAt || null,
  };

  if (body.orderId) payload.orderId = body.orderId;
  else payload.orderId = null;
  
  if (body.trainerId) payload.trainerId = body.trainerId;
  else payload.trainerId = null;

  return payload;
};

export const getCustomerStories = async (req, res) => {
  try {
    const featured = req.query.featured;
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 12;

    const trainerId = req.query.trainerId;

    const query = getPublicStoryQuery();
    if (featured === "true") {
      query.featured = true;
    }
    
    if (trainerId) {
      try {
        const trainer = await Trainer.findById(trainerId).lean();
        if (trainer && trainer.isHeadCoach) {
          query.$or = [
            { trainerId: trainerId },
            { trainerId: null },
            { trainerId: { $exists: false } }
          ];
        } else {
          query.trainerId = trainerId;
        }
      } catch (err) {
        query.trainerId = trainerId;
      }
    }

    const stories = await CustomerStory.find(query)
      .sort({ sortOrder: 1, publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: stories,
    });
  } catch (err) {
    console.error("GET CUSTOMER STORIES ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách câu chuyện khách hàng",
    });
  }
};

export const getAdminCustomerStories = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
      50,
    );
    const skip = (page - 1) * limit;
    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim();
    const trainerId = req.query.trainerId;

    const query = {};
    if (["draft", "published"].includes(status)) {
      query.status = status;
    }
    if (trainerId) {
      query.trainerId = trainerId;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { job: { $regex: search, $options: "i" } },
      ];
    }

    const [total, stories] = await Promise.all([
      CustomerStory.countDocuments(query),
      CustomerStory.find(query)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: stories,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("GET ADMIN CUSTOMER STORIES ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách câu chuyện khách hàng",
    });
  }
};

export const getAdminCustomerStoryById = async (req, res) => {
  try {
    const story = await CustomerStory.findById(req.params.id).lean();
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy câu chuyện khách hàng",
      });
    }
    res.json({ success: true, data: story });
  } catch (err) {
    console.error("GET ADMIN CUSTOMER STORY DETAIL ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy chi tiết câu chuyện khách hàng",
    });
  }
};

export const createCustomerStory = async (req, res) => {
  try {
    const payload = getStoryPayload(req.body);

    if (!payload.name || !payload.slug) {
      return res.status(400).json({
        success: false,
        message: "Tên khách hàng và slug là bắt buộc",
      });
    }

    const existing = await CustomerStory.findOne({ slug: payload.slug });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Khách hàng này đã có câu chuyện rồi.",
        existingStoryId: existing._id,
      });
    }

    const story = await CustomerStory.create(payload);
    res.status(201).json({ success: true, data: story });
  } catch (err) {
    console.error("CREATE CUSTOMER STORY ERROR:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Slug đã tồn tại",
      });
    }
    res.status(500).json({
      success: false,
      message: "Lỗi tạo câu chuyện khách hàng",
    });
  }
};

export const updateCustomerStory = async (req, res) => {
  try {
    const existingStory = await CustomerStory.findById(req.params.id);
    if (!existingStory) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy câu chuyện khách hàng",
      });
    }

    const payload = getStoryPayload(req.body, existingStory);
    if (!payload.name || !payload.slug) {
      return res.status(400).json({
        success: false,
        message: "Tên khách hàng và slug là bắt buộc",
      });
    }

    const existingSlug = await CustomerStory.findOne({ slug: payload.slug, _id: { $ne: req.params.id } });
    if (existingSlug) {
      return res.status(409).json({
        success: false,
        message: "Đường dẫn (slug) đã bị trùng với một câu chuyện khác.",
      });
    }

    Object.assign(existingStory, payload);
    await existingStory.save();

    res.json({ success: true, data: existingStory });
  } catch (err) {
    console.error("UPDATE CUSTOMER STORY ERROR:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Slug đã tồn tại",
      });
    }
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật câu chuyện khách hàng",
    });
  }
};

export const updateCustomerStoryStatus = async (req, res) => {
  try {
    const { status, featured } = req.body;
    if (!["draft", "published"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ",
      });
    }

    const story = await CustomerStory.findById(req.params.id);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy câu chuyện khách hàng",
      });
    }

    story.status = status;
    if (typeof featured === "boolean") {
      story.featured = featured;
    }
    story.publishedAt =
      status === "published" ? story.publishedAt || new Date() : null;
    await story.save();

    res.json({ success: true, data: story });
  } catch (err) {
    console.error("UPDATE CUSTOMER STORY STATUS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi cập nhật trạng thái câu chuyện khách hàng",
    });
  }
};

export const deleteCustomerStory = async (req, res) => {
  try {
    const story = await CustomerStory.findByIdAndDelete(req.params.id);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy câu chuyện khách hàng",
      });
    }
    res.json({
      success: true,
      message: "Xóa câu chuyện khách hàng thành công",
    });
  } catch (err) {
    console.error("DELETE CUSTOMER STORY ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi xóa câu chuyện khách hàng",
    });
  }
};

export const uploadCustomerStoryImageFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn ảnh",
      });
    }

    res.status(201).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (err) {
    console.error("UPLOAD CUSTOMER STORY IMAGE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi upload ảnh câu chuyện khách hàng",
    });
  }
};

export const getCustomerStoryBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase().trim();

    const story = await CustomerStory.findOne({
      ...getPublicStoryQuery(),
      slug,
    }).lean();

    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy câu chuyện khách hàng",
      });
    }

    res.json({
      success: true,
      data: story,
    });
  } catch (err) {
    console.error("GET CUSTOMER STORY DETAIL ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy chi tiết câu chuyện khách hàng",
    });
  }
};
