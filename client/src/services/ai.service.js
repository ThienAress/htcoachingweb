import api from "../utils/api";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "");

// Lấy lịch sử chat
export const getAiHistory = async () => {
  const res = await api.get("/ai/history");
  return res.data;
};

// Xóa lịch sử chat
export const clearAiHistory = async () => {
  const res = await api.delete("/ai/history");
  return res.data;
};

// Tạo SSE URL cho chat (dùng fetch thay vì EventSource vì cần POST + cookies)
export const getAiChatUrl = () => `${API_URL}/ai/chat`;
