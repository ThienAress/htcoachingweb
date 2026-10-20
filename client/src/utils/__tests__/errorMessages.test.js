import { describe, expect, it } from "vitest";

import {
  GENERIC_ERROR_MESSAGE,
  OFFLINE_ERROR_MESSAGE,
  SLOW_ERROR_MESSAGE,
  getUserErrorMessage,
  isFriendlyMessage,
} from "../errorMessages";

const apiError = (status, data) => ({ isAxiosError: true, message: `Request failed with status code ${status}`, response: { status, data } });

describe("getUserErrorMessage", () => {
  it("never shows the raw axios text when the network is down or slow", () => {
    expect(getUserErrorMessage({ isAxiosError: true, request: {}, message: "Network Error" })).toBe(OFFLINE_ERROR_MESSAGE);
    expect(getUserErrorMessage({ isAxiosError: true, code: "ECONNABORTED", message: "timeout of 15000ms exceeded" })).toBe(SLOW_ERROR_MESSAGE);
  });

  it("uses a Vietnamese server message that has no technical words", () => {
    expect(getUserErrorMessage(apiError(409, { code: "ORDER_PAID", message: "Đơn này đã được thanh toán" }))).toBe(
      "Đơn này đã được thanh toán",
    );
  });

  it.each([
    ["Lỗi server", 500],
    ["Lỗi hệ thống khi tạo yêu cầu", 500],
    ["Internal Server Error", 500],
    ["Token không hợp lệ", 401],
    ["Request failed with status code 500", 500],
    ["CSRF token missing", 403],
    ["Lỗi đồng bộ server", 500],
  ])("replaces the technical message %j (status %i)", (message, status) => {
    const result = getUserErrorMessage(apiError(status, { message }));

    expect(result).not.toBe(message);
    expect(isFriendlyMessage(result)).toBe(true);
  });

  it("maps CSRF failures by code and tells the user to reload", () => {
    expect(getUserErrorMessage(apiError(403, { code: "CSRF_TOKEN_INVALID", message: "Invalid CSRF token" }))).toMatch(/tải lại trang/);
  });

  it("falls back by status, then to the caller's own sentence", () => {
    expect(getUserErrorMessage(apiError(404, {}))).toMatch(/Không tìm thấy/);
    expect(getUserErrorMessage(apiError(503, undefined))).toMatch(/Hệ thống đang bận/);
    expect(getUserErrorMessage(apiError(418, {}), "Không lưu được bài viết.")).toBe("Không lưu được bài viết.");
  });

  it("keeps a Vietnamese Error written by the UI and hides everything else", () => {
    expect(getUserErrorMessage(new Error("Vui lòng chọn ít nhất một bài tập"))).toBe("Vui lòng chọn ít nhất một bài tập");
    expect(getUserErrorMessage(new Error("Cannot read properties of undefined"))).toBe(GENERIC_ERROR_MESSAGE);
    expect(getUserErrorMessage(new Error("boom"), "Không lưu được.")).toBe("Không lưu được.");
    expect(getUserErrorMessage(undefined)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("does not treat Vietnamese words that merely look short as technical", () => {
    expect(isFriendlyMessage("Không thể tải danh sách thực phẩm")).toBe(true);
    expect(isFriendlyMessage("Tên huấn luyện viên đã tồn tại")).toBe(true);
    expect(isFriendlyMessage("API không hoạt động")).toBe(false);
  });
});
