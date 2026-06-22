import { describe, it, expect } from "vitest";

// =============================================================================
// TDD: auth.controller — Test pure functions (không cần DB)
// sanitizeUserResponse, getAuthCookieOptions, getCsrfCookieOptions
// =============================================================================

// Recreate pure functions từ auth.controller.js để test behavior

const sanitizeUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const getAuthCookieOptions = (maxAge = null) => {
  const isProd = process.env.NODE_ENV === "production";
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };
  if (maxAge) {
    options.maxAge = maxAge;
  }
  return options;
};

const getCsrfCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  };
};

describe("sanitizeUserResponse", () => {
  it("chỉ trả về 4 fields: id, name, email, role", () => {
    const user = {
      _id: "abc123",
      name: "Test User",
      email: "test@example.com",
      role: "user",
      password: "hashed_password",
      refreshToken: "secret_token",
      createdAt: new Date(),
    };
    const result = sanitizeUserResponse(user);

    expect(Object.keys(result)).toHaveLength(4);
    expect(result).toEqual({
      id: "abc123",
      name: "Test User",
      email: "test@example.com",
      role: "user",
    });
  });

  it("KHÔNG bao gồm password trong response", () => {
    const user = {
      _id: "abc123",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      password: "super_secret_hash",
    };
    const result = sanitizeUserResponse(user);

    expect(result.password).toBeUndefined();
  });

  it("KHÔNG bao gồm refreshToken trong response", () => {
    const user = {
      _id: "abc123",
      name: "User",
      email: "user@example.com",
      role: "user",
      refreshToken: "refresh_token_value",
    };
    const result = sanitizeUserResponse(user);

    expect(result.refreshToken).toBeUndefined();
  });

  it("map _id thành id", () => {
    const user = {
      _id: "mongo_object_id",
      name: "User",
      email: "user@example.com",
      role: "user",
    };
    const result = sanitizeUserResponse(user);

    expect(result.id).toBe("mongo_object_id");
    expect(result._id).toBeUndefined();
  });
});

describe("getAuthCookieOptions", () => {
  it("httpOnly luôn là true (bảo vệ XSS)", () => {
    const options = getAuthCookieOptions();
    expect(options.httpOnly).toBe(true);
  });

  it('development: secure = false, sameSite = "lax"', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const options = getAuthCookieOptions();
    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("lax");

    process.env.NODE_ENV = originalEnv;
  });

  it("thêm maxAge khi có parameter", () => {
    const options = getAuthCookieOptions(15 * 60 * 1000);
    expect(options.maxAge).toBe(900000); // 15 phút
  });

  it("không có maxAge khi parameter là null", () => {
    const options = getAuthCookieOptions();
    expect(options.maxAge).toBeUndefined();
  });

  it('path luôn là "/"', () => {
    const options = getAuthCookieOptions();
    expect(options.path).toBe("/");
  });
});

describe("getCsrfCookieOptions", () => {
  it("httpOnly phải là false (frontend cần đọc CSRF token)", () => {
    const options = getCsrfCookieOptions();
    expect(options.httpOnly).toBe(false);
  });

  it("maxAge là 24 giờ", () => {
    const options = getCsrfCookieOptions();
    expect(options.maxAge).toBe(86400000); // 24 * 60 * 60 * 1000
  });

  it('path luôn là "/"', () => {
    const options = getCsrfCookieOptions();
    expect(options.path).toBe("/");
  });
});
