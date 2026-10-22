import { describe, expect, it } from "vitest";

import {
  caretPositionForDigitCount,
  countDigits,
  formatAmountInput,
  normalizeAmountDigits,
  resolveAmountEdit,
} from "../amountInput";

describe("amountInput", () => {
  it("hiển thị 10000000 thành 10.000.000 (vi) và 10,000,000 (en)", () => {
    expect(formatAmountInput("10000000", "vi")).toBe("10.000.000");
    expect(formatAmountInput("10000000", "en")).toBe("10,000,000");
    expect(formatAmountInput("1000", "vi")).toBe("1.000");
    expect(formatAmountInput("999", "vi")).toBe("999");
    expect(formatAmountInput("", "vi")).toBe("");
  });

  it("nhận lại chuỗi đã có dấu chấm và loại ký tự không phải số", () => {
    expect(normalizeAmountDigits("10.000.000")).toBe("10000000");
    expect(normalizeAmountDigits("12a3,4 5")).toBe("12345");
    expect(normalizeAmountDigits("abc")).toBe("");
    expect(normalizeAmountDigits(null)).toBe("");
  });

  it("bỏ số 0 đứng đầu và giới hạn độ dài để không tràn số an toàn", () => {
    expect(normalizeAmountDigits("0012")).toBe("12");
    expect(normalizeAmountDigits("0")).toBe("0");
    expect(normalizeAmountDigits("1".repeat(30))).toHaveLength(13);
  });

  it("đặt lại con trỏ theo số chữ số đứng trước, không tính dấu chấm", () => {
    expect(countDigits("10.0")).toBe(3);
    expect(caretPositionForDigitCount("10.000.000", 0)).toBe(0);
    expect(caretPositionForDigitCount("10.000.000", 2)).toBe(2);
    expect(caretPositionForDigitCount("10.000.000", 3)).toBe(4);
    expect(caretPositionForDigitCount("10.000.000", 8)).toBe(10);
    expect(caretPositionForDigitCount("10.000.000", 99)).toBe(10);
  });
});

describe("resolveAmountEdit", () => {
  it("gõ thêm chữ số: giữ nguyên và đặt con trỏ sau chữ số vừa gõ", () => {
    expect(resolveAmountEdit({ value: "10.0005", selectionStart: 7, previousDigits: "10000", inputType: "insertText" })).toEqual({
      digits: "100005",
      caretDigits: 6,
    });
  });

  it("Backspace đúng vào dấu chấm thì xóa chữ số đứng trước dấu chấm", () => {
    // "10.000.000" con trỏ sau dấu chấm đầu (vị trí 3), người dùng nhấn Backspace xóa dấu chấm -> "10000.000"
    expect(
      resolveAmountEdit({ value: "10000.000", selectionStart: 2, previousDigits: "10000000", inputType: "deleteContentBackward" }),
    ).toEqual({ digits: "1000000", caretDigits: 1 });
  });

  it("Delete đúng vào dấu chấm thì xóa chữ số đứng sau dấu chấm", () => {
    expect(
      resolveAmountEdit({ value: "10000.000", selectionStart: 2, previousDigits: "10000000", inputType: "deleteContentForward" }),
    ).toEqual({ digits: "1000000", caretDigits: 2 });
  });

  it("xóa một chữ số thật thì không xóa thêm", () => {
    expect(resolveAmountEdit({ value: "1.000.000", selectionStart: 1, previousDigits: "10000000", inputType: "deleteContentBackward" })).toEqual({
      digits: "1000000",
      caretDigits: 1,
    });
  });

  it("dán chuỗi có chữ cái chỉ giữ chữ số", () => {
    expect(resolveAmountEdit({ value: "abc12x", selectionStart: 6, previousDigits: "", inputType: "insertFromPaste" })).toEqual({
      digits: "12",
      caretDigits: 2,
    });
  });
});
