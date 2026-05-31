import api from "../utils/api";

const API_URL = "/site-settings";

export const getSiteSettings = () => api.get(API_URL);

export const uploadSettingImage = (fieldName, formData) => {
  return api.post(`${API_URL}/upload/${fieldName}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const removeSettingImage = (fieldName, imageUrl) => {
  return api.delete(`${API_URL}/remove`, {
    data: { fieldName, imageUrl },
  });
};
