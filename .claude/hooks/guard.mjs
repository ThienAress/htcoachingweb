#!/usr/bin/env node
// PreToolUse guard: chặn đọc/in secret, hỏi lại trước git ghi và script ghi dữ liệu thật.

import path from "node:path";
import { fileURLToPath } from "node:url";

const SECRET_PATH =
  /(?:^|[\s'"=/\\(])(?:\.env(?:\.[\w.-]+)?|\.env-backup|\.private)(?=$|[\s'"/\\;|&)<>])/i;
const SAFE_ENV_EXAMPLE = /\.env(?:\.[\w-]+)*\.example$/i;
const ENV_DUMP =
  /(?:^|[;&|(]\s*)(?:printenv\b|env\s*(?:$|[|;&>])|set\s*(?:$|[|;&>])|(?:get-childitem|gci|dir|ls)\s+env:)/im;
const GIT_WRITE =
  /(?:^|[;&|(]\s*|\s)git\s+(?:-C\s+\S+\s+)?(commit|push|pull|merge|rebase|reset|checkout|switch|restore|clean|cherry-pick|revert|tag|branch\s+-[dD]|stash\s+(?:drop|clear|pop))\b/i;
const DATA_WRITE =
  /(?:--apply\b|--target[= ]production\b|NODE_ENV=production\b|npm(?:\.cmd)?\s+run\s+(?:migrate|seed|cleanup|sync|apply|rollback|recover|import|acceptance|smoke:production|monitor:production)[:\w-]*)/i;

const secretTokens = (text) => {
  const hits = [];
  const pattern = new RegExp(SECRET_PATH.source, "gi");
  for (const match of text.matchAll(pattern)) {
    const start = match.index + match[0].search(/\.(?:env|private)/i);
    const rest = text.slice(start).match(/^[^\s'";|&)<>]+/);
    const token = rest ? rest[0] : match[0].trim();
    if (!SAFE_ENV_EXAMPLE.test(token)) hits.push(token);
  }
  return hits;
};

const isSecretPath = (filePath) => {
  if (!filePath) return false;
  const base = path.basename(String(filePath));
  const normalized = String(filePath).replaceAll("\\", "/");
  if (/(^|\/)\.env-backup(\/|$)|(^|\/)\.private(\/|$)/i.test(normalized)) return true;
  return /^\.env(\..+)?$/i.test(base) && !SAFE_ENV_EXAMPLE.test(base);
};

export function evaluate(toolName, toolInput = {}) {
  if (["Read", "Edit", "Write", "NotebookEdit"].includes(toolName)) {
    if (isSecretPath(toolInput.file_path || toolInput.notebook_path)) {
      return { decision: "deny", reason: "File chứa secret (.env/.env-backup/.private) bị chặn. Dùng file *.example để xem cấu trúc." };
    }
    return null;
  }
  if (toolName === "Grep" || toolName === "Glob") {
    if (isSecretPath(toolInput.path) || /\.env(?![\w.-]*example)|\.private|\.env-backup/i.test(toolInput.glob || "")) {
      return { decision: "deny", reason: "Tìm kiếm trong file secret bị chặn." };
    }
    return null;
  }
  if (toolName === "Bash" || toolName === "PowerShell") {
    const command = String(toolInput.command || "");
    if (secretTokens(command).length > 0 || ENV_DUMP.test(command)) {
      return { decision: "deny", reason: "Lệnh có thể đọc/in secret (.env, .private, biến môi trường) bị chặn." };
    }
    const git = command.match(GIT_WRITE);
    if (git) return { decision: "ask", reason: `Lệnh git ghi (${git[1]}) cần user xác nhận theo CLAUDE.md.` };
    if (DATA_WRITE.test(command)) {
      return { decision: "ask", reason: "Lệnh có thể ghi dữ liệu thật (migrate/seed/sync/--apply/production) cần user xác nhận target." };
    }
  }
  return null;
}

const readStdin = async () => {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse((await readStdin()) || "{}");
    const result = evaluate(input.tool_name, input.tool_input);
    if (result) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: result.decision,
          permissionDecisionReason: result.reason,
        },
      }));
    }
  } catch {
    // Input lỗi thì không chặn; permission thông thường vẫn áp dụng.
  }
}
