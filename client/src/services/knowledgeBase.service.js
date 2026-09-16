import api from "../utils/api";

const BASE = "/knowledge-base";

// Entries CRUD
export const getKBEntries = (params, signal) => api.get(BASE, { params, signal });
export const createKBEntry = (data) => api.post(BASE, data);
export const updateKBEntry = (id, data) => api.put(`${BASE}/${id}`, data);
export const deleteKBEntry = (id) => api.delete(`${BASE}/${id}`);
export const createKBFromConversation = (data) => api.post(`${BASE}/from-conversation`, data);
export const searchKB = (params, signal) => api.get(`${BASE}/search`, { params, signal });
export const getKBStats = (signal) => api.get(`${BASE}/stats`, { signal });
export const getKBCategories = (signal) => api.get(`${BASE}/categories`, { signal });
export const regenerateKBEmbedding = (id) => api.post(`${BASE}/${id}/regenerate-embedding`);
export const aiSuggestKB = (data) => api.post(`${BASE}/ai-suggest`, data);
export const mergeKBVariant = (id, data) => api.post(`${BASE}/${id}/merge`, data);
export const getKBVariants = (id, signal) => api.get(`${BASE}/${id}/variants`, { signal });
export const deleteKBVariant = (id, variantId) => api.delete(`${BASE}/${id}/variants/${variantId}`);

// Conversation review (admin)
export const getAllConversations = (params, signal) => api.get(`${BASE}/conversations`, { params, signal });
export const getFullConversation = (id, params, signal) =>
  api.get(`${BASE}/conversations/${id}`, { params, signal });
export const reviewAiFeedback = (conversationId, messageId, status) =>
  api.post(`${BASE}/feedback/${conversationId}/${messageId}/review`, { status });
