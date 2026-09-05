#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_PATCH_BYTES = 512 * 1024;
const OUTCOMES = new Set(["draft_patch", "no_safe_patch", "no_reproduction"]);
const CONFIDENCE = new Set(["Cao", "Trung bình", "Thấp"]);
const BUILD_STATES = new Set(["PASS", "FAIL", "SKIP"]);
const INCIDENT_REASONS = new Set([
  "unexpected_status",
  "invalid_json",
  "readiness_contract_failed",
  "timeout",
  "network_error",
]);
const INCIDENT_ROUTES = new Map([
  ["client-document", "GET /"],
  ["api-readiness", "GET /api/ops/health/ready"],
]);
const REPORT_FIELDS = new Set([
  "incidentId",
  "outcome",
  "title",
  "conclusion",
  "confidence",
  "confidenceReason",
  "rootCause",
  "impact",
  "fix",
  "focusedTests",
  "relatedTests",
  "build",
  "durationSeconds",
]);
const ALLOWED_EXACT_PATHS = new Set([
  "client/src/components/SEO.jsx",
  "client/src/pages/Blog.jsx",
  "client/src/pages/BlogDetail.jsx",
  "client/src/pages/Club.jsx",
  "client/src/pages/CustomerStories.jsx",
  "client/src/pages/CustomerStoryDetail.jsx",
  "client/src/pages/Home.jsx",
  "client/src/pages/NotFound.jsx",
  "server/src/observability/__tests__/metrics.test.js",
  "server/src/observability/metrics.js",
  "server/src/observability/queryTelemetry.js",
  "server/src/observability/rumBaseline.js",
  "server/src/utils/__tests__/safeLogger.test.js",
  "server/src/utils/escapeRegex.js",
  "server/src/utils/safeLogger.js",
]);
const ALLOWED_PATH_PREFIXES = [
  "client/src/pages/ExercisesPage/",
  "client/src/pages/RecipeExplorer/",
  "client/src/seo/",
];
const SENSITIVE_PATH = /(auth|csrf|token|secret|security|payment|wallet|deposit|billing|contract|subscription|entitlement|migration|schema|moderation|prompt|access|permission|ownership|role|admin|user|account|session|oauth|passport|login|signup|register)/i;
const SENSITIVE_TEXT = /Bearer\s+\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(token|cookie|authorization|password|secret)\s*[=:]\s*\S+/i;
const EXTERNAL_REFERENCE = /(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b(?:\/[^\s]*)?|\b(?:\d{1,3}\.){3}\d{1,3}\b(?:\/[^\s]*)?|\[[^\]]+\]\([^)]*\)|@[A-Za-z0-9_]{5,})/i;
const UNICODE_DOMAIN_REFERENCE = /(?:^|[\s(/])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}]{2,63}(?=$|[/:?#\s)])/iu;
const IPV6_REFERENCE = /(?:^|[\s([])(?:\[[0-9A-Fa-f:]+\]|(?=[0-9A-Fa-f:]*:[0-9A-Fa-f:]*:)[0-9A-Fa-f:]{3,})(?:\/[^\s]*)?(?=$|[\s)\],.;])/;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const containsExternalReference = (value) => {
  const normalized = String(value)
    .normalize("NFKC")
    .replace(/[\u3002\uFF0E\uFF61]/g, ".");
  return EXTERNAL_REFERENCE.test(normalized) ||
    UNICODE_DOMAIN_REFERENCE.test(normalized) ||
    IPV6_REFERENCE.test(normalized);
};

const safeText = (value, label, maxLength) => {
  assert(typeof value === "string", `${label} must be a string`);
  assert(!SENSITIVE_TEXT.test(value), `${label} contains sensitive data`);
  assert(!containsExternalReference(value), `${label} contains an external reference`);
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  assert(normalized.length >= 1 && normalized.length <= maxLength, `${label} is invalid`);
  return normalized;
};

const safeList = (value, label) => {
  assert(Array.isArray(value) && value.length >= 1 && value.length <= 20, `${label} is invalid`);
  return value.map((item, index) => {
    const safe = safeText(item, `${label}[${index}]`, 240);
    assert(/^(?:PASS|FAIL|SKIP)\b/.test(safe), `${label}[${index}] must start with PASS, FAIL or SKIP`);
    return safe;
  });
};

export const validateIncidentId = (value) => {
  const incidentId = String(value || "").trim();
  assert(/^INC-\d{8}-\d{4}$/.test(incidentId), "incident id is invalid");
  return incidentId;
};

export const validateIncidentContext = (input) => {
  assert(input && typeof input === "object" && !Array.isArray(input), "incident context must be an object");
  const fields = Object.keys(input);
  assert(
    fields.length === 5 && fields.every((field) => [
      "check",
      "route",
      "statusCode",
      "reason",
      "consecutiveFailures",
    ].includes(field)),
    "incident context fields are invalid",
  );
  assert(INCIDENT_ROUTES.has(input.check), "incident check is invalid");
  assert(input.route === INCIDENT_ROUTES.get(input.check), "incident route is invalid");
  assert(
    input.statusCode === null ||
      (Number.isInteger(input.statusCode) && input.statusCode >= 100 && input.statusCode <= 599),
    "incident status code is invalid",
  );
  assert(INCIDENT_REASONS.has(input.reason), "incident reason is invalid");
  assert(
    Number.isInteger(input.consecutiveFailures) &&
      input.consecutiveFailures >= 1 && input.consecutiveFailures <= 999,
    "incident failure count is invalid",
  );
  return {
    check: input.check,
    route: input.route,
    statusCode: input.statusCode,
    reason: input.reason,
    consecutiveFailures: input.consecutiveFailures,
  };
};

export const validateRemediationReport = (input, { incidentId } = {}) => {
  assert(input && typeof input === "object" && !Array.isArray(input), "report must be an object");
  const extraFields = Object.keys(input).filter((field) => !REPORT_FIELDS.has(field));
  assert(extraFields.length === 0, `report contains unsupported fields: ${extraFields.join(", ")}`);
  const normalizedIncidentId = validateIncidentId(input.incidentId);
  if (incidentId) {
    assert(normalizedIncidentId === validateIncidentId(incidentId), "report incident id does not match dispatch");
  }
  assert(OUTCOMES.has(input.outcome), "report outcome is invalid");
  assert(CONFIDENCE.has(input.confidence), "report confidence is invalid");
  assert(BUILD_STATES.has(input.build), "report build state is invalid");
  assert(
    Number.isInteger(input.durationSeconds) && input.durationSeconds >= 0 && input.durationSeconds <= 7200,
    "report durationSeconds is invalid",
  );
  const report = {
    incidentId: normalizedIncidentId,
    outcome: input.outcome,
    title: safeText(input.title, "title", 72),
    conclusion: safeText(input.conclusion, "conclusion", 300),
    confidence: input.confidence,
    confidenceReason: safeText(input.confidenceReason, "confidenceReason", 300),
    rootCause: safeText(input.rootCause, "rootCause", 600),
    impact: safeText(input.impact, "impact", 500),
    fix: safeText(input.fix, "fix", 600),
    focusedTests: safeList(input.focusedTests, "focusedTests"),
    relatedTests: safeList(input.relatedTests, "relatedTests"),
    build: input.build,
    durationSeconds: input.durationSeconds,
  };
  if (report.confidence === "Cao") {
    assert(
      report.focusedTests.some((item) => /^PASS\b/i.test(item)),
      "high confidence requires a passing focused test",
    );
  }
  if (report.outcome === "draft_patch") {
    assert(report.build === "PASS", "draft patch requires a passing agent build");
    assert(
      ![...report.focusedTests, ...report.relatedTests].some((item) => /^FAIL\b/.test(item)),
      "draft patch cannot contain a failed test",
    );
  }
  return report;
};

export const attestValidatedReport = (input) => {
  const report = validateRemediationReport(input);
  if (report.outcome !== "draft_patch") {
    return validateRemediationReport({
      ...report,
      conclusion: report.outcome === "no_reproduction"
        ? "Source và test local chưa reproduce được incident; không tạo Draft PR."
        : "Root cause cần vùng nhạy cảm hoặc chưa có patch an toàn; không tạo Draft PR.",
      confidence: "Thấp",
      confidenceReason: "Fresh job chỉ xác minh report và empty-patch contract; application tests không chạy cho kết quả no-patch.",
      rootCause: report.outcome === "no_reproduction"
        ? "Chưa xác định — source và test local không cung cấp reproduction đủ mạnh."
        : `Giả thuyết cần human review: ${report.rootCause}`,
      impact: "Health probe đã thất bại; phạm vi người dùng cần maintainer xác minh từ observability có quyền truy cập.",
      fix: "Không tự động sửa. Maintainer tiếp tục điều tra bằng log và release evidence theo incident runbook.",
      focusedTests: ["SKIP — không có patch để fresh job kiểm chứng"],
      relatedTests: ["SKIP — application tests không chạy cho no-patch outcome"],
      build: "SKIP",
    });
  }
  return validateRemediationReport({
    ...report,
    conclusion: "Patch đã pass fresh validation và sẵn sàng thành Draft PR để maintainer review.",
    confidence: "Trung bình",
    confidenceReason: "Fresh checkout đã pass full unit tests, client build và secret scan; RED observation của agent vẫn cần human review.",
    focusedTests: [
      "SKIP — RED→GREEN evidence nằm trong agent run và chưa được fresh job chứng thực độc lập",
    ],
    relatedTests: [
      "PASS — fresh npm run test:unit",
      "PASS — fresh npm run build --prefix client",
      "PASS — fresh npm run security:secrets",
    ],
    build: "PASS",
  });
};

const validatePatchPath = (value) => {
  const filePath = String(value || "");
  assert(filePath && !filePath.includes("\\") && !filePath.includes(".."), "patch path is invalid");
  assert(!path.posix.isAbsolute(filePath) && !/\s/.test(filePath), "patch path is invalid");
  assert(
    ALLOWED_EXACT_PATHS.has(filePath) ||
      ALLOWED_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix)),
    "patch path is not allowed",
  );
  assert(!SENSITIVE_PATH.test(filePath), "patch path is sensitive");
  assert(filePath !== "client/src/utils/api.js", "patch path is sensitive");
  return filePath;
};

export const validatePatchText = (patchText, reportInput) => {
  const report = validateRemediationReport(reportInput);
  const patch = String(patchText || "");
  const bytes = Buffer.byteLength(patch, "utf8");
  assert(bytes <= MAX_PATCH_BYTES, "patch exceeds size limit");
  if (report.outcome !== "draft_patch") {
    assert(patch.trim() === "", "patch must be empty when no Draft PR is proposed");
    return { paths: [], bytes };
  }
  assert(patch.trim().length > 0, "draft_patch requires a patch");
  const paths = [];
  let block = null;
  const finishBlock = () => {
    if (!block) return;
    assert(block.oldHeader && block.newHeader, "patch file headers are incomplete");
  };
  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      finishBlock();
      const match = /^diff --git a\/([^\s]+) b\/([^\s]+)$/.exec(line);
      assert(match, "patch diff header is invalid");
      assert(match[1] === match[2], "renamed patch paths are not allowed");
      const filePath = validatePatchPath(match[1]);
      paths.push(filePath);
      block = { filePath, oldHeader: false, newHeader: false, inHunk: false };
      continue;
    }
    if (!block) {
      assert(!line.trim(), "patch contains data before its first diff header");
      continue;
    }
    if (line.startsWith("@@")) {
      assert(block.oldHeader && block.newHeader, "patch file headers are incomplete");
      block.inHunk = true;
      continue;
    }
    if (block.inHunk) continue;
    assert(
      !/^(?:rename|copy) (?:from|to) |^(?:similarity|dissimilarity) index /.test(line),
      "renamed or copied patch paths are not allowed",
    );
    assert(!/^GIT binary patch$|^Binary files /.test(line), "binary patches are not allowed");
    const mode = /^(?:old mode|new mode|new file mode|deleted file mode) (\d+)$/.exec(line);
    if (mode) {
      assert(["100644", "100755"].includes(mode[1]), "symlink or submodule mode is not allowed");
      continue;
    }
    if (line.startsWith("--- ")) {
      assert(!block.oldHeader, "patch contains duplicate old file headers");
      assert(
        line === `--- a/${block.filePath}` || line === "--- /dev/null",
        "patch old file header does not match its diff path",
      );
      block.oldHeader = true;
      continue;
    }
    if (line.startsWith("+++ ")) {
      assert(!block.newHeader, "patch contains duplicate new file headers");
      assert(
        line === `+++ b/${block.filePath}` || line === "+++ /dev/null",
        "patch new file header does not match its diff path",
      );
      block.newHeader = true;
    }
  }
  finishBlock();
  assert(paths.length >= 1 && paths.length <= 40, "patch does not contain an allowed path set");
  assert(new Set(paths).size === paths.length, "patch contains duplicate file headers");
  return { paths, bytes };
};

const bulletList = (items) => items.map((item) => `- ${item}`).join("\n");
const escapeMarkdown = (value) => value.replace(/([\\`*_[\]()#+.!|>~-])/g, "\\$1");

export const formatPullRequestBody = (reportInput) => {
  const report = validateRemediationReport(reportInput);
  return [
    `## Incident ${report.incidentId}`,
    "",
    "> Draft remediation generated under a bounded agent workflow. Human review required; this PR does not merge or deploy itself.",
    "",
    "## Kết luận",
    escapeMarkdown(report.conclusion),
    "",
    `**Tin cậy:** ${report.confidence} — ${escapeMarkdown(report.confidenceReason)}`,
    "",
    "## Root cause",
    escapeMarkdown(report.rootCause),
    "",
    "## Ảnh hưởng",
    escapeMarkdown(report.impact),
    "",
    "## Cách sửa",
    escapeMarkdown(report.fix),
    "",
    "## Kiểm chứng",
    "### Focused tests",
    bulletList(report.focusedTests.map(escapeMarkdown)),
    "",
    "### Related tests",
    bulletList(report.relatedTests.map(escapeMarkdown)),
    "",
    `**Build:** ${report.build}`,
    "",
    "## Safety gates",
    "- [ ] Maintainer reviewed root cause and patch scope",
    "- [ ] Required CI checks passed",
    "- [ ] Rollout/deploy approved separately",
  ].join("\n");
};

const formatDuration = (durationSeconds) => {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return minutes ? `${minutes} phút ${seconds} giây` : `${seconds} giây`;
};

const telegramList = (items) => items.map((item) => `• ${item}`).join("\n");

export const formatTelegramRemediation = (
  reportInput,
  { prUrl = "", runnerMinutes = null } = {},
) => {
  const report = validateRemediationReport(reportInput);
  const safePrUrl = prUrl
    ? new URL(prUrl)
    : null;
  if (safePrUrl) {
    assert(
      safePrUrl.origin === "https://github.com" &&
      /^\/ThienAress\/htcoachingweb\/pull\/\d+$/.test(safePrUrl.pathname),
      "PR URL is invalid",
    );
  }
  const conclusion = report.outcome === "draft_patch"
    ? "Draft PR đã mở"
    : report.outcome === "no_reproduction"
      ? "Chưa reproduce được; không tạo PR"
      : "Không có patch an toàn; không tạo PR";
  const runner = Number.isFinite(Number(runnerMinutes))
    ? `~${Math.max(0, Math.round(Number(runnerMinutes)))} phút`
    : "xem GitHub Actions";
  const compact = {
    confidenceReason: report.confidenceReason.slice(0, 220),
    rootCause: report.rootCause.slice(0, 400),
    impact: report.impact.slice(0, 300),
    fix: report.fix.slice(0, 400),
    focusedTests: report.focusedTests.slice(0, 3).map((item) => item.slice(0, 140)),
    relatedTests: report.relatedTests.slice(0, 3).map((item) => item.slice(0, 140)),
  };
  const message = [
    `🛠 [${report.incidentId}] ${report.title}`,
    "👥 Phạm vi người dùng theo incident gốc · production",
    `📌 ${report.incidentId} · supervised remediation`,
    "",
    `Kết luận: ${conclusion}`,
    `Tin cậy: ${report.confidence} — ${compact.confidenceReason}`,
    "",
    "Root cause:",
    compact.rootCause,
    "",
    "Ảnh hưởng:",
    compact.impact,
    "",
    "Cách sửa:",
    compact.fix,
    "",
    "Kiểm chứng:",
    telegramList(compact.focusedTests),
    telegramList(compact.relatedTests),
    `• Build: ${report.build}`,
    "",
    `PR: ${safePrUrl ? safePrUrl.href : "Không tạo"}`,
    `⏱ Agent: ${formatDuration(report.durationSeconds)}`,
    `💰 AI: xem OpenAI usage · Runner: ${runner}`,
  ].join("\n");
  assert(message.length <= 4096, "Telegram remediation message is too long");
  return message;
};

const parseArgs = (values) => {
  const [command, ...rest] = values;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    assert(flag?.startsWith("--") && rest[index + 1] !== undefined, "invalid CLI arguments");
    options[flag.slice(2)] = rest[index + 1];
  }
  return { command, options };
};

const writeGithubOutput = (values) => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const content = Object.entries(values)
    .map(([key, value]) => `${key}=${String(value).replace(/[\r\n]+/g, " ")}`)
    .join("\n");
  fs.appendFileSync(outputPath, `${content}\n`, "utf8");
};

const runValidate = (options) => {
  const report = validateRemediationReport(
    JSON.parse(fs.readFileSync(options.report, "utf8")),
    { incidentId: options.incident },
  );
  const patch = fs.readFileSync(options.patch, "utf8");
  const patchSummary = validatePatchText(patch, report);
  const outputDirectory = path.resolve(options.output);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(outputDirectory, "pull-request-body.md"),
    `${formatPullRequestBody(report)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(outputDirectory, "changed-paths.txt"),
    patchSummary.paths.length ? `${patchSummary.paths.join("\n")}\n` : "",
    "utf8",
  );
  writeGithubOutput({ outcome: report.outcome, title: report.title });
  process.stdout.write(`Validated ${report.outcome} for ${report.incidentId}\n`);
};

const runValidateContext = (options) => {
  const context = validateIncidentContext(JSON.parse(options.context));
  const outputPath = path.resolve(options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(context, null, 2)}\n`, "utf8");
  process.stdout.write("Validated bounded incident context\n");
};

const runAttest = (options) => {
  const report = attestValidatedReport(
    JSON.parse(fs.readFileSync(options.report, "utf8")),
  );
  const outputDirectory = path.resolve(options.output);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(outputDirectory, "pull-request-body.md"),
    `${formatPullRequestBody(report)}\n`,
    "utf8",
  );
  process.stdout.write(`Attached fresh validation evidence for ${report.incidentId}\n`);
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const sendTelegramUpdate = async (
  { token, chatId, text, messageId = null, prUrl = "", incidentId },
  { fetchImpl = fetch, waitImpl = wait } = {},
) => {
  const method = messageId ? "editMessageText" : "sendMessage";
  const keyboard = [
    ...(prUrl ? [[{ text: "🔗 Xem Draft PR", url: prUrl }]] : []),
    [{ text: "❌ Đóng", callback_data: `ack:${incidentId}` }],
  ];
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: keyboard },
    ...(messageId ? { message_id: messageId } : {}),
  };
  let lastStatus = "network";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (response.ok) return;
      lastStatus = `HTTP ${response.status}`;
      const responseText = String(await response.text()).slice(0, 512);
      if (
        method === "editMessageText" &&
        response.status === 400 &&
        /message is not modified/i.test(responseText)
      ) {
        return;
      }
    } catch {
      lastStatus = "network/timeout";
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < 2) await waitImpl(250 * (attempt + 1));
  }
  throw new Error(`Telegram notification failed after 3 attempts (${lastStatus})`);
};

const runNotify = async (options) => {
  const report = validateRemediationReport(
    JSON.parse(fs.readFileSync(options.report, "utf8")),
    { incidentId: options.incident },
  );
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "");
  const chatId = String(process.env.TELEGRAM_CHAT_ID || "");
  assert(token && chatId, "Telegram notification is not configured");
  const rawMessageId = String(options["message-id"] || "");
  assert(!rawMessageId || /^[1-9]\d*$/.test(rawMessageId), "Telegram message id is invalid");
  const messageId = rawMessageId ? Number(rawMessageId) : null;
  assert(messageId === null || Number.isSafeInteger(messageId), "Telegram message id is invalid");
  const text = formatTelegramRemediation(report, {
    prUrl: options["pr-url"] || "",
    runnerMinutes: options["runner-minutes"] || null,
  });
  await sendTelegramUpdate({
    token,
    chatId,
    text,
    messageId,
    prUrl: options["pr-url"] || "",
    incidentId: report.incidentId,
  });
  process.stdout.write(`Telegram remediation update sent for ${report.incidentId}\n`);
};

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { command, options } = parseArgs(process.argv.slice(2));
  try {
    if (command === "validate") runValidate(options);
    else if (command === "validate-context") runValidateContext(options);
    else if (command === "attest") runAttest(options);
    else if (command === "notify") await runNotify(options);
    else throw new Error("unknown command");
  } catch (error) {
    process.stderr.write(`${String(error?.message || error).slice(0, 240)}\n`);
    process.exitCode = 1;
  }
}
