import crypto from "crypto";

const DEPOSIT_CODE_PATTERN =
  /\bHTC(?:-[A-F0-9]{4}-[A-F0-9]{4}|[A-F0-9]{8})\b(?!-)/i;
const DEPOSIT_CODE_PATTERN_GLOBAL =
  /\bHTC(?:-[A-F0-9]{4}-[A-F0-9]{4}|[A-F0-9]{8})\b(?!-)/gi;
const TRANSACTION_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export class SePayProviderError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "SePayProviderError";
    this.code = code;
    this.status = status;
  }
}

const malformed = (message) => {
  throw new SePayProviderError("MALFORMED_PAYLOAD", message, 400);
};

const boundedString = (value, { maximum, required = true, name }) => {
  const normalized = String(value ?? "").trim();
  if ((required && !normalized) || normalized.length > maximum) {
    malformed(`${name} không hợp lệ`);
  }
  return normalized;
};

const normalizeAccountNumber = (value) => {
  const accountNumber = boundedString(value, {
    maximum: 40,
    name: "accountNumber",
  }).replace(/\s+/g, "");
  if (!/^[A-Z0-9]{4,34}$/i.test(accountNumber)) {
    malformed("accountNumber không hợp lệ");
  }
  return accountNumber.toUpperCase();
};

const normalizeTransactionAt = (value) => {
  const input = boundedString(value, {
    maximum: 19,
    name: "transactionDate",
  });
  const match = input.match(TRANSACTION_DATE_PATTERN);
  if (!match) {
    malformed("transactionDate không hợp lệ");
  }
  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] =
    match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    malformed("transactionDate không hợp lệ");
  }
  const parsed = new Date(input.replace(" ", "T") + "+07:00");
  if (Number.isNaN(parsed.getTime())) {
    malformed("transactionDate không hợp lệ");
  }
  return parsed;
};

const normalizeAmount = (value) => {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    malformed("Số tiền giao dịch không hợp lệ");
  }
  return amount;
};

const normalizeTransferType = (value) => {
  const transferType = String(value || "").trim().toLowerCase();
  if (!["in", "out"].includes(transferType)) {
    malformed("transferType không hợp lệ");
  }
  return transferType;
};

const canonicalizeDepositCode = (value) => {
  const compact = value.toUpperCase().replaceAll("-", "");
  return `HTC-${compact.slice(3, 7)}-${compact.slice(7)}`;
};

const normalizeDepositCode = (code, content) => {
  const direct = String(code ?? "").trim().match(DEPOSIT_CODE_PATTERN)?.[0];
  const contentCodes =
    String(content ?? "").match(DEPOSIT_CODE_PATTERN_GLOBAL) || [];
  const candidates = [
    ...new Set(
      [direct, ...contentCodes]
        .filter(Boolean)
        .map(canonicalizeDepositCode),
    ),
  ];
  return {
    depositCode: candidates[0] || null,
    depositCodeAmbiguous: candidates.length > 1,
  };
};

const normalizeProviderTransactionId = (value) => {
  const id = boundedString(value, {
    maximum: 100,
    name: "id",
  });
  if (!/^[A-Z0-9-]+$/i.test(id)) malformed("id không hợp lệ");
  return id;
};

const canonicalTransaction = ({
  source,
  id,
  gateway,
  transactionDate,
  accountNumber,
  code,
  content,
  transferType,
  amount,
  referenceCode,
}) => {
  const normalizedContent = boundedString(content, {
    maximum: 1000,
    required: false,
    name: "content",
  });
  const depositCode = normalizeDepositCode(code, normalizedContent);
  return {
    provider: "sepay",
    source,
    providerTransactionId: normalizeProviderTransactionId(id),
    gateway: boundedString(gateway, { maximum: 80, name: "gateway" }),
    transactionAt: normalizeTransactionAt(transactionDate),
    accountNumber: normalizeAccountNumber(accountNumber),
    ...depositCode,
    content: normalizedContent,
    transferType: normalizeTransferType(transferType),
    amount: normalizeAmount(amount),
    referenceCode:
      boundedString(referenceCode, {
        maximum: 180,
        required: false,
        name: "referenceCode",
      }) || null,
  };
};

export const verifySePayWebhookSignature = ({
  rawBody,
  signatureHeader,
  timestampHeader,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}) => {
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    throw new SePayProviderError("RAW_BODY_REQUIRED", "Thiếu raw body", 400);
  }
  const normalizedSecret = String(secret || "");
  if (!normalizedSecret) {
    throw new SePayProviderError(
      "WEBHOOK_NOT_CONFIGURED",
      "SePay webhook chưa được cấu hình",
      503,
    );
  }
  const timestamp = Number(timestampHeader);
  if (
    !Number.isSafeInteger(timestamp) ||
    !Number.isSafeInteger(nowSeconds) ||
    Math.abs(nowSeconds - timestamp) > 300
  ) {
    throw new SePayProviderError(
      "REQUEST_EXPIRED",
      "Webhook timestamp không hợp lệ",
      401,
    );
  }

  const received = String(signatureHeader || "").trim();
  if (!/^sha256=[a-f0-9]{64}$/i.test(received)) {
    throw new SePayProviderError(
      "INVALID_SIGNATURE",
      "Webhook signature không hợp lệ",
      401,
    );
  }
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", normalizedSecret)
      .update(String(timestamp))
      .update(".")
      .update(rawBody)
      .digest("hex");
  const receivedBuffer = Buffer.from(received.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new SePayProviderError(
      "INVALID_SIGNATURE",
      "Webhook signature không hợp lệ",
      401,
    );
  }
};

export const normalizeSePayWebhook = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    malformed("Payload webhook không hợp lệ");
  }
  return canonicalTransaction({
    source: "webhook",
    id: payload.id,
    gateway: payload.gateway,
    transactionDate: payload.transactionDate,
    accountNumber: payload.accountNumber,
    code: payload.code,
    content: payload.content,
    transferType: payload.transferType,
    amount: payload.transferAmount,
    referenceCode: payload.referenceCode,
  });
};

export const normalizeSePayApiTransaction = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    malformed("Payload API không hợp lệ");
  }
  const transferType = normalizeTransferType(payload.transfer_type);
  return canonicalTransaction({
    source: "reconciliation",
    id: payload.id,
    gateway: payload.bank_brand_name,
    transactionDate: payload.transaction_date,
    accountNumber: payload.account_number,
    code: payload.code,
    content: payload.transaction_content,
    transferType,
    amount: transferType === "in" ? payload.amount_in : payload.amount_out,
    referenceCode: payload.reference_number,
  });
};
