const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_CHAT_IMAGE_BYTES = 280 * 1024;

export function dataUrlByteLength(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

const loadBitmap = async (file) => {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Không thể đọc hình ảnh"));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export async function compressChatImage(file) {
  if (!file || !SUPPORTED_TYPES.has(file.type)) {
    throw new Error("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Ảnh gốc không được vượt quá 10 MB");
  }

  const bitmap = await loadBitmap(file);
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  let scale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight));
  let result = "";

  try {
    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Trình duyệt không hỗ trợ nén ảnh");
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of [0.82, 0.7, 0.58, 0.46]) {
        result = canvas.toDataURL("image/webp", quality);
        if (dataUrlByteLength(result) <= MAX_CHAT_IMAGE_BYTES) return result;
      }
      scale *= 0.78;
    }
  } finally {
    bitmap.close?.();
  }

  if (dataUrlByteLength(result) > MAX_CHAT_IMAGE_BYTES) {
    throw new Error("Không thể nén ảnh xuống dưới 280 KB");
  }
  return result;
}
