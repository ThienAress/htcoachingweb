import api from "../utils/api";
import Cookies from "js-cookie";

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

export const forkAiConversation = async (conversationId, messageId) => {
  const res = await api.post(`/ai/conversations/${conversationId}/fork`, {
    messageId,
  });
  return res.data;
};

// Gửi feedback 👍/👎 cho message
export const submitAiFeedback = async (conversationId, messageId, feedback) => {
  const res = await api.post(`/ai/conversations/${conversationId}/feedback`, { messageId, feedback });
  return res.data;
};

const syncCsrfToken = (response) => {
  const token = response.headers.get("X-CSRF-Token");
  if (token) Cookies.set("csrfToken", token, { path: "/" });
  return token;
};

const isCsrfFailure = async (response) => {
  if (response.status !== 403) return false;
  const payload = await response.clone().json().catch(() => ({}));
  return ["Invalid CSRF token", "CSRF token missing"].includes(payload.message);
};

export const openAiChatStream = async (payload, { signal } = {}) => {
  let refreshedSession = false;
  let retriedCsrf = false;

  while (true) {
    const csrfToken = Cookies.get("csrfToken");
    const response = await fetch(getAiChatUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken && { "X-CSRF-Token": csrfToken }),
      },
      credentials: "include",
      body: JSON.stringify(payload),
      signal,
    });
    const responseCsrfToken = syncCsrfToken(response);

    if (response.status === 401 && !refreshedSession) {
      refreshedSession = true;
      try {
        await api.post("/auth/refresh", {});
      } catch {
        window.location.href = "/login";
        throw new Error("Phiên đăng nhập hết hạn");
      }
      continue;
    }

    if (
      !retriedCsrf &&
      responseCsrfToken &&
      (await isCsrfFailure(response))
    ) {
      retriedCsrf = true;
      continue;
    }

    return response;
  }
};

// Tạo SSE URL cho chat (dùng fetch thay vì EventSource vì cần POST + cookies)
export const getAiChatUrl = () => `${API_URL}/ai/chat`;
