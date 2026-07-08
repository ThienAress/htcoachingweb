import api from "../utils/api";

const BASE = "/knowledge-base";

// Entries CRUD
export const getKBEntries = (params) => api.get(BASE, { params });
export const createKBEntry = (data) => api.post(BASE, data);
export const updateKBEntry = (id, data) => api.put(`${BASE}/${id}`, data);
export const deleteKBEntry = (id) => api.delete(`${BASE}/${id}`);
export const createKBFromConversation = (data) => api.post(`${BASE}/from-conversation`, data);
export const searchKB = (params) => api.get(`${BASE}/search`, { params });
export const getKBStats = () => api.get(`${BASE}/stats`);
export const getKBCategories = () => api.get(`${BASE}/categories`);
export const regenerateKBEmbedding = (id) => api.post(`${BASE}/${id}/regenerate-embedding`);
export const aiSuggestKB = (data) => api.post(`${BASE}/ai-suggest`, data);
export const mergeKBVariant = (id, data) => api.post(`${BASE}/${id}/merge`, data);
export const getKBVariants = (id) => api.get(`${BASE}/${id}/variants`);
export const deleteKBVariant = (id, variantId) => api.delete(`${BASE}/${id}/variants/${variantId}`);

// Conversation review (admin)
export const getAllConversations = (params) => api.get(`${BASE}/conversations`, { params });
export const getFullConversation = (id) => api.get(`${BASE}/conversations/${id}`);
