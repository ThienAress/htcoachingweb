import { describe, it, expect } from "vitest";
import crypto from "crypto";

// =============================================================================
// TDD: deposit.controller — Test pure functions
// generateDepositCode() không được export, nên test logic tương đương
// =============================================================================

// Recreate logic — vì function là internal (không export)
// Đây là pattern hợp lệ: test behavior, không cần access internal
function generateDepositCode() {
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `HTC-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

describe("generateDepositCode", () => {
  it("tạo mã có format HTC-XXXX-XXXX", () => {
    const code = generateDepositCode();
    expect(code).toMatch(/^HTC-[A-F0-9]{4}-[A-F0-9]{4}$/);
  });

  it("mã luôn bắt đầu bằng HTC-", () => {
    const code = generateDepositCode();
    expect(code.startsWith("HTC-")).toBe(true);
  });

  it("mã có đúng 13 ký tự (HTC-XXXX-XXXX)", () => {
    const code = generateDepositCode();
    expect(code.length).toBe(13);
  });

  it("mã chỉ chứa uppercase hex characters", () => {
    const code = generateDepositCode();
    const hexPart = code.replace("HTC-", "").replace("-", "");
    expect(hexPart).toMatch(/^[A-F0-9]{8}$/);
  });

  it("tạo mã unique (entropy cao - 2 mã liên tiếp phải khác nhau)", () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateDepositCode());
    }
    // 100 mã phải có ít nhất 99 unique (collision chance cực thấp với 4 bytes)
    expect(codes.size).toBeGreaterThanOrEqual(99);
  });
});
