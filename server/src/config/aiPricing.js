// Đơn giá ước tính chi phí AI (USD). Mặc định theo bảng giá công khai tháng 10/2026;
// production gọi DeepSeek qua Vibi nên owner ghi đè bằng env theo hóa đơn thật.
// Đây chỉ là số ước tính cho báo cáo, không phải số liệu billing.

const DEFAULT_PRICES = Object.freeze({
  deepseekInputMissPerMillion: 0.15,
  deepseekInputHitPerMillion: 0.003,
  deepseekOutputPerMillion: 0.6,
  geminiInputPerMillion: 0.1,
  geminiOutputPerMillion: 0.4,
  braveContextPerRequest: 0.005,
  braveImagePerRequest: 0.005,
});

const ENV_KEYS = Object.freeze({
  deepseekInputMissPerMillion: "AI_PRICE_DEEPSEEK_INPUT_MISS_PER_M",
  deepseekInputHitPerMillion: "AI_PRICE_DEEPSEEK_INPUT_HIT_PER_M",
  deepseekOutputPerMillion: "AI_PRICE_DEEPSEEK_OUTPUT_PER_M",
  geminiInputPerMillion: "AI_PRICE_GEMINI_INPUT_PER_M",
  geminiOutputPerMillion: "AI_PRICE_GEMINI_OUTPUT_PER_M",
  braveContextPerRequest: "AI_PRICE_BRAVE_CONTEXT_PER_REQUEST",
  braveImagePerRequest: "AI_PRICE_BRAVE_IMAGE_PER_REQUEST",
});

export const resolveAiPrices = (env = process.env) => {
  const prices = {};
  for (const [key, fallback] of Object.entries(DEFAULT_PRICES)) {
    const raw = env[ENV_KEYS[key]];
    const parsed = raw === undefined || raw === "" ? NaN : Number(raw);
    prices[key] = Number.isFinite(parsed) && parsed >= 0 && parsed < 1000 ? parsed : fallback;
  }
  return Object.freeze(prices);
};

const perMillion = (tokens, price) => (tokens * price) / 1_000_000;

/**
 * Chi phí ước tính của một lượt từ usage đã gom. Token cache không rõ (provider không trả
 * hit/miss) được tính như cache miss để không đánh giá thấp chi phí.
 */
export const estimateAiUsageCostUsd = (usage, prices = resolveAiPrices()) => {
  const deepseek = usage?.deepseek || {};
  const gemini = usage?.gemini || {};
  const brave = usage?.brave || {};
  const hit = deepseek.cacheHitTokens || 0;
  const miss = Math.max(
    deepseek.cacheMissTokens || 0,
    (deepseek.promptTokens || 0) - hit,
  );
  const cost =
    perMillion(miss, prices.deepseekInputMissPerMillion) +
    perMillion(hit, prices.deepseekInputHitPerMillion) +
    perMillion(deepseek.outputTokens || 0, prices.deepseekOutputPerMillion) +
    perMillion(gemini.promptTokens || 0, prices.geminiInputPerMillion) +
    perMillion(gemini.outputTokens || 0, prices.geminiOutputPerMillion) +
    (brave.contextCalls || 0) * prices.braveContextPerRequest +
    (brave.imageCalls || 0) * prices.braveImagePerRequest;
  return Math.round(cost * 1e8) / 1e8;
};
