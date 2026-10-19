import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Đọc danh sách endpoint từ mã nguồn (không khởi động server) và kiểm tra quy tắc đặt tên trong
// `.claude/rules/api-design.md`. Dùng cho cổng `apiNaming.contract.test.js`.
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const ROUTES_DIR = path.join(SERVER_ROOT, "src", "routes");
const SERVER_FILE = path.join(SERVER_ROOT, "server.js");

// Động từ không được xuất hiện làm đoạn đường dẫn: HTTP method đã mang hành động.
const VERBS = new Set([
  "get", "create", "add", "update", "delete", "remove", "fetch", "save", "set", "send", "book", "check",
  "record", "analyze", "purchase", "upload", "generate", "seed", "import", "find",
]);

// Hành động không thuộc CRUD được phép làm đoạn cuối sau `/:id` (POST, hoặc GET với download).
export const ALLOWED_ACTIONS = new Set([
  "approve", "reject", "reverse", "ignore", "cancel", "confirm", "submit", "archive", "restore", "duplicate",
  "send", "sign", "view", "fork", "merge", "publish", "revoke", "read", "read-all", "download", "client-download",
  "regenerate-embedding", "generate", "feedback", "status", "confirm-delivery", "corrections", "revisions", "export",
]);

// Tiền tố tài nguyên không đếm được hoặc là tên hệ thống; còn lại phải ở dạng số nhiều.
// Tên không đếm được hoặc chức năng duy nhất (singleton), không phải tập hợp bản ghi nên không cần số nhiều.
const UNCOUNTABLE_RESOURCES = new Set([
  "auth", "ops", "ai", "me", "progress", "coaching", "knowledge-base",
  "practice-center", "trainer-coordination", "skill-radar", "today-dashboard",
  "trainer-overview", "trainer-client-overview", "coaching-activity",
  // Ngoại lệ có chủ đích: script production (smoke test, watchdog) gọi /api/blog, đổi tên cần triển khai đồng bộ với các script đó.
  "blog",
]);

// Danh từ số nhiều có từ đầu trùng động từ nên không bị coi là động từ trong đường dẫn.
const PLURAL_NOUN_SEGMENTS = new Set(["check-ins"]);

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isParam = (segment) => segment.startsWith(":");

// Đọc server.js: bảng mount (tiền tố → file route), các lớp bảo vệ gắn theo tiền tố (limiter, cổng auth) và route khai báo thẳng bằng app.get/post.
export const scanServerEntry = () => {
  const serverSource = fs.readFileSync(SERVER_FILE, "utf8");
  const importedRoutes = new Map();
  for (const match of serverSource.matchAll(/^import\s+(\w+)\s+from\s+"\.\/src\/routes\/([^"]+)";?/gm)) {
    importedRoutes.set(match[1], match[2]);
  }

  const mounts = [];
  const guards = [];
  for (const match of serverSource.matchAll(/app\.use\(\s*"(\/api[^"]*)"\s*,([^;]*?)\)\s*;/g)) {
    const prefix = match[1].replace(/\/$/, "");
    const identifiers = [...match[2].matchAll(/\b(\w+)\b/g)].map((m) => m[1]);
    const routerName = [...identifiers].reverse().find((name) => importedRoutes.has(name));
    if (routerName) mounts.push({ prefix, file: importedRoutes.get(routerName) });
    else guards.push({ prefix, guard: identifiers[identifiers.length - 1] });
  }

  const inlineRoutes = [...serverSource.matchAll(/app\.(get|post|put|patch|delete)\(\s*"(\/api[^"]*)"/g)].map((m) => ({
    method: m[1].toUpperCase(),
    path: m[2],
  }));
  return { mounts, guards, inlineRoutes };
};

export const scanApiRoutes = () => {
  const { mounts } = scanServerEntry();

  const routes = [];
  for (const { prefix, file } of mounts) {
    const filePath = path.join(ROUTES_DIR, path.basename(file));
    if (!fs.existsSync(filePath)) continue;
    const source = fs.readFileSync(filePath, "utf8");
    for (const match of source.matchAll(/\brouter\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(["'`])([^"'`]*)\2/g)) {
      const routePath = match[3] === "/" ? "" : match[3];
      routes.push({ method: match[1].toUpperCase(), path: `${prefix}${routePath}`, file: path.basename(file) });
    }
  }
  return routes;
};

export const findNamingViolations = (routes) => {
  const violations = new Set();
  const add = (route, rule) => violations.add(`${route.method} ${route.path} [${rule}]`);

  for (const route of routes) {
    const segments = route.path.split("/").filter(Boolean).slice(1); // bỏ "api"
    const statics = segments.filter((segment) => !isParam(segment));
    const last = segments[segments.length - 1];
    const afterParam = segments.length >= 2 && isParam(segments[segments.length - 2]);
    const isAllowedAction =
      !isParam(last) && ALLOWED_ACTIONS.has(last) && (afterParam || ["export", "read-all", "generate"].includes(last));

    for (const segment of statics) {
      if (!KEBAB.test(segment.replace(/\.(?:pdf|csv|json)$/, ""))) add(route, "kebab-case");
    }
    const verbSegments = statics.filter((segment) => VERBS.has(segment.split("-")[0]) && !PLURAL_NOUN_SEGMENTS.has(segment));
    if (verbSegments.length > 0 && !(verbSegments.length === 1 && verbSegments[0] === last && isAllowedAction)) {
      add(route, "verb-in-path");
    }

    const resource = statics.find((segment) => segment !== "admin");
    if (resource && !resource.endsWith("s") && !UNCOUNTABLE_RESOURCES.has(resource)) add(route, "plural-resource");

    if (statics.filter((segment) => segment !== "admin").length > 3) add(route, "deep-nesting");
    if (route.method === "PUT" && isAllowedAction) add(route, "action-should-be-post");
  }
  return [...violations].sort();
};
