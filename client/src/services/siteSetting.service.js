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
  return api.delete(`${API_URL}/images`, {
    data: { fieldName, imageUrl },
  });
};

export const removeSettingItemImage = (fieldName, itemKey, imageUrl) => {
  return api.delete(`${API_URL}/images`, {
    data: { fieldName, itemKey, imageUrl },
  });
};

export const savePricingGifts = (key, gifts) =>
  api.put(`${API_URL}/pricing-gifts/${encodeURIComponent(key)}`, { gifts });

export const resetPricingGifts = (key) =>
  api.delete(`${API_URL}/pricing-gifts/${encodeURIComponent(key)}`);

export const savePricingContent = (key, items) =>
  api.put(`${API_URL}/pricing-content/${encodeURIComponent(key)}`, { items });

export const resetPricingContent = (key) =>
  api.delete(`${API_URL}/pricing-content/${encodeURIComponent(key)}`);

export const saveLoginPromo = ({ enabled, percent }) =>
  api.put(`${API_URL}/login-promo`, { enabled, percent });

export const resetLoginPromo = () => api.delete(`${API_URL}/login-promo`);
