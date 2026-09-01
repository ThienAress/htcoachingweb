import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

import { resolveCloudinaryFolder } from "../utils/cloudinaryPath.js";

const PRIVATE_FEEDBACK_FOLDER = "htcoaching/coaching-feedback-private";
const PUBLIC_DEMO_FOLDER = "htcoaching/coaching-videos";
const SIGNED_URL_TTL_SECONDS = 300;
const SERVER_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const LEGACY_UPLOAD_ROOT = path.join(SERVER_ROOT, "uploads");

let testAdapter = null;

const isOwnedPrivateFeedbackStorageKey = (value) => {
  const storageKey = String(value || "");
  const folder = resolveCloudinaryFolder(PRIVATE_FEEDBACK_FOLDER);
  return (
    storageKey.startsWith(`${folder}/`) &&
    /^[A-Za-z0-9_/-]+$/.test(storageKey)
  );
};

const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

const startUploadStream = (options, callback) => {
  if (testAdapter?.uploadStream) {
    return testAdapter.uploadStream(options, callback);
  }
  configureCloudinary();
  return cloudinary.uploader.upload_stream(options, callback);
};

const destroyCloudinaryVideo = async (storageKey, deliveryType) => {
  if (testAdapter?.destroy) {
    return testAdapter.destroy(storageKey, deliveryType);
  }
  configureCloudinary();
  return cloudinary.uploader.destroy(storageKey, {
    resource_type: "video",
    type: deliveryType,
    invalidate: true,
  });
};

const normalizeSegment = (value, fallback) =>
  String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 100);

const getUploadOptions = (req, file, authenticated) => {
  const folder = authenticated ? PRIVATE_FEEDBACK_FOLDER : PUBLIC_DEMO_FOLDER;
  const identity = authenticated
    ? [
        normalizeSegment(req.user?.id, "client"),
        normalizeSegment(req.params?.dateString, "date"),
        normalizeSegment(req.params?.exerciseId, "exercise"),
      ].join("-")
    : normalizeSegment(req.user?.id, "trainer");

  return {
    folder: resolveCloudinaryFolder(folder),
    public_id: `${identity}-${randomUUID()}`,
    resource_type: "video",
    type: authenticated ? "authenticated" : "upload",
    ...(authenticated ? { access_mode: "authenticated" } : {}),
    allowed_formats: ["mp4", "mov", "avi", "webm", "mkv", "m4v", "3gp"],
  };
};

export const createCoachingVideoStorage = ({ authenticated }) => ({
  _handleFile(req, file, callback) {
    const options = getUploadOptions(req, file, authenticated);
    const uploadStream = startUploadStream(options, (error, result) => {
      if (error) return callback(error);
      return callback(null, {
        path: result.secure_url,
        size: result.bytes,
        filename: result.public_id,
        format: result.format,
        version: result.version,
        deliveryType: authenticated ? "authenticated" : "upload",
      });
    });
    file.stream.pipe(uploadStream);
  },

  _removeFile(_req, file, callback) {
    destroyCloudinaryVideo(
      file.filename,
      authenticated ? "authenticated" : "upload",
    ).then(() => callback(null)).catch(callback);
  },
});

export const createPrivateCoachingMedia = (file) => {
  if (!isOwnedPrivateFeedbackStorageKey(file?.filename)) {
    throw new Error("Coaching feedback storage key is not allowlisted");
  }
  return {
    provider: "cloudinary",
    storageKey: file.filename,
    resourceType: "video",
    deliveryType: "authenticated",
    format:
      file.format ||
      path.extname(file.originalname || "").toLowerCase().replace(".", "") ||
      "mp4",
    ...(Number.isFinite(file.version) ? { version: file.version } : {}),
    ...(Number.isFinite(file.size) ? { bytes: file.size } : {}),
  };
};

const deleteLegacyPublicCoachingMedia = async (storageKey) => {
  if (testAdapter?.destroyLegacyPublic) {
    return testAdapter.destroyLegacyPublic(storageKey);
  }
  if (
    !String(storageKey || "").startsWith("htcoaching/") ||
    !String(storageKey).includes("/coaching-videos/")
  ) {
    throw new Error("Legacy coaching media storage key is not allowlisted");
  }
  configureCloudinary();
  const result = await cloudinary.uploader.destroy(storageKey, {
    resource_type: "video",
    type: "upload",
    invalidate: true,
  });
  return {
    deleted: ["ok", "not found"].includes(result.result),
    notFound: result.result === "not found",
  };
};

export const isPrivateCoachingMedia = (value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      value.provider === "cloudinary" &&
      typeof value.storageKey === "string" &&
      isOwnedPrivateFeedbackStorageKey(value.storageKey) &&
      value.resourceType === "video" &&
      value.deliveryType === "authenticated",
  );

const parseOwnedLegacyCloudinaryMedia = (value) => {
  const configuredCloud = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  if (!configuredCloud) return null;
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "res.cloudinary.com" ||
      segments[0] !== configuredCloud ||
      segments[1] !== "video" ||
      segments[2] !== "upload"
    ) {
      return null;
    }
    const ownedRoot = segments.findIndex(
      (segment, index) =>
        segment === "htcoaching" &&
        segments[index + 1] === "coaching-videos",
    );
    if (ownedRoot < 0) return null;
    const storageKey = segments
      .slice(ownedRoot)
      .join("/")
      .replace(/\.[A-Za-z0-9]+$/, "");
    if (!/^htcoaching\/coaching-videos\/[A-Za-z0-9_/-]+$/.test(storageKey)) {
      return null;
    }
    return {
      provider: "cloudinary",
      storageKey,
      resourceType: "video",
      deliveryType: "upload",
    };
  } catch {
    return null;
  }
};

const parseLegacyLocalCoachingMedia = (value) => {
  if (!String(value || "").startsWith("/uploads/")) return null;
  const storageKey = String(value).slice("/uploads/".length);
  if (
    !storageKey ||
    storageKey.includes("..") ||
    storageKey.includes("\\") ||
    !/^[A-Za-z0-9_./-]+$/.test(storageKey)
  ) {
    return null;
  }
  const resolved = path.resolve(LEGACY_UPLOAD_ROOT, storageKey);
  if (!resolved.startsWith(`${LEGACY_UPLOAD_ROOT}${path.sep}`)) return null;
  return {
    provider: "local",
    storageKey,
    resourceType: "video",
    deliveryType: "local",
  };
};

export const isDeletableCoachingMedia = (value) =>
  isPrivateCoachingMedia(value) ||
  Boolean(
    value &&
      typeof value === "object" &&
      value.resourceType === "video" &&
      ((value.provider === "cloudinary" && value.deliveryType === "upload") ||
        (value.provider === "local" && value.deliveryType === "local")) &&
      typeof value.storageKey === "string" &&
      value.storageKey,
  );

export const getPrivateCoachingMediaUrl = async (
  media,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS,
) => {
  if (!isPrivateCoachingMedia(media)) {
    return typeof media === "string" ? media : "";
  }
  if (testAdapter?.getSignedReadUrl) {
    return testAdapter.getSignedReadUrl(media, expiresInSeconds);
  }
  configureCloudinary();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.utils.private_download_url(
    media.storageKey,
    media.format || "mp4",
    {
      resource_type: "video",
      type: "authenticated",
      expires_at: expiresAt,
    },
  );
};

export const serializeCoachingPlanMedia = async (plan) => {
  if (!plan) return plan;
  const serialized =
    typeof plan.toObject === "function" ? plan.toObject() : { ...plan };
  serialized.clientFeedbackVideo = await getPrivateCoachingMediaUrl(
    serialized.clientFeedbackVideo,
  );
  serialized.exercises = await Promise.all(
    (serialized.exercises || []).map(async (exercise) => ({
      ...exercise,
      clientFeedbackVideo: await getPrivateCoachingMediaUrl(
        exercise.clientFeedbackVideo,
      ),
    })),
  );
  return serialized;
};

export const serializeCoachingPlansMedia = (plans) =>
  Promise.all((plans || []).map(serializeCoachingPlanMedia));

export const collectCoachingMediaDeletionInventory = (planOrPlans) => {
  const plans = Array.isArray(planOrPlans) ? planOrPlans : [planOrPlans];
  const assets = [];
  const unsupported = [];
  const collect = (value, location) => {
    if (!value) return;
    if (isPrivateCoachingMedia(value)) {
      assets.push(value);
      return;
    }
    if (typeof value === "string") {
      const legacy =
        parseOwnedLegacyCloudinaryMedia(value) ||
        parseLegacyLocalCoachingMedia(value);
      if (legacy) assets.push(legacy);
      else unsupported.push({ location, kind: "unowned_legacy_reference" });
      return;
    }
    unsupported.push({ location, kind: "unsupported_media_metadata" });
  };
  for (const plan of plans) {
    if (!plan) continue;
    collect(plan.clientFeedbackVideo, "clientFeedbackVideo");
    for (const [index, exercise] of (plan.exercises || []).entries()) {
      collect(
        exercise.clientFeedbackVideo,
        `exercises.${index}.clientFeedbackVideo`,
      );
    }
  }
  return { assets, unsupported };
};

export const collectPrivateCoachingMedia = (planOrPlans) =>
  collectCoachingMediaDeletionInventory(planOrPlans).assets.filter(
    isPrivateCoachingMedia,
  );

export const deletePrivateCoachingMedia = async (media) => {
  if (!isPrivateCoachingMedia(media)) {
    return { deleted: false, notPrivate: true };
  }
  const result = await destroyCloudinaryVideo(
    media.storageKey,
    "authenticated",
  );
  return {
    deleted: ["ok", "not found"].includes(result?.result),
    notFound: result?.result === "not found",
  };
};

export const deleteCoachingMediaAsset = async (media) => {
  if (isPrivateCoachingMedia(media)) {
    return deletePrivateCoachingMedia(media);
  }
  if (
    media?.provider === "cloudinary" &&
    media.deliveryType === "upload" &&
    /^htcoaching\/coaching-videos\/[A-Za-z0-9_/-]+$/.test(media.storageKey)
  ) {
    return deleteLegacyPublicCoachingMedia(media.storageKey);
  }
  if (media?.provider === "local" && media.deliveryType === "local") {
    const target = path.resolve(LEGACY_UPLOAD_ROOT, media.storageKey || "");
    if (!target.startsWith(`${LEGACY_UPLOAD_ROOT}${path.sep}`)) {
      throw new Error("Legacy coaching upload path is not allowlisted");
    }
    try {
      await unlink(target);
      return { deleted: true, notFound: false };
    } catch (error) {
      if (error?.code === "ENOENT") return { deleted: true, notFound: true };
      throw error;
    }
  }
  return { deleted: false, unsupported: true };
};

export const setCoachingPrivateMediaAdapterForTests = (adapter) => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Coaching media test adapter is only available in tests");
  }
  testAdapter = adapter;
};

export const resetCoachingPrivateMediaAdapterForTests = () => {
  testAdapter = null;
};
