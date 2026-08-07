import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../models/SiteSetting.js", () => ({
  default: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../utils/cloudinaryUpload.js", () => ({
  uploadBufferToCloudinary: vi.fn(),
}));

vi.mock("../../utils/safeLogger.js", () => ({
  safeLog: { error: vi.fn() },
}));

import SiteSetting from "../../models/SiteSetting.js";
import {
  removeSettingImage,
  uploadSettingImage,
} from "../siteSetting.controller.js";
import { uploadBufferToCloudinary } from "../../utils/cloudinaryUpload.js";

const createSettings = () => ({
  heroImages: [],
  heroAvatars: [],
  aboutImages: [],
  classesImages: ["legacy-pt.jpg", "legacy-cardio.jpg", "legacy-boxing.jpg"],
  trainerImage: "",
  toolsImage: "legacy-tdee.jpg",
  heroImagesByKey: new Map(),
  heroAvatarsByKey: new Map(),
  aboutImagesByKey: new Map(),
  trainerImagesByKey: new Map(),
  classesImagesByKey: new Map([
    ["boxing", "boxing-old.webp"],
    ["cardio-hiit", "cardio.webp"],
  ]),
  toolsImagesByKey: new Map([["meal-scan", "meal-scan.webp"]]),
  save: vi.fn().mockResolvedValue(undefined),
});

const createResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

const uploadRequest = (fieldName, itemKey) => ({
  body: { fieldName, itemKey },
  file: {
    originalname: `${itemKey || "legacy"}.jpg`,
    mimetype: "image/jpeg",
    buffer: Buffer.from("test-image"),
  },
});

describe("site setting keyed media controller", () => {
  let settings;

  beforeEach(() => {
    vi.clearAllMocks();
    settings = createSettings();
    SiteSetting.findOne.mockResolvedValue(settings);
    uploadBufferToCloudinary.mockResolvedValue({ url: "uploaded.webp" });
  });

  it("rejects an invalid item key before uploading", async () => {
    const res = createResponse();

    await uploadSettingImage(uploadRequest("classes", "../boxing"), res);

    expect({
      status: res.status.mock.calls[0]?.[0],
      uploads: uploadBufferToCloudinary.mock.calls.length,
    }).toEqual({ status: 400, uploads: 0 });
  });

  it("replaces only the selected class image key", async () => {
    const res = createResponse();

    await uploadSettingImage(uploadRequest("classes", "boxing"), res);

    expect(Object.fromEntries(settings.classesImagesByKey)).toEqual({
      boxing: "uploaded.webp",
      "cardio-hiit": "cardio.webp",
    });
  });

  it.each([
    ["hero", "banner-2", "heroImagesByKey"],
    ["heroAvatars", "student-avatar-2", "heroAvatarsByKey"],
    ["about", "about-slide-4", "aboutImagesByKey"],
    ["trainer", "trainer-photo", "trainerImagesByKey"],
  ])("stores a keyed %s image without changing legacy data", async (
    fieldName,
    itemKey,
    mapField,
  ) => {
    const res = createResponse();

    await uploadSettingImage(uploadRequest(fieldName, itemKey), res);

    expect(settings[mapField].get(itemKey)).toBe("uploaded.webp");
  });

  it("removes only the selected tool image key", async () => {
    const res = createResponse();

    await removeSettingImage(
      {
        body: {
          fieldName: "tools",
          itemKey: "meal-scan",
          imageUrl: "meal-scan.webp",
        },
      },
      res,
    );

    expect(Object.fromEntries(settings.toolsImagesByKey)).toEqual({});
  });

  it("keeps a newer keyed image when a stale remove request arrives", async () => {
    const res = createResponse();
    settings.toolsImagesByKey.set("meal-scan", "meal-scan-new.webp");

    await removeSettingImage(
      {
        body: {
          fieldName: "tools",
          itemKey: "meal-scan",
          imageUrl: "meal-scan-old.webp",
        },
      },
      res,
    );

    expect({
      status: res.status.mock.calls[0]?.[0],
      image: settings.toolsImagesByKey.get("meal-scan"),
    }).toEqual({ status: 409, image: "meal-scan-new.webp" });
  });

  it("keeps legacy class upload behavior when no item key is provided", async () => {
    const res = createResponse();

    await uploadSettingImage(uploadRequest("classes"), res);

    expect(settings.classesImages).toEqual([
      "legacy-pt.jpg",
      "legacy-cardio.jpg",
      "legacy-boxing.jpg",
      "uploaded.webp",
    ]);
  });
});
