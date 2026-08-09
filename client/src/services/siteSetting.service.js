import api from "../utils/api";

const API_URL = "/site-settings";
const UPLOAD_PATH_BY_FIELD = {
  heroAvatars: "hero-avatars",
};

const getUploadPath = (fieldName) => UPLOAD_PATH_BY_FIELD[fieldName] || fieldName;

export const getSiteSettings = () => api.get(API_URL);

export const uploadSettingImage = (fieldName, formData) => {
  return api.post(`${API_URL}/upload/${getUploadPath(fieldName)}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const uploadSettingItemImage = (section, itemKey, formData) => {
  return api.post(
    `${API_URL}/upload/${getUploadPath(section)}/${encodeURIComponent(itemKey)}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
};

export const removeSettingImage = (fieldName, imageUrl) => {
  return api.delete(`${API_URL}/remove`, {
    data: { fieldName, imageUrl },
  });
};

export const removeSettingItemImage = (fieldName, itemKey, imageUrl) => {
  return api.delete(`${API_URL}/remove`, {
    data: { fieldName, itemKey, imageUrl },
  });
};
