import crypto from "crypto";
import sharp from "sharp";

const MAX_INPUT_BYTES = Math.max(
  Number(process.env.F1_MEDIA_MAX_INPUT_BYTES || 8 * 1024 * 1024),
  1024,
);
const MAX_INPUT_DIMENSION = Math.max(
  Number(process.env.F1_MEDIA_MAX_INPUT_DIMENSION || 8000),
  1000,
);
const MAX_INPUT_PIXELS = Math.max(
  Number(process.env.F1_MEDIA_MAX_INPUT_PIXELS || 25_000_000),
  1_000_000,
);
const OUTPUT_DIMENSION = Math.max(
  Number(process.env.F1_MEDIA_OUTPUT_DIMENSION || 2400),
  640,
);
const REMOTE_TIMEOUT_MS = Math.max(
  Number(process.env.F1_MEDIA_REMOTE_TIMEOUT_MS || 15_000),
  1000,
);

const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp"]);

const mediaError = (message, code, status = 400) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const assertInputSize = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw mediaError("File ảnh trống hoặc không hợp lệ", "F1_MEDIA_EMPTY");
  }
  if (buffer.length > MAX_INPUT_BYTES) {
    throw mediaError("Ảnh vượt quá giới hạn dung lượng", "F1_MEDIA_TOO_LARGE");
  }
};

export const processF1Image = async (inputBuffer) => {
  assertInputSize(inputBuffer);

  try {
    const image = sharp(inputBuffer, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    });
    const metadata = await image.metadata();

    if (!SUPPORTED_FORMATS.has(metadata.format)) {
      throw mediaError(
        "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP hợp lệ",
        "F1_MEDIA_UNSUPPORTED_FORMAT",
      );
    }

    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (
      !width ||
      !height ||
      width > MAX_INPUT_DIMENSION ||
      height > MAX_INPUT_DIMENSION ||
      width * height > MAX_INPUT_PIXELS
    ) {
      throw mediaError(
        "Kích thước hoặc tổng số pixel của ảnh vượt giới hạn",
        "F1_MEDIA_DIMENSIONS_EXCEEDED",
      );
    }

    const output = await image
      .rotate()
      .resize({
        width: OUTPUT_DIMENSION,
        height: OUTPUT_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: output.data,
      checksum: crypto.createHash("sha256").update(output.data).digest("hex"),
      format: "webp",
      mimeType: "image/webp",
      width: output.info.width,
      height: output.info.height,
      sizeBytes: output.data.length,
    };
  } catch (error) {
    if (error.code?.startsWith("F1_MEDIA_")) throw error;
    throw mediaError(
      "Nội dung file không phải ảnh hợp lệ hoặc ảnh đã bị hỏng",
      "F1_MEDIA_DECODE_FAILED",
    );
  }
};

const decodeDataUrl = (value) => {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(
    value,
  );
  if (!match) {
    throw mediaError("Data URL ảnh không hợp lệ", "F1_MEDIA_INVALID_DATA_URL");
  }
  const buffer = Buffer.from(match[1], "base64");
  assertInputSize(buffer);
  return buffer;
};

const getAllowedRemoteHosts = () =>
  new Set(
    [
      "res.cloudinary.com",
      "oaidalleapiprodscus.blob.core.windows.net",
      ...(process.env.F1_MEDIA_REMOTE_HOSTS || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ],
  );

export const fetchF1ImageReference = async (reference) => {
  const value = String(reference || "").trim();
  if (value.startsWith("data:image/")) return decodeDataUrl(value);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw mediaError("URL ảnh không hợp lệ", "F1_MEDIA_INVALID_REMOTE_URL");
  }
  if (url.protocol !== "https:" || !getAllowedRemoteHosts().has(url.hostname)) {
    throw mediaError(
      "Nguồn ảnh không nằm trong allowlist",
      "F1_MEDIA_REMOTE_HOST_DENIED",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) {
      throw mediaError(
        "Không thể tải ảnh từ provider",
        "F1_MEDIA_REMOTE_FETCH_FAILED",
        502,
      );
    }
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_INPUT_BYTES) {
      throw mediaError(
        "Ảnh provider vượt quá giới hạn dung lượng",
        "F1_MEDIA_TOO_LARGE",
      );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    assertInputSize(buffer);
    return buffer;
  } catch (error) {
    if (error.code?.startsWith("F1_MEDIA_")) throw error;
    throw mediaError(
      "Không thể tải ảnh từ provider",
      "F1_MEDIA_REMOTE_FETCH_FAILED",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const F1_IMAGE_LIMITS = {
  maxInputBytes: MAX_INPUT_BYTES,
  maxInputDimension: MAX_INPUT_DIMENSION,
  maxInputPixels: MAX_INPUT_PIXELS,
  outputDimension: OUTPUT_DIMENSION,
};
