const SUPPORTED_PROVIDERS = ["mock", "webhook"];

const safeText = (value = "") => String(value || "").trim();

const isValidHttpUrl = (value = "") => {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
};

const getProviderConfig = () => {
  const provider = safeText(
    process.env.AI_IMAGE_PROVIDER || "mock",
  ).toLowerCase();
  const model = safeText(
    process.env.AI_IMAGE_MODEL || "default-stage-image-model",
  );
  const webhookUrl = safeText(process.env.AI_IMAGE_WEBHOOK_URL || "");
  const webhookApiKey = safeText(process.env.AI_IMAGE_WEBHOOK_API_KEY || "");

  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    const error = new Error(
      `AI_IMAGE_PROVIDER không hợp lệ. Chỉ hỗ trợ: ${SUPPORTED_PROVIDERS.join(", ")}`,
    );
    error.status = 500;
    throw error;
  }

  return {
    provider,
    model,
    webhookUrl,
    webhookApiKey,
  };
};

const normalizeGeneratedImageUrls = ({
  frontUrl,
  sideUrl,
  provider,
  model,
}) => {
  const normalizedFrontUrl = safeText(frontUrl);
  const normalizedSideUrl = safeText(sideUrl);

  if (!isValidHttpUrl(normalizedFrontUrl)) {
    const error = new Error("frontUrl trả về từ AI provider không hợp lệ");
    error.status = 502;
    throw error;
  }

  if (!isValidHttpUrl(normalizedSideUrl)) {
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
  return normalizeGeneratedImageUrls({
    frontUrl,
    sideUrl,
    provider,
    model: `${model}-mock-${phaseKey}`,
  });
};

const generateWebhookStageImages = async ({
  beforeImages,
  prompts,
  context,
  phaseKey,
  provider,
  model,
  webhookUrl,
  webhookApiKey,
}) => {
  if (!webhookUrl) {
    const error = new Error("Thiếu AI_IMAGE_WEBHOOK_URL cho provider webhook");
    error.status = 500;
    throw error;
  }

  const payload = {
    phaseKey,
    model,
    context,
    beforeImages: {
      frontUrl: safeText(beforeImages?.frontUrl),
      sideUrl: safeText(beforeImages?.sideUrl),
    },
    prompts: {
      front: safeText(prompts?.front),
      side: safeText(prompts?.side),
    },
  };

  const headers = {
    "Content-Type": "application/json",
  };

  if (webhookApiKey) {
    headers.Authorization = `Bearer ${webhookApiKey}`;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    const message =
      safeText(data?.message) ||
      safeText(data?.error) ||
      "AI image webhook trả về lỗi";
    const error = new Error(message);
    error.status = response.status || 502;
    throw error;
  }

  return normalizeGeneratedImageUrls({
    frontUrl: data?.data?.frontUrl || data?.frontUrl,
    sideUrl: data?.data?.sideUrl || data?.sideUrl,
    provider,
    model: safeText(data?.data?.model || data?.model || model),
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

  if (config.provider === "webhook") {
    return generateWebhookStageImages({
      beforeImages,
      prompts,
      context,
      phaseKey,
      provider: config.provider,
      model: config.model,
      webhookUrl: config.webhookUrl,
      webhookApiKey: config.webhookApiKey,
    });
  }

  const error = new Error("AI image provider chưa được hỗ trợ");
  error.status = 500;
  throw error;
};
