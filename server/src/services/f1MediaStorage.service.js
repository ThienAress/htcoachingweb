import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

const LOCAL_ROOT = path.resolve(
  process.env.F1_PRIVATE_MEDIA_DIR || ".private/f1-media",
);

let testAdapter = null;

const getConfiguredProvider = () => {
  if (testAdapter) return "mock";
  const explicit = String(process.env.F1_MEDIA_STORAGE_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (explicit) return explicit;
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    return "cloudinary";
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "F1_MEDIA_STORAGE_PROVIDER/cloudinary credentials are required in production",
    );
  }
  return "local_private";
};

const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

const resolveLocalPath = (storageKey) => {
  const normalized = String(storageKey || "").replaceAll("\\", "/");
  const absolute = path.resolve(LOCAL_ROOT, normalized);
  const relative = path.relative(LOCAL_ROOT, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    const error = new Error("Invalid private media storage key");
    error.code = "F1_MEDIA_INVALID_STORAGE_KEY";
    throw error;
  }
  return absolute;
};

const putCloudinary = (buffer, options) => {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        type: "authenticated",
        access_mode: "authenticated",
        folder: "htcoaching/f1-private",
        public_id: `${options.customerId}-${options.mediaId}`,
        overwrite: true,
        unique_filename: false,
        invalidate: true,
        format: options.format || "webp",
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve({
          provider: "cloudinary",
          storageKey: result.public_id,
          version: result.version,
        });
      },
    );
    stream.end(buffer);
  });
};

const putLocal = async (buffer, options) => {
  const storageKey = `${options.customerId}/${options.mediaId}.${options.format || "webp"}`;
  const absolute = resolveLocalPath(storageKey);
  await fsPromises.mkdir(path.dirname(absolute), { recursive: true });
  await fsPromises.writeFile(absolute, buffer, { flag: "wx" });
  return { provider: "local_private", storageKey };
};

export const putProcessedImage = async (buffer, options) => {
  if (testAdapter?.putProcessedImage) {
    return testAdapter.putProcessedImage(buffer, options);
  }
  const provider = getConfiguredProvider();
  if (provider === "cloudinary") return putCloudinary(buffer, options);
  if (provider === "local_private") return putLocal(buffer, options);
  throw new Error(`Unsupported F1 media storage provider: ${provider}`);
};

export const getSignedReadUrl = async (media, expiresInSeconds = 300) => {
  if (testAdapter?.getSignedReadUrl) {
    return testAdapter.getSignedReadUrl(media, expiresInSeconds);
  }
  if (media.provider !== "cloudinary") return null;
  configureCloudinary();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return cloudinary.utils.private_download_url(
    media.storageKey,
    media.format || "webp",
    {
      resource_type: "image",
      type: "authenticated",
      expires_at: expiresAt,
    },
  );
};

export const openPrivateReadStream = (media) => {
  if (testAdapter?.openPrivateReadStream) {
    return testAdapter.openPrivateReadStream(media);
  }
  if (media.provider !== "local_private") return null;
  return fs.createReadStream(resolveLocalPath(media.storageKey));
};

export const readPrivateObject = async (media) => {
  if (testAdapter?.readPrivateObject) {
    return testAdapter.readPrivateObject(media);
  }
  if (media.provider !== "local_private") return null;
  return fsPromises.readFile(resolveLocalPath(media.storageKey));
};

export const getPrivateImageReference = async (media, expiresInSeconds = 300) => {
  const signedUrl = await getSignedReadUrl(media, expiresInSeconds);
  if (signedUrl) return signedUrl;
  const buffer = await readPrivateObject(media);
  if (!buffer) {
    const error = new Error("Không thể đọc private F1 media");
    error.code = "F1_MEDIA_READ_FAILED";
    error.status = 502;
    throw error;
  }
  return `data:${media.mimeType || "image/webp"};base64,${buffer.toString("base64")}`;
};

export const deleteObject = async ({ provider, storageKey }) => {
  if (testAdapter?.deleteObject) {
    return testAdapter.deleteObject({ provider, storageKey });
  }
  if (!storageKey) return { deleted: true, notFound: true };
  if (provider === "cloudinary") {
    configureCloudinary();
    const result = await cloudinary.uploader.destroy(storageKey, {
      resource_type: "image",
      type: "authenticated",
      invalidate: true,
    });
    return {
      deleted: ["ok", "not found"].includes(result.result),
      notFound: result.result === "not found",
    };
  }
  if (provider === "local_private") {
    try {
      await fsPromises.unlink(resolveLocalPath(storageKey));
      return { deleted: true, notFound: false };
    } catch (error) {
      if (error.code === "ENOENT") return { deleted: true, notFound: true };
      throw error;
    }
  }
  if (provider === "legacy_local") {
    const legacyRoot = path.resolve("uploads/f1-media");
    const absolute = path.resolve(legacyRoot, path.basename(storageKey));
    try {
      await fsPromises.unlink(absolute);
      return { deleted: true, notFound: false };
    } catch (error) {
      if (error.code === "ENOENT") return { deleted: true, notFound: true };
      throw error;
    }
  }
  throw new Error(`Unsupported F1 media storage provider: ${provider}`);
};

export const getMetadata = async (media) => {
  if (testAdapter?.getMetadata) return testAdapter.getMetadata(media);
  if (media.provider === "cloudinary") {
    configureCloudinary();
    try {
      return await cloudinary.api.resource(media.storageKey, {
        resource_type: "image",
        type: "authenticated",
      });
    } catch (error) {
      if (error.http_code === 404) return null;
      throw error;
    }
  }
  if (media.provider === "local_private") {
    try {
      const stat = await fsPromises.stat(resolveLocalPath(media.storageKey));
      return { bytes: stat.size };
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  if (media.provider === "legacy_local") {
    try {
      const absolute = path.resolve(
        "uploads/f1-media",
        path.basename(media.storageKey || media.publicId),
      );
      const stat = await fsPromises.stat(absolute);
      return { bytes: stat.size };
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  return null;
};

export const getF1MediaStorageProvider = getConfiguredProvider;

export const setF1MediaStorageAdapterForTests = (adapter) => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("F1 media test adapter is only available in tests");
  }
  testAdapter = adapter;
};

export const resetF1MediaStorageAdapterForTests = () => {
  testAdapter = null;
};
