import { describe, it, expect } from "vitest";
import { utcToLocalDateTime, localDateTimeToUTC } from "../date";

// =============================================================================
// TDD: date.js — Test behavior của 2 hàm chuyển đổi datetime
// Quy tắc: Test behavior (output), không test implementation (internal state)
// =============================================================================

describe("utcToLocalDateTime", () => {
  // --- Happy path ---
  it("chuyển UTC ISO string thành format YYYY-MM-DDTHH:mm", () => {
    const utc = "2026-06-22T05:30:00.000Z";
    const result = utcToLocalDateTime(utc);

    // Kết quả phải match format datetime-local (YYYY-MM-DDTHH:mm)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("trả về string không rỗng khi input hợp lệ", () => {
    const result = utcToLocalDateTime("2026-01-15T10:00:00Z");
    expect(result).not.toBe("");
    expect(result.length).toBe(16); // "YYYY-MM-DDTHH:mm" = 16 ký tự
  });

  // --- Edge cases: input rỗng/null/undefined ---
  it('trả về "" khi input là null', () => {
    expect(utcToLocalDateTime(null)).toBe("");
  });

  it('trả về "" khi input là undefined', () => {
    expect(utcToLocalDateTime(undefined)).toBe("");
  });

  it('trả về "" khi input là empty string', () => {
    expect(utcToLocalDateTime("")).toBe("");
  });

  // --- Edge cases: input không hợp lệ ---
  it('trả về "" khi input là string ngẫu nhiên không phải date', () => {
    expect(utcToLocalDateTime("not-a-date")).toBe("");
  });

  it('trả về "" khi input là "abc123"', () => {
    expect(utcToLocalDateTime("abc123")).toBe("");
  });

  // --- Consistency ---
  it("output luôn có month/day/hours/minutes 2 chữ số (zero-padded)", () => {
    // Tháng 1, ngày 5, 3 giờ sáng UTC → local sẽ khác nhưng vẫn phải 2 digit
    const result = utcToLocalDateTime("2026-01-05T03:07:00Z");
    const parts = result.split("T");
    const [year, month, day] = parts[0].split("-");
    const [hours, minutes] = parts[1].split(":");

    expect(month.length).toBe(2);
    expect(day.length).toBe(2);
    expect(hours.length).toBe(2);
    expect(minutes.length).toBe(2);
  });
});

describe("localDateTimeToUTC", () => {
  // --- Happy path ---
  it("chuyển datetime-local thành UTC ISO string", () => {
    const result = localDateTimeToUTC("2026-06-22T12:30");

    // ISO string phải kết thúc bằng Z (UTC)
    expect(result).toMatch(/Z$/);
    // Phải là ISO format đầy đủ
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("trả về ISO string có đầy đủ seconds và milliseconds", () => {
    const result = localDateTimeToUTC("2026-06-22T12:30");

    // toISOString() luôn trả về format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(result).toMatch(/\.\d{3}Z$/);
  });

  // --- Edge cases: input rỗng/null/undefined ---
  it('trả về "" khi input là null', () => {
    expect(localDateTimeToUTC(null)).toBe("");
  });

  it('trả về "" khi input là undefined', () => {
    expect(localDateTimeToUTC(undefined)).toBe("");
  });

  it('trả về "" khi input là empty string', () => {
    expect(localDateTimeToUTC("")).toBe("");
  });

  // --- Edge cases: input không hợp lệ ---
  it('trả về "" khi input không phải date format', () => {
    expect(localDateTimeToUTC("hello-world")).toBe("");
  });

  // --- Round-trip consistency ---
  it("UTC → local → UTC phải giữ nguyên thời gian gốc (round-trip)", () => {
    const originalUTC = "2026-06-22T05:30:00.000Z";
    const local = utcToLocalDateTime(originalUTC);
    const backToUTC = localDateTimeToUTC(local);

    // So sánh Date objects (bỏ qua milliseconds vì local format không có ms)
    const originalDate = new Date(originalUTC);
    const roundTripDate = new Date(backToUTC);

    // Chênh lệch phải < 60 giây (vì datetime-local không có seconds)
    const diffMs = Math.abs(originalDate.getTime() - roundTripDate.getTime());
    expect(diffMs).toBeLessThan(60000);
  });
});
