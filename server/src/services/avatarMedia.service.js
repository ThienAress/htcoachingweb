import { resolveCloudinaryBackupUploadOverride } from "../config/cloudinaryBackupPolicy.js";

export const createAvatarCloudinaryUploadOptions = () => ({
  folder: "htcoaching/avatars",
  backup: resolveCloudinaryBackupUploadOverride("user_avatar"),
  transformation: [
    { width: 200, height: 200, crop: "fill", gravity: "face" },
    { quality: "auto", fetch_format: "auto" },
  ],
});
