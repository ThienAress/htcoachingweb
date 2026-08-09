import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../../utils/api";
import {
  removeSettingItemImage,
  uploadSettingImage,
  uploadSettingItemImage,
} from "../siteSetting.service";

describe("site setting keyed media service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: { success: true } });
    api.delete.mockResolvedValue({ data: { success: true } });
  });

  it("uploads one image to the selected section and item key", async () => {
    const formData = new FormData();

    await uploadSettingItemImage("classes", "cardio-hiit", formData);

    expect(api.post).toHaveBeenCalledWith(
      "/site-settings/upload/classes/cardio-hiit",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  });

  it("translates the hero avatar field to its existing kebab-case route", async () => {
    const formData = new FormData();

    await uploadSettingItemImage("heroAvatars", "student-avatar-1", formData);

    expect(api.post).toHaveBeenCalledWith(
      "/site-settings/upload/hero-avatars/student-avatar-1",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  });

  it("keeps the legacy hero avatar uploader on the same kebab-case route", async () => {
    const formData = new FormData();

    await uploadSettingImage("heroAvatars", formData);

    expect(api.post).toHaveBeenCalledWith(
      "/site-settings/upload/hero-avatars",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  });

  it("removes only the selected item key", async () => {
    await removeSettingItemImage("tools", "meal-scan", "meal-scan.webp");

    expect(api.delete).toHaveBeenCalledWith("/site-settings/remove", {
      data: {
        fieldName: "tools",
        itemKey: "meal-scan",
        imageUrl: "meal-scan.webp",
      },
    });
  });
});
