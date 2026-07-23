import { describe, expect, it } from "vitest";

import { getServerBaseUrl, resolveMediaUrl } from "../mediaUrl";

describe("media URL helpers", () => {
  it("removes the API suffix from the configured server URL", () => {
    expect(getServerBaseUrl("https://api.example.com/api")).toBe(
      "https://api.example.com",
    );
    expect(getServerBaseUrl("https://api.example.com/api/")).toBe(
      "https://api.example.com",
    );
  });

  it("keeps absolute Cloudinary URLs unchanged", () => {
    const url =
      "https://res.cloudinary.com/demo/video/upload/htcoaching/review.mp4";

    expect(resolveMediaUrl(url, "https://api.example.com/api")).toBe(url);
  });

  it("prefixes only server-relative media paths", () => {
    expect(
      resolveMediaUrl("/uploads/coaching/review.mp4", "https://api.example.com/api"),
    ).toBe("https://api.example.com/uploads/coaching/review.mp4");
    expect(resolveMediaUrl("review.mp4", "https://api.example.com/api")).toBe(
      "review.mp4",
    );
  });

  it("returns an empty string for missing media", () => {
    expect(resolveMediaUrl(null, "https://api.example.com/api")).toBe("");
  });
});
