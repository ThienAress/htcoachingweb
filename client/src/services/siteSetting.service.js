import axios from "axios";

const API_URL = "/api/site-settings";

export const getSiteSettings = () => axios.get(API_URL);

export const uploadSettingImage = (fieldName, formData) => {
  return axios.post(`${API_URL}/upload/${fieldName}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const removeSettingImage = (fieldName, imageUrl) => {
  return axios.delete(`${API_URL}/remove`, {
    data: { fieldName, imageUrl },
  });
};
