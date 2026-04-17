const SUPPORTED_PROVIDERS = ["mock", "openai"];

const safeText = (value = "") => String(value || "").trim();

const isValidHttpUrl = (value = "") => {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
};

const isValidDataUrl = (value = "") =>
  /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(String(value || "").trim());

const isSupportedImageRef = (value = "") =>
  isValidHttpUrl(value) || isValidDataUrl(value);

const getProviderConfig = () => {
  const provider = safeText(
    process.env.AI_IMAGE_PROVIDER || "mock",
  ).toLowerCase();

  const model = safeText(process.env.AI_IMAGE_MODEL || "gpt-image-1");

  const openaiApiKey = safeText(process.env.OPENAI_API_KEY || "");

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    const error = new Error(
      `AI_IMAGE_PROVIDER không hợp lệ. Chỉ hỗ trợ: ${SUPPORTED_PROVIDERS.join(
        ", ",
      )}`,
    );
    error.status = 500;
    throw error;
  }

  return {
    provider,
    model,
    openaiApiKey,
  };
};

const normalizeGeneratedImageRefs = ({
  frontUrl,
  sideUrl,
  provider,
  model,
}) => {
  const normalizedFrontUrl = safeText(frontUrl);
  const normalizedSideUrl = safeText(sideUrl);

  if (!isSupportedImageRef(normalizedFrontUrl)) {
    const error = new Error("frontUrl trả về từ AI provider không hợp lệ");
    error.status = 502;
    throw error;
  }

  if (!isSupportedImageRef(normalizedSideUrl)) {
    const error = new Error("sideUrl trả về từ AI provider không hợp lệ");
    error.status = 502;
    throw error;
  }

  return {
    frontUrl: normalizedFrontUrl,
    sideUrl: normalizedSideUrl,
    provider: safeText(provider),
    model: safeText(model),
  };
};

const generateMockStageImages = async ({
  beforeImages,
  phaseKey,
  provider,
  model,
}) => {
  const frontUrl = safeText(beforeImages?.frontUrl);
  const sideUrl = safeText(beforeImages?.sideUrl);

  if (!isValidHttpUrl(frontUrl) || !isValidHttpUrl(sideUrl)) {
    const error = new Error(
      "Mock AI generator cần beforeImages.frontUrl và beforeImages.sideUrl hợp lệ",
    );
    error.status = 400;
    throw error;
  }

  // Mock mode chỉ để test full luồng FE/BE.
  // Nó KHÔNG tạo ảnh mới, chỉ trả lại ảnh before để UI/DB contract chạy thông.
  return normalizeGeneratedImageRefs({
    frontUrl,
    sideUrl,
    provider,
    model: `${model}-mock-${phaseKey}`,
  });
};

const getMimeTypeFromContentType = (contentType = "") => {
  const normalized = safeText(contentType).toLowerCase();

  if (normalized.includes("image/png")) return "image/png";
  if (normalized.includes("image/jpeg")) return "image/jpeg";
  if (normalized.includes("image/jpg")) return "image/jpeg";
  if (normalized.includes("image/webp")) return "image/webp";

  return "image/png";
};

const getFileExtensionFromMimeType = (mimeType = "") => {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
};

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const fetchImageAsBlob = async (imageUrl) => {
  const value = safeText(imageUrl);

  if (isValidDataUrl(value)) {
    return dataUrlToBlob(value);
  }

  const response = await fetch(value);

  if (!response.ok) {
    const error = new Error(`Không thể tải ảnh nguồn: ${value}`);
    error.status = 502;
    throw error;
  }

  return response.blob();
};

const blobToDataUrl = async (blob) => {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const mimeType = safeText(blob.type) || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
};

const base64ToDataUrl = (base64, mimeType = "image/png") =>
  `data:${mimeType};base64,${safeText(base64)}`;

const buildOpenAiEditPrompt = ({ prompt, phaseKey, view }) => {
  const extraRules = [
    "Keep the same person recognizable.",
    "Preserve the same general pose and camera angle.",
    "Keep the image realistic and avoid exaggerated or unnatural body changes.",
    "Keep the background simple and consistent when possible.",
    "This is a visual simulation of the body after training at the specified phase.",
    `View: ${view}.`,
    `Phase key: ${phaseKey}.`,
  ];

  return `${safeText(prompt)} ${extraRules.join(" ")}`.trim();
};

const callOpenAiImageEdit = async ({
  imageUrl,
  prompt,
  phaseKey,
  view,
  model,
  openaiApiKey,
}) => {
  if (!openaiApiKey) {
    const error = new Error("Thiếu OPENAI_API_KEY");
    error.status = 500;
    throw error;
  }

  const sourceBlob = await fetchImageAsBlob(imageUrl);
  const mimeType = getMimeTypeFromContentType(sourceBlob.type);
  const ext = getFileExtensionFromMimeType(mimeType);

  const formData = new FormData();
  formData.append(
    "image",
    new File([sourceBlob], `${view}.${ext}`, { type: mimeType }),
  );
  formData.append("prompt", buildOpenAiEditPrompt({ prompt, phaseKey, view }));
  formData.append("model", model);
  formData.append("size", "1024x1024");

  // Một số model hỗ trợ input_fidelity
  formData.append("input_fidelity", "high");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: formData,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const message =
      safeText(data?.error?.message) ||
      safeText(data?.message) ||
      "OpenAI image edit trả về lỗi";
    const error = new Error(message);
    error.status = response.status || 502;
    throw error;
  }

  const firstImage = data?.data?.[0];

  if (!firstImage) {
    const error = new Error("OpenAI không trả về ảnh kết quả");
    error.status = 502;
    throw error;
  }

  if (firstImage.b64_json) {
    return base64ToDataUrl(firstImage.b64_json, "image/png");
  }

  if (firstImage.url && isValidHttpUrl(firstImage.url)) {
    return firstImage.url;
  }

  const error = new Error("Kết quả ảnh từ OpenAI không hợp lệ");
  error.status = 502;
  throw error;
};

const generateOpenAiStageImages = async ({
  beforeImages,
  prompts,
  phaseKey,
  provider,
  model,
  openaiApiKey,
}) => {
  const frontSource = safeText(beforeImages?.frontUrl);
  const sideSource = safeText(beforeImages?.sideUrl);

  if (!isSupportedImageRef(frontSource) || !isSupportedImageRef(sideSource)) {
    const error = new Error(
      "OpenAI image generator cần beforeImages.frontUrl và beforeImages.sideUrl hợp lệ",
    );
    error.status = 400;
    throw error;
  }

  const [frontUrl, sideUrl] = await Promise.all([
    callOpenAiImageEdit({
      imageUrl: frontSource,
      prompt: safeText(prompts?.front),
      phaseKey,
      view: "front",
      model,
      openaiApiKey,
    }),
    callOpenAiImageEdit({
      imageUrl: sideSource,
      prompt: safeText(prompts?.side),
      phaseKey,
      view: "side",
      model,
      openaiApiKey,
    }),
  ]);

  return normalizeGeneratedImageRefs({
    frontUrl,
    sideUrl,
    provider,
    model,
  });
};

export const generateStageImagesWithAI = async ({
  beforeImages,
  prompts,
  context,
  phaseKey,
}) => {
  const config = getProviderConfig();

  if (config.provider === "mock") {
    return generateMockStageImages({
      beforeImages,
      phaseKey,
      provider: config.provider,
      model: config.model,
    });
  }

  if (config.provider === "openai") {
    return generateOpenAiStageImages({
      beforeImages,
      prompts,
      context,
      phaseKey,
      provider: config.provider,
      model: config.model,
      openaiApiKey: config.openaiApiKey,
    });
  }

  const error = new Error("AI image provider chưa được hỗ trợ");
  error.status = 500;
  throw error;
};
