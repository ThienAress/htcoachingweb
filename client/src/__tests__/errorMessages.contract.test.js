import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import debt from "./errorMessageDebt.json";

// Cổng "chỉ giảm, không tăng": giao diện không đưa thẳng `error.message` (có thể là "Network Error",
// "Request failed with status code 500") hay câu "Lỗi server" cho khách hàng/HLV. Dùng `getUserErrorMessage`
// (utils/errorMessages.js). Chuyển xong một file thì xóa nó khỏi errorMessageDebt.json.
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

export const countLeaks = (source) => {
  const code = stripComments(source);
  let total = 0;
  for (const match of code.matchAll(/toast\.error\(/g)) {
    const argument = code.slice(match.index, match.index + 260).split(");")[0];
    if (/\.message\b/.test(argument) && !/getUserErrorMessage/.test(argument)) total += 1;
  }
  total += (code.match(/\{\s*(?:error|err)\??\.message\s*\}/g) || []).length;
  total += (code.match(/["'`](?:Lỗi server|Lỗi đồng bộ|Không thể kết nối tới server)/g) || []).length;
  return total;
};

describe("error messages shown in the interface", () => {
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

  it("recognises raw error text and technical wording, and accepts the shared helper", () => {
    expect(countLeaks("toast.error(err.message)")).toBe(1);
    expect(countLeaks('toast.error(error.response?.data?.message || "Không thể lưu")')).toBe(1);
    expect(countLeaks("<p>Lỗi tải dữ liệu: {error.message}</p>")).toBe(1);
    expect(countLeaks('setError("Lỗi đồng bộ")')).toBe(1);
    expect(countLeaks('toast.error(getUserErrorMessage(error, "Không thể lưu"))')).toBe(0);
    expect(countLeaks('toast.error("Không thể lưu. Vui lòng thử lại.")')).toBe(0);
    expect(countLeaks("// toast.error(err.message)")).toBe(0);
  });
});
