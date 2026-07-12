import api from "../utils/api";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "");

// Lấy lịch sử chat (conversation gần nhất — backward compat)
export const getAiHistory = async () => {
  const res = await api.get("/ai/history");
  return res.data;
};

// Xóa toàn bộ lịch sử chat
export const clearAiHistory = async () => {
  const res = await api.delete("/ai/history");
  return res.data;
};

// Danh sách tất cả conversations
export const getAiConversations = async () => {
  const res = await api.get("/ai/conversations");
  return res.data;
};

// Load 1 conversation cụ thể
export const getAiConversationById = async (id) => {
  const res = await api.get(`/ai/conversations/${id}`);
  return res.data;
};

// Xóa 1 conversation cụ thể
export const deleteAiConversation = async (id) => {
  const res = await api.delete(`/ai/conversations/${id}`);
  return res.data;
};

// Gửi feedback 👍/👎 cho message
export const submitAiFeedback = async (conversationId, messageId, feedback) => {
  const res = await api.post(`/ai/conversations/${conversationId}/feedback`, { messageId, feedback });
  return res.data;
};

// Tạo SSE URL cho chat (dùng fetch thay vì EventSource vì cần POST + cookies)
export const getAiChatUrl = () => `${API_URL}/ai/chat`;
