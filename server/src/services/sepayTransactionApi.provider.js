import { normalizeSePayApiTransaction, SePayProviderError } from "./sepayBankTransaction.provider.js";

const ALLOWED_API_BASE_URLS = new Set([
  "https://userapi-sandbox.sepay.vn/v2",
  "https://userapi.sepay.vn/v2",
]);
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const PAGE_SIZE = 100;
const VIETNAM_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const providerError = (code, message, status = 502) =>
  new SePayProviderError(code, message, status);

const parseRetryAfterMs = (value) => {
  const normalized = String(value || "").trim();
  const seconds = Number(normalized);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? null
    : Math.max(0, date.getTime() - Date.now());
};

const assertAllowedBaseUrl = (value) => {
  const normalized = String(value || "").replace(/\/+$/, "");
  if (!ALLOWED_API_BASE_URLS.has(normalized)) {
    throw providerError(
      "SEPAY_API_HOST_NOT_ALLOWED",
      "SePay API host không được phép",
      503,
    );
  }
  return normalized;
};

const formatVietnamDateTime = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw providerError(
      "SEPAY_API_CUTOVER_REQUIRED",
      "Thiếu thời điểm bắt đầu đối soát SePay",
      503,
    );
  }
  const parts = Object.fromEntries(
    VIETNAM_TIME_FORMATTER.formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const parseEnvelope = (body) => {
  let envelope;
  try {
    envelope = JSON.parse(body);
  } catch {
    throw providerError("SEPAY_API_INVALID_JSON", "SePay API trả về JSON không hợp lệ");
  }
  if (
    !envelope ||
    envelope.status !== "success" ||
    !Array.isArray(envelope.data) ||
    envelope.data.length > PAGE_SIZE
  ) {
    throw providerError(
      "SEPAY_API_INVALID_RESPONSE",
      "SePay API trả về dữ liệu không hợp lệ",
    );
  }
  const pagination = envelope.meta?.pagination || {};
  return {
    transactions: envelope.data,
    pagination: {
      hasMore: pagination.has_more === true,
      currentPage: Number(pagination.current_page) || 1,
      lastPage: Number(pagination.last_page) || 1,
    },
  };
};

const readBoundedBody = async (response) => {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw providerError("SEPAY_API_RESPONSE_TOO_LARGE", "Phản hồi SePay API quá lớn");
  }
  if (!response.body?.getReader) {
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
      throw providerError("SEPAY_API_RESPONSE_TOO_LARGE", "Phản hồi SePay API quá lớn");
    }
    return body;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw providerError("SEPAY_API_RESPONSE_TOO_LARGE", "Phản hồi SePay API quá lớn");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, totalBytes).toString("utf8");
};

export const fetchSePayTransactions = async ({
  config,
  sinceId = null,
  page = 1,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  if (typeof fetchImpl !== "function") {
    throw providerError("SEPAY_API_FETCH_UNAVAILABLE", "Không thể gọi SePay API", 503);
  }
  const baseUrl = assertAllowedBaseUrl(config?.apiBaseUrl);
  const token = String(config?.apiToken || "").trim();
  if (token.length < 16) {
    throw providerError("SEPAY_API_TOKEN_REQUIRED", "Thiếu SePay API token", 503);
  }
  const url = new URL(`${baseUrl}/transactions`);
  url.searchParams.set("transfer_type", "in");
  url.searchParams.set("webhook_success", "0");
  url.searchParams.set("per_page", String(PAGE_SIZE));
  url.searchParams.set(
    "transaction_date_from",
    formatVietnamDateTime(config?.cutoverAt),
  );
  if (sinceId) url.searchParams.set("since_id", String(sinceId));
  if (page > 1) url.searchParams.set("page", String(page));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  let response;
  try {
    response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response?.ok) {
      const error = providerError(
        response?.status === 429
          ? "SEPAY_API_RATE_LIMITED"
          : "SEPAY_API_REQUEST_FAILED",
        "SePay API từ chối yêu cầu",
        response?.status === 429 ? 429 : 502,
      );
      if (response?.status === 429) {
        error.retryAfterMs = parseRetryAfterMs(
          response.headers?.get?.("retry-after") ||
            response.headers?.get?.("x-sepay-userapi-retry-after"),
        );
      }
      throw error;
    }

    const body = await readBoundedBody(response);
    const result = parseEnvelope(body);
    for (const transaction of result.transactions) {
      normalizeSePayApiTransaction(transaction);
    }
    return result;
  } catch (error) {
    if (error instanceof SePayProviderError) throw error;
    if (error?.name === "AbortError") {
      throw providerError("SEPAY_API_TIMEOUT", "SePay API quá thời gian chờ", 504);
    }
    throw providerError("SEPAY_API_UNAVAILABLE", "Không thể kết nối SePay API", 503);
  } finally {
    clearTimeout(timeout);
  }
};
