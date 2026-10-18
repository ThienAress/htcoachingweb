import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import debt from "./errorMessageDebt.json";

// Cổng "chỉ giảm, không tăng" cho thông báo lỗi gửi ra ngoài: không trả `error.message` thô và không dùng
// câu "Lỗi server"/"Lỗi hệ thống". Dùng `sendApiError` (utils/sendApiError.js) hoặc câu cụ thể bằng tiếng Việt.
// Chuyển xong một file thì xóa nó khỏi errorMessageDebt.json.
// Nợ còn lại (19 chỗ): lỗi nghiệp vụ có kiểu và `code` riêng mà message do service tự viết (contract, import, trainerTransfer,
// workoutPlan, food, practiceCenter), và các endpoint dành cho máy (ops, webhook SePay) không hiển thị cho người dùng.
const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIPPED_DIRS = new Set(["__tests__", "scripts", "migrations", "node_modules", "seeds"]);

const sourceFiles = (dir, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) sourceFiles(full, found);
    } else if (/\.(jsx?|mjs|cjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
};

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

export const countLeaks = (source) => {
  const code = stripComments(source);
  let total = 0;
  total += (code.match(/message:\s*(?:error|err|e)\??\.message\b/g) || []).length;
  total += (code.match(/["'`]Lỗi (?:server|hệ thống)/g) || []).length;
  return total;
};

describe("error messages sent to clients", () => {
  const usage = {};
  for (const file of sourceFiles(SRC_ROOT)) {
    const relative = path.relative(SRC_ROOT, file).split(path.sep).join("/");
    const count = countLeaks(fs.readFileSync(file, "utf8"));
    if (count > 0) usage[relative] = count;
  }

  it("is not added to any file outside the debt list", () => {
    expect(Object.keys(usage).filter((file) => !(file in debt))).toEqual([]);
  });

  it("does not grow in files that still have it", () => {
    expect(
      Object.entries(usage).filter(([file, count]) => file in debt && count > debt[file]).map(([file]) => file),
    ).toEqual([]);
  });

  it("keeps the debt list honest: a cleaned file must be removed from it", () => {
    expect(Object.keys(debt).filter((file) => !(file in usage))).toEqual([]);
  });

  it("recognises the leaking patterns and ignores safe ones", () => {
    expect(countLeaks("res.status(500).json({ success: false, message: error.message });")).toBe(1);
    expect(countLeaks("res.json({ message: err?.message })")).toBe(1);
    expect(countLeaks('res.status(500).json({ message: "Lỗi server" })')).toBe(1);
    expect(countLeaks('res.status(500).json({ message: "Lỗi hệ thống khi nạp tiền" })')).toBe(1);
    expect(countLeaks("sendApiError(res, error, 'deposit.failed')")).toBe(0);
    expect(countLeaks("// message: error.message")).toBe(0);
    expect(countLeaks("safeLog.error('x', error); const detail = error.message;")).toBe(0);
  });
});
