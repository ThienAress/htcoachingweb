import path from "path";
import Trainer from "../models/Trainer.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

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
  const name = String(body.name ?? existingTrainer?.name ?? "").trim();
  const rawSlug = String(body.slug ?? existingTrainer?.slug ?? "").trim();
  const fallbackSlug = slugify(name);
  const status = body.status ?? existingTrainer?.status ?? "draft";
  const wasPublished = existingTrainer?.status === "published";

  let images = existingTrainer?.images || [];
  if (body.images !== undefined) {
    if (Array.isArray(body.images)) {
      images = body.images.map(i => String(i || "").trim()).filter(Boolean).slice(0, 3);
    }
  } else if (body.image !== undefined) {
    images = [String(body.image).trim()];
  }

  const achievements = body.achievements !== undefined
    ? (Array.isArray(body.achievements) ? body.achievements.map(a => String(a || "").trim()).filter(Boolean) : [])
    : (existingTrainer?.achievements || []);

  const stats = body.stats !== undefined
    ? (Array.isArray(body.stats) ? body.stats.filter(s => s && s.label && s.value).map(s => ({ label: String(s.label).trim(), value: String(s.value).trim() })) : [])
    : (existingTrainer?.stats || []);

  const certifications = body.certifications !== undefined
    ? (Array.isArray(body.certifications) ? body.certifications.map(c => String(c || "").trim()).filter(Boolean) : [])
    : (existingTrainer?.certifications || []);

  const methodologies = body.methodologies !== undefined
    ? (Array.isArray(body.methodologies) ? body.methodologies.filter(m => m && m.title && m.description).map(m => ({ title: String(m.title).trim(), description: String(m.description).trim() })) : [])
    : (existingTrainer?.methodologies || []);

  const faqs = body.faqs !== undefined
    ? (Array.isArray(body.faqs) ? body.faqs.filter(f => f && f.question && f.answer).map(f => ({ question: String(f.question).trim(), answer: String(f.answer).trim() })) : [])
    : (existingTrainer?.faqs || []);

  const socialLinks = body.socialLinks !== undefined
    ? {
        facebook: String(body.socialLinks?.facebook ?? existingTrainer?.socialLinks?.facebook ?? "").trim(),
        instagram: String(body.socialLinks?.instagram ?? existingTrainer?.socialLinks?.instagram ?? "").trim(),
        tiktok: String(body.socialLinks?.tiktok ?? existingTrainer?.socialLinks?.tiktok ?? "").trim(),
        zalo: String(body.socialLinks?.zalo ?? existingTrainer?.socialLinks?.zalo ?? "").trim(),
        lemon8: String(body.socialLinks?.lemon8 ?? existingTrainer?.socialLinks?.lemon8 ?? "").trim(),
        threads: String(body.socialLinks?.threads ?? existingTrainer?.socialLinks?.threads ?? "").trim(),
      }
    : (existingTrainer?.socialLinks || {});

  return {
    slug: slugify(rawSlug || fallbackSlug),
    name,
    title: String(body.title ?? existingTrainer?.title ?? "").trim(),
    experience: String(body.experience ?? existingTrainer?.experience ?? "").trim(),
    bio: String(body.bio ?? existingTrainer?.bio ?? "").trim(),
    motto: String(body.motto ?? existingTrainer?.motto ?? "").trim(),
    trainingStyle: String(body.trainingStyle ?? existingTrainer?.trainingStyle ?? "").trim(),
    achievements,
    headline: String(body.headline ?? existingTrainer?.headline ?? "").trim(),
    philosophy: String(body.philosophy ?? existingTrainer?.philosophy ?? "").trim(),
    videoIntro: String(body.videoIntro ?? existingTrainer?.videoIntro ?? "").trim(),
    stats,
    certifications,
    methodologies,
    faqs,
    socialLinks,
    images,
    image: images[0] || "",
    specialties: body.specialties !== undefined ? normalizeSpecialties(body.specialties) : (existingTrainer?.specialties || []),
    status,
    featured: body.featured !== undefined ? Boolean(body.featured) : Boolean(existingTrainer?.featured),
    isHeadCoach: body.isHeadCoach !== undefined ? Boolean(body.isHeadCoach) : Boolean(existingTrainer?.isHeadCoach),
    sortOrder: body.sortOrder !== undefined 
      ? (Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0)
      : Number(existingTrainer?.sortOrder || 0),
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

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const safeBaseName = path
      .basename(req.file.originalname || "trainer", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "htcoaching/trainers",
      public_id: `${Date.now()}-${safeBaseName}`,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [
        { width: 1000, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        url: result.url,
        filename: result.public_id,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const uploadTrainerVideoFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn một file video" });
    }

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const safeBaseName = path
      .basename(req.file.originalname || "video", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "htcoaching/trainers/videos",
      public_id: `${Date.now()}-${safeBaseName}`,
      resource_type: "video",
      allowed_formats: ["mp4", "mov", "webm", "avi"],
    });

    res.status(200).json({
      success: true,
      data: {
        url: result.url,
        filename: result.public_id,
      },
    });
  } catch (error) {
    next(error);
  }
};
