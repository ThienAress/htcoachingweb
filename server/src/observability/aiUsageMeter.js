import { AsyncLocalStorage } from "async_hooks";

// Gom usage provider của đúng một request AI (chat hoặc Meal Scan) để ước tính chi phí
// mỗi lượt. Ngoài phạm vi runWithAiUsageMeter mọi hàm meter* là no-op.
const storage = new AsyncLocalStorage();

const MAX_TOKENS_PER_CALL = 1_000_000;
const MAX_CALLS = 100;

const tokens = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_TOKENS_PER_CALL
    ? parsed
    : 0;
};

const createUsage = () => ({
  deepseek: {
    calls: 0,
    promptTokens: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    outputTokens: 0,
    surfaces: {},
  },
  gemini: { calls: 0, promptTokens: 0, outputTokens: 0, surfaces: {} },
  brave: { contextCalls: 0, imageCalls: 0 },
});

// Event listener (vd res.on("close")) không chạy trong context của run(), nên caller giữ
// tham chiếu meter để đọc usage sau khi response kết thúc.
export const createAiUsageMeter = () => ({ usage: createUsage() });

export const runWithAiUsageMeter = (meter, callback) => storage.run(meter, callback);

export const snapshotAiUsage = (meter) => structuredClone(meter.usage);

const countSurface = (bucket, surface) => {
  if (typeof surface !== "string" || bucket.calls >= MAX_CALLS) return false;
  bucket.calls += 1;
  bucket.surfaces[surface] = (bucket.surfaces[surface] || 0) + 1;
  return true;
};

export const meterDeepSeekUsage = (surface, usage = {}) => {
  const store = storage.getStore();
  if (!store || !countSurface(store.usage.deepseek, surface)) return;
  const bucket = store.usage.deepseek;
  bucket.promptTokens += tokens(usage?.prompt_tokens);
  bucket.cacheHitTokens += tokens(usage?.prompt_cache_hit_tokens);
  bucket.cacheMissTokens += tokens(usage?.prompt_cache_miss_tokens);
  bucket.outputTokens += tokens(usage?.completion_tokens);
};

export const meterGeminiUsage = (surface, usage = {}) => {
  const store = storage.getStore();
  if (!store || !countSurface(store.usage.gemini, surface)) return;
  const bucket = store.usage.gemini;
  bucket.promptTokens += tokens(usage?.promptTokens ?? usage?.promptTokenCount);
  bucket.outputTokens += tokens(usage?.outputTokens ?? usage?.candidatesTokenCount);
};

export const meterBraveRequest = (kind) => {
  const store = storage.getStore();
  if (!store) return;
  const brave = store.usage.brave;
  if (kind === "context" && brave.contextCalls < MAX_CALLS) brave.contextCalls += 1;
  if (kind === "image" && brave.imageCalls < MAX_CALLS) brave.imageCalls += 1;
};
