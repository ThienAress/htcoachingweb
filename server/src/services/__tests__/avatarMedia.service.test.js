import { describe, expect, it } from "vitest";

import { createAvatarCloudinaryUploadOptions } from "../avatarMedia.service.js";

describe("avatar Cloudinary privacy policy", () => {
  it("forces backup off at the avatar upload seam", () => {
    expect(createAvatarCloudinaryUploadOptions()).toMatchObject({
      folder: "htcoaching/avatars",
      backup: false,
    });
  });
});
