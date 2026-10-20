import { safeLog } from "../utils/safeLogger.js";

const SUPPORTED_PROVIDERS = ["mock", "openai", "gemini"];

// Nano Banana = dòng Gemini Image. Có thể đổi bản qua AI_IMAGE_MODEL
// (ví dụ gemini-3-pro-image-preview) mà không cần sửa code.
const DEFAULT_MODELS = {
  openai: "gpt-image-1",
  gemini: "gemini-2.5-flash-image",
  mock: "mock-image",
};
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_TIMEOUT_MS = 120_000;

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

// Lỗi từ nhà cung cấp ảnh được đổi sang thông báo tiếng Việt an toàn (không lộ
// khoá API hay nội dung thô của provider) và đánh dấu `expose` để errorHandler
// trả thẳng cho người dùng. Nội dung gốc chỉ ghi vào log đã lọc.
export const buildProviderError = ({ provider, status, rawMessage }) => {
  const httpStatus = Number(status) || 502;
  let code = "AI_IMAGE_PROVIDER_ERROR";
  let responseStatus = 502;
  let message =
    "Dịch vụ tạo ảnh đang gặp sự cố. Vui lòng thử lại sau ít phút.";

  if (httpStatus === 429) {
    code = "AI_IMAGE_PROVIDER_RATE_LIMITED";
    responseStatus = 429;
    message =
      "Dịch vụ tạo ảnh đang quá tải hoặc đã hết hạn mức. Vui lòng thử lại sau ít phút; lượt tạo chưa bị tính.";
  } else if (httpStatus === 401 || httpStatus === 403) {
    code = "AI_IMAGE_PROVIDER_AUTH";
    message =
      "Khoá dịch vụ tạo ảnh chưa hợp lệ hoặc chưa được cấp quyền. Vui lòng liên hệ quản trị viên.";
  } else if (httpStatus >= 400 && httpStatus < 500) {
    code = "AI_IMAGE_PROVIDER_REJECTED";
    message =
      "Dịch vụ tạo ảnh từ chối yêu cầu này. Hãy thử ảnh khác hoặc liên hệ quản trị viên.";
  }

  safeLog.error("ai_image.provider_error", new Error(String(rawMessage || "")), {
    provider,
    providerStatus: httpStatus,
  });

  const error = new Error(message);
  error.status = responseStatus;
  error.code = code;
  error.expose = true;
  return error;
};

const getProviderConfig = () => {
  const provider = safeText(
    process.env.AI_IMAGE_PROVIDER ||
      (process.env.NODE_ENV === "production" ? "" : "mock"),
  ).toLowerCase();

  const model = safeText(
    process.env.AI_IMAGE_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai,
  );

  const openaiApiKey = safeText(process.env.OPENAI_API_KEY || "");
  const geminiApiKey = safeText(process.env.GEMINI_API_KEY || "");

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    const error = new Error(
      `AI_IMAGE_PROVIDER không hợp lệ. Chỉ hỗ trợ: ${SUPPORTED_PROVIDERS.join(
        ", ",
      )}`,
    );
    error.status = 500;
    throw error;
  }

  if (process.env.NODE_ENV === "production" && provider === "mock") {
    const error = new Error(
      "AI_IMAGE_PROVIDER=mock is forbidden in production",
    );
    error.code = "AI_IMAGE_PROVIDER_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }

  return {
    provider,
    model,
    openaiApiKey,
    geminiApiKey,
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

  if (!isSupportedImageRef(frontUrl) || !isSupportedImageRef(sideUrl)) {
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
    throw buildProviderError({
      provider: "openai",
      status: response.status,
      rawMessage:
        safeText(data?.error?.message) ||
        safeText(data?.message) ||
        "OpenAI image edit trả về lỗi",
    });
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

const callGeminiImageEdit = async ({
  imageUrl,
  prompt,
  phaseKey,
  view,
  model,
  geminiApiKey,
}) => {
  if (!geminiApiKey) {
    const error = new Error("Thiếu GEMINI_API_KEY");
    error.status = 500;
    throw error;
  }

  const sourceBlob = await fetchImageAsBlob(imageUrl);
  const mimeType = getMimeTypeFromContentType(sourceBlob.type);
  const base64 = Buffer.from(await sourceBlob.arrayBuffer()).toString("base64");

  const response = await fetch(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: buildOpenAiEditPrompt({ prompt, phaseKey, view }) },
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    },
  );

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    throw buildProviderError({
      provider: "gemini",
      status: response.status,
      rawMessage: safeText(data?.error?.message) || "Gemini image trả về lỗi",
    });
  }

  const blockReason = safeText(data?.promptFeedback?.blockReason);
  if (blockReason) {
    const error = new Error(
      "Gemini từ chối tạo ảnh do bộ lọc an toàn. Hãy thử ảnh khác hoặc ảnh đủ trang phục.",
    );
    error.status = 422;
    error.code = "AI_IMAGE_PROVIDER_SAFETY_BLOCK";
    error.expose = true;
    throw error;
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => (part.inlineData || part.inline_data)?.data);
  const inline = imagePart?.inlineData || imagePart?.inline_data;

  if (!inline?.data) {
    const error = new Error("Gemini không trả về ảnh kết quả");
    error.status = 502;
    throw error;
  }

  return base64ToDataUrl(
    inline.data,
    safeText(inline.mimeType || inline.mime_type) || "image/png",
  );
};

const generateGeminiStageImages = async ({
  beforeImages,
  prompts,
  phaseKey,
  provider,
  model,
  geminiApiKey,
}) => {
  const frontSource = safeText(beforeImages?.frontUrl);
  const sideSource = safeText(beforeImages?.sideUrl);

  if (!isSupportedImageRef(frontSource) || !isSupportedImageRef(sideSource)) {
    const error = new Error(
      "Gemini image generator cần beforeImages.frontUrl và beforeImages.sideUrl hợp lệ",
    );
    error.status = 400;
    throw error;
  }

  const [frontUrl, sideUrl] = await Promise.all([
    callGeminiImageEdit({
      imageUrl: frontSource,
      prompt: safeText(prompts?.front),
      phaseKey,
      view: "front",
      model,
      geminiApiKey,
    }),
    callGeminiImageEdit({
      imageUrl: sideSource,
      prompt: safeText(prompts?.side),
      phaseKey,
      view: "side",
      model,
      geminiApiKey,
    }),
  ]);

  return normalizeGeneratedImageRefs({ frontUrl, sideUrl, provider, model });
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

  if (config.provider === "gemini") {
    return generateGeminiStageImages({
      beforeImages,
      prompts,
      phaseKey,
      provider: config.provider,
      model: config.model,
      geminiApiKey: config.geminiApiKey,
    });
  }

  const error = new Error("AI image provider chưa được hỗ trợ");
  error.status = 500;
  throw error;
};
