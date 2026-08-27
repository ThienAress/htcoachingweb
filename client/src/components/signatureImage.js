export const SIGNATURE_SOURCE_ACCEPT = "image/png,image/jpeg,image/webp";
export const MAX_SIGNATURE_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_SIGNATURE_OUTPUT_BYTES = 512 * 1024;

const SOURCE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const validateSignatureSourceFile = (file) => {
  if (!file || !SOURCE_TYPES.has(String(file.type || "").toLowerCase())) {
    return "Chỉ hỗ trợ ảnh PNG, JPG/JPEG hoặc WebP.";
  }
  if (!Number.isFinite(file.size) || file.size > MAX_SIGNATURE_SOURCE_BYTES) {
    return "Ảnh chữ ký nguồn không được vượt quá 5 MB.";
  }
  return null;
};

export const fitSignatureDimensions = (width, height) => {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const scale = Math.min(1, 1200 / safeWidth, 400 / safeHeight);
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
};

export const signatureDataUrlBytes = (dataUrl) => {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, (base64.length * 3) / 4 - padding);
};

const readFile = (file, FileReaderCtor) =>
  new Promise((resolve, reject) => {
    const reader = new FileReaderCtor();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể đọc ảnh chữ ký."));
    reader.readAsDataURL(file);
  });

const loadImage = (source, ImageCtor) =>
  new Promise((resolve, reject) => {
    const image = new ImageCtor();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Ảnh chữ ký không hợp lệ hoặc đã hỏng."));
    image.src = source;
  });

export const normalizeSignatureSourceFile = async (
  file,
  {
    documentRef = document,
    FileReaderCtor = FileReader,
    ImageCtor = Image,
  } = {},
) => {
  const validationError = validateSignatureSourceFile(file);
  if (validationError) throw new Error(validationError);

  const source = await readFile(file, FileReaderCtor);
  const image = await loadImage(source, ImageCtor);
  let dimensions = fitSignatureDimensions(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
  );

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = documentRef.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt không thể xử lý ảnh chữ ký.");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const output = canvas.toDataURL("image/png");
    if (signatureDataUrlBytes(output) <= MAX_SIGNATURE_OUTPUT_BYTES) {
      return output;
    }
    dimensions = {
      width: Math.max(1, Math.round(dimensions.width * 0.75)),
      height: Math.max(1, Math.round(dimensions.height * 0.75)),
    };
  }

  throw new Error(
    "Ảnh chữ ký vẫn quá lớn sau khi tối ưu. Hãy dùng ảnh PNG nền trong suốt, ít chi tiết hơn.",
  );
};
