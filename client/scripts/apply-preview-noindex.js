// Chặn lập chỉ mục cho bản deploy không phải production (branch deploy như
// staging--*.netlify.app và deploy preview). Các bản này phục vụ nội dung giống
// hệt site chính; canonical đã trỏ về domain chính nhưng thêm X-Robots-Tag giúp
// Google loại hẳn chúng khỏi chỉ mục.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const NOINDEX_BLOCK = "/*\n  X-Robots-Tag: noindex, nofollow\n";

// Chỉ áp dụng trên Netlify và khi context khác production; build local không đổi.
export const shouldNoindex = (env = process.env) =>
  env.NETLIFY === "true" && Boolean(env.CONTEXT) && env.CONTEXT !== "production";

export const applyPreviewNoindex = ({
  distDir = path.resolve("dist"),
  env = process.env,
  logger = console,
} = {}) => {
  if (!shouldNoindex(env)) return { applied: false };

  const headersPath = path.join(distDir, "_headers");
  const existing = fs.existsSync(headersPath)
    ? fs.readFileSync(headersPath, "utf8")
    : "";
  if (existing.includes("X-Robots-Tag: noindex, nofollow")) {
    return { applied: false, reason: "already-present" };
  }

  const separator = existing && !existing.endsWith("\n") ? "\n\n" : "\n";
  fs.writeFileSync(headersPath, `${existing}${existing ? separator : ""}${NOINDEX_BLOCK}`);
  logger.log(`Added X-Robots-Tag noindex for ${env.CONTEXT} deploy`);
  return { applied: true };
};

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) applyPreviewNoindex();
