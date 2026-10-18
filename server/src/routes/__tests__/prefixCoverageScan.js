import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Công cụ cho cổng kiểm chéo tiền tố (prefixCoverage.contract.test.js): tìm mọi chỗ trong mã nguồn bám vào một đường dẫn /api
// để đổi tên tiền tố không thể âm thầm làm mất rate limiter, cổng tính năng, URL tự dựng hoặc đường dẫn trong client.
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const REPO_ROOT = path.resolve(SERVER_ROOT, "..");

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

export const sourceFiles = (dir, { skipDirs, extensions }, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) sourceFiles(full, { skipDirs, extensions }, found);
    } else if (extensions.test(entry.name) && !/\.test\./.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
};

const trimStatic = (value) => value.replace(/\/+$/, "");

// Đường dẫn /api tĩnh trong chuỗi ký tự của mã server (dừng ở `${`, `?`, tham số `:id`).
export const serverApiPaths = (source) => {
  const found = [];
  for (const match of stripComments(source).matchAll(/["'`](\/api\/[A-Za-z0-9\-_/.]*)/g)) {
    found.push(trimStatic(match[1]));
  }
  return found;
};

// Đường dẫn gọi API của client (không gồm tiền tố /api, vì axios đã gắn sẵn): lời gọi api.<method>("/..."), và hằng số cơ sở của service.
export const clientApiPaths = (source) => {
  const code = stripComments(source);
  const found = [];
  for (const match of code.matchAll(/\bapi\s*\.\s*(?:get|post|put|patch|delete)\(\s*["'`](\/[A-Za-z0-9\-_/.]*)/g)) {
    found.push(`/api${trimStatic(match[1])}`);
  }
  for (const match of code.matchAll(/\bconst\s+(?:API_URL|BASE_URL|API_BASE|BASE)\s*=\s*["'`](\/[A-Za-z0-9\-_/.]*)/g)) {
    found.push(`/api${trimStatic(match[1])}`);
  }
  return found;
};

export const isMountedPath = (apiPath, mountPrefixes) =>
  mountPrefixes.some((prefix) => apiPath === prefix || apiPath.startsWith(`${prefix}/`) || prefix.startsWith(`${apiPath}/`));

export const unmountedPaths = (apiPaths, mountPrefixes) =>
  [...new Set(apiPaths.filter((apiPath) => apiPath !== "/api" && !isMountedPath(apiPath, mountPrefixes)))].sort();

export const collectServerApiPaths = () => {
  const files = [
    path.join(SERVER_ROOT, "server.js"),
    ...sourceFiles(path.join(SERVER_ROOT, "src"), {
      skipDirs: new Set(["__tests__", "scripts", "migrations", "node_modules", "seeds"]),
      extensions: /\.(js|mjs)$/,
    }),
  ];
  return files.flatMap((file) =>
    serverApiPaths(fs.readFileSync(file, "utf8")).map((apiPath) => ({ apiPath, file: path.relative(REPO_ROOT, file).split(path.sep).join("/") })),
  );
};

export const collectClientApiPaths = () => {
  const root = path.join(REPO_ROOT, "client", "src");
  return sourceFiles(root, { skipDirs: new Set(["__tests__", "node_modules"]), extensions: /\.(js|jsx)$/ }).flatMap((file) =>
    clientApiPaths(fs.readFileSync(file, "utf8")).map((apiPath) => ({ apiPath, file: path.relative(REPO_ROOT, file).split(path.sep).join("/") })),
  );
};
