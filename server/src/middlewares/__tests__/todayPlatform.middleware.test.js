import { describe, expect, it, vi } from "vitest";
import { createRequireTodayPlatform } from "../todayPlatform.middleware.js";

const createResponse = () => {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
};

describe("Today platform middleware", () => {
  it("blocks production access when the flag is missing", () => {
    const response = createResponse();
    const next = vi.fn();

    createRequireTodayPlatform({ NODE_ENV: "production" })(
      {},
      response,
      next,
    );

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "TODAY_PLATFORM_DISABLED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks production when only the legacy feature flag is enabled", () => {
    const response = createResponse();
    const next = vi.fn();

    createRequireTodayPlatform({
      NODE_ENV: "production",
      APP_ENV: "production",
      TODAY_DASHBOARD_ENABLED: "true",
    })({}, response, next);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes through staging requests", () => {
    const response = createResponse();
    const next = vi.fn();

    createRequireTodayPlatform({
      NODE_ENV: "production",
      APP_ENV: "staging",
    })({}, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });
});
