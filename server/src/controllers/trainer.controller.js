import Trainer from "../models/Trainer.js";

const getPublicTrainerQuery = () => ({
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

const normalizeSpecialties = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((spec) => ({
    icon: String(spec?.icon || "dumbbell").trim(),
    label: String(spec?.label || "").trim(),
  }));
};

const getTrainerPayload = (body = {}, existingTrainer = null) => {
  const name = String(body.name || "").trim();
  const rawSlug = String(body.slug || "").trim();
  const fallbackSlug = slugify(name);
  const status = body.status === "published" ? "published" : "draft";
  const wasPublished = existingTrainer?.status === "published";

  return {
    slug: slugify(rawSlug || fallbackSlug),
    name,
    title: String(body.title || "").trim(),
    experience: String(body.experience || "").trim(),
    bio: String(body.bio || "").trim(),
    image: String(body.image || "").trim(),
    specialties: normalizeSpecialties(body.specialties),
    status,
    featured: Boolean(body.featured),
    sortOrder: Number.isFinite(Number(body.sortOrder))
      ? Number(body.sortOrder)
      : 0,
    publishedAt:
      status === "published"
        ? existingTrainer?.publishedAt || new Date()
        : wasPublished
          ? null
          : existingTrainer?.publishedAt || null,
  };
};

export const getTrainers = async (req, res, next) => {
  try {
    const { limit = 12, featured } = req.query;

    const query = getPublicTrainerQuery();
    if (featured === "true") {
      query.featured = true;
    }

    const trainers = await Trainer.find(query)
      .sort({ sortOrder: 1, publishedAt: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      success: true,
      count: trainers.length,
      data: trainers,
    });
  } catch (error) {
    next(error);
  }
};

export const getTrainerBySlug = async (req, res, next) => {
  try {
    const trainer = await Trainer.findOne({
      slug: req.params.slug,
      ...getPublicTrainerQuery(),
    }).lean();

    if (!trainer) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trainer" });
    }

    res.status(200).json({ success: true, data: trainer });
  } catch (error) {
    next(error);
  }
};

export const getAdminTrainers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: "i" };

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const [trainers, total] = await Promise.all([
      Trainer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Trainer.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: trainers.length,
      total,
      totalPages: Math.ceil(total / limitNumber),
      currentPage: pageNumber,
      data: trainers,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminTrainerById = async (req, res, next) => {
  try {
    const trainer = await Trainer.findById(req.params.id).lean();
    if (!trainer) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trainer" });
    }
    res.status(200).json({ success: true, data: trainer });
  } catch (error) {
    next(error);
  }
};

export const createTrainer = async (req, res, next) => {
  try {
    const payload = getTrainerPayload(req.body);
    const slugExists = await Trainer.exists({ slug: payload.slug });

    if (slugExists) {
      payload.slug = `${payload.slug}-${Date.now().toString().slice(-4)}`;
    }

    const trainer = await Trainer.create(payload);
    res.status(201).json({ success: true, data: trainer });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Slug đã tồn tại" });
    }
    next(error);
  }
};

export const updateTrainer = async (req, res, next) => {
  try {
    const existingTrainer = await Trainer.findById(req.params.id);
    if (!existingTrainer) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trainer" });
    }

    const payload = getTrainerPayload(req.body, existingTrainer);

    if (payload.slug !== existingTrainer.slug) {
      const slugExists = await Trainer.exists({ slug: payload.slug, _id: { $ne: req.params.id } });
      if (slugExists) {
        return res.status(400).json({ success: false, message: "Slug đã tồn tại" });
      }
    }

    const updatedTrainer = await Trainer.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    }).lean();

    res.status(200).json({ success: true, data: updatedTrainer });
  } catch (error) {
    next(error);
  }
};

export const updateTrainerStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["draft", "published"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const trainer = await Trainer.findById(req.params.id);
    if (!trainer) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trainer" });
    }

    trainer.status = status;
    if (status === "published" && !trainer.publishedAt) {
      trainer.publishedAt = new Date();
    } else if (status === "draft") {
      trainer.publishedAt = null;
    }

    await trainer.save();
    res.status(200).json({ success: true, data: trainer });
  } catch (error) {
    next(error);
  }
};

export const deleteTrainer = async (req, res, next) => {
  try {
    const trainer = await Trainer.findByIdAndDelete(req.params.id);
    if (!trainer) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trainer" });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

export const uploadTrainerImageFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn một file" });
    }

    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename,
      },
    });
  } catch (error) {
    next(error);
  }
};
