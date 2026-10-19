import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Cổng "chỉ giảm, không tăng": giao diện không dùng <select>, window.confirm, alert gốc của trình duyệt
// (danh sách thả xuống không bo góc, hộp thoại không theo giao diện). Dùng SelectField / RoundedSelect
// và useConfirmDialog. Các file dưới đây là nợ cũ; chuyển xong một file thì xóa nó khỏi danh sách.
const LEGACY_NATIVE_USAGE = {
  "components/body-assessment/TrainerBodyAssessment.jsx": 2,
  "hooks/useExercisesLogic.js": 1,
  "hooks/usePrompt.js": 1,
  "pages/admin/BlogManagement.jsx": 1,
  "pages/admin/BookingManagement.jsx": 2,
  "pages/admin/CheckinHistory.jsx": 1,
  "pages/admin/ContactMessages.jsx": 2,
  "pages/admin/ContractManagement.jsx": 2,
  "pages/admin/CustomerStoryManagement.jsx": 1,
  "pages/admin/ExerciseManagement.jsx": 2,
  "pages/admin/ExerciseSuggestionsManagement.jsx": 2,
  "pages/admin/F1AiRuleManagement.jsx": 1,
  "pages/admin/FoodManagement.jsx": 1,
  "pages/admin/GymManagement.jsx": 2,
  "pages/admin/KnowledgeBase.jsx": 2,
  "pages/admin/Orders.jsx": 1,
  "pages/admin/RecipeManagement.jsx": 2,
  "pages/admin/UserManagement.jsx": 1,
};

// Chính các thành phần ô chọn dùng <select> gốc bên trong.
const EXEMPT_FILES = new Set([
  "components/F1/assessment/RoundedSelect.jsx",
  "components/SelectField.jsx",
  "components/F1/intake/RegisteredSelect.jsx",
]);

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const sourceFiles = (dir, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "node_modules") sourceFiles(full, found);
    } else if (/\.(jsx?|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
};

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const countNativeUsage = (source) => {
  const code = stripComments(source);
  let total = 0;
  total += (code.match(/\bwindow\.(?:alert|confirm)\s*\(/g) || []).length;
  total += (code.match(/(?<![.\w])alert\s*\(/g) || []).length;
  // confirm("...") với chuỗi là hộp thoại gốc; confirm({ ... }) là useConfirmDialog.
  total += (code.match(/(?<![.\w])confirm\s*\(\s*["'`]/g) || []).length;
  for (const match of code.matchAll(/<select\b/g)) {
    // Ô chọn nhiều giá trị chưa có bản bo góc nên được phép.
    if (!/\bmultiple\b/.test(code.slice(match.index, match.index + 300))) total += 1;
  }
  return total;
};

describe("native browser dialogs and selects", () => {
  const usage = {};
  for (const file of sourceFiles(SRC_ROOT)) {
    const relative = path.relative(SRC_ROOT, file).split(path.sep).join("/");
    if (EXEMPT_FILES.has(relative)) continue;
    const count = countNativeUsage(fs.readFileSync(file, "utf8"));
    if (count > 0) usage[relative] = count;
  }

  it("is not used in any file outside the legacy list", () => {
    const unexpected = Object.keys(usage).filter((file) => !(file in LEGACY_NATIVE_USAGE));
    expect(unexpected).toEqual([]);
  });

  it("does not grow in files that still use it", () => {
    const grown = Object.entries(usage)
      .filter(([file, count]) => file in LEGACY_NATIVE_USAGE && count > LEGACY_NATIVE_USAGE[file])
      .map(([file]) => file);
    expect(grown).toEqual([]);
  });

  it("keeps the legacy list honest: a file that no longer uses it must be removed", () => {
    const stale = Object.keys(LEGACY_NATIVE_USAGE).filter((file) => !(file in usage));
    expect(stale).toEqual([]);
  });

  it("recognises each native pattern and ignores the shared dialog hook", () => {
    expect(countNativeUsage("if (window.confirm('x')) go();")).toBe(1);
    expect(countNativeUsage("alert('x')")).toBe(1);
    expect(countNativeUsage("if (!confirm(`Xóa?`)) return;")).toBe(1);
    expect(countNativeUsage("<select value={a} onChange={b}></select>")).toBe(1);
    expect(countNativeUsage("<select multiple value={a}></select>")).toBe(0);
    expect(countNativeUsage("const ok = await confirm({ title: 'x' });")).toBe(0);
    expect(countNativeUsage("// window.confirm('x') and <select>")).toBe(0);
  });
});
