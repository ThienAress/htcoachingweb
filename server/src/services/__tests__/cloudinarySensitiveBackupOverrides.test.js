import { describe, expect, it } from "vitest";

import { createF1CloudinaryUploadOptions } from "../f1MediaStorage.service.js";
import { createCoachingCloudinaryUploadOptions } from "../coachingPrivateMedia.service.js";

describe("sensitive Cloudinary upload backup overrides", () => {
  it("forces backup off for private F1 images", () => {
    expect(
      createF1CloudinaryUploadOptions({
        customerId: "customer-1",
        mediaId: "media-1",
      }),
    ).toMatchObject({
      type: "authenticated",
      access_mode: "authenticated",
      backup: false,
    });
  });

  it("forces backup off only for authenticated coaching feedback", () => {
    const request = {
      user: { id: "user-1" },
      params: { dateString: "2026-09-06", exerciseId: "exercise-1" },
    };

    expect(
      createCoachingCloudinaryUploadOptions(request, {}, true),
    ).toMatchObject({
      type: "authenticated",
      access_mode: "authenticated",
      backup: false,
    });
    expect(
      createCoachingCloudinaryUploadOptions(request, {}, false),
    ).not.toHaveProperty("backup");
  });
});
