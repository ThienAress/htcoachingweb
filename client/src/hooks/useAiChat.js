import { useState, useRef, useCallback } from "react";
import Cookies from "js-cookie";
import api from "../utils/api";
import { getAiHistory, clearAiHistory, getAiChatUrl } from "../services/ai.service";

/**
 * Gửi chat request qua fetch (cho SSE streaming)
 * Tự refresh token khi gặp 401
 */
async function fetchWithRefresh(url, options) {
  let response = await fetch(url, options);

  // Nếu 401 → thử refresh token rồi retry 1 lần
  if (response.status === 401) {
    try {
      await api.post("/auth/refresh", {});
      // Lấy CSRF token mới sau refresh
      const newCsrf = Cookies.get("csrfToken");
      if (newCsrf && options.headers) {
        options.headers["X-CSRF-Token"] = newCsrf;
      }
      response = await fetch(url, options);
    } catch {
      // Refresh thất bại — redirect login
      window.location.href = "/login";
      throw new Error("Phiên đăng nhập hết hạn");
    }
  }

  return response;
}

/**
 * Hook quản lý AI chat — SSE streaming + state management
 */
export default function useAiChat() {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Load lịch sử chat
  const loadHistory = useCallback(async () => {
    try {
      const res = await getAiHistory();
      if (res.data) {
        setConversationId(res.data.conversationId);
        setMessages(
          res.data.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              role: m.role,
              content: m.content,
              uiCard: m.uiCard || null,
              timestamp: m.timestamp,
            }))
        );
      }
    } catch {
      // Chưa có history — bỏ qua
    }
  }, []);

  // Gửi tin nhắn + nhận SSE stream
  const sendMessage = useCallback(
    async (text, context = {}) => {
      if (!text.trim() || isLoading) return;

      // Thêm user message vào UI ngay
      const userMsg = { role: "user", content: text.trim(), timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);
      setActiveTool(null);

      // Placeholder cho assistant response
      const assistantMsg = { role: "assistant", content: "", uiCards: [], timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const csrfToken = Cookies.get("csrfToken");
        const fetchOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken && { "X-CSRF-Token": csrfToken }),
          },
          credentials: "include",
          body: JSON.stringify({ message: text.trim(), conversationId, context }),
          signal: controller.signal,
        };

        const response = await fetchWithRefresh(getAiChatUrl(), fetchOptions);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);

            try {
              const event = JSON.parse(jsonStr);

              switch (event.type) {
                case "text":
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === "assistant") {
                      updated[updated.length - 1] = { ...last, content: last.content + event.content };
                    }
                    return updated;
                  });
                  break;

                case "tool_start":
                  setActiveTool(event.tool);
                  break;

                case "tool_result":
                  setActiveTool(null);
                  break;

                case "ui_card":
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === "assistant") {
                      const cards = [...(last.uiCards || []), { cardType: event.cardType, data: event.data }];
                      updated[updated.length - 1] = { ...last, uiCards: cards };
                    }
                    return updated;
                  });
                  break;

                case "done":
                  if (event.conversationId) setConversationId(event.conversationId);
                  break;

                case "error":
                  setError(event.message);
                  break;
              }
            } catch {
              // JSON parse error — skip
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Không thể kết nối tới server");
          // Xóa assistant placeholder nếu lỗi
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.content) {
              return prev.slice(0, -1);
            }
            return prev;
          });
        }
      } finally {
        setIsLoading(false);
        setActiveTool(null);
        abortRef.current = null;
      }
    },
    [conversationId, isLoading]
  );

  // Hủy request đang chạy
  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setActiveTool(null);
  }, []);

  // Xóa lịch sử
  const clearHistory = useCallback(async () => {
    try {
      await clearAiHistory();
      setMessages([]);
      setConversationId(null);
      setError(null);
    } catch {
      // ignore
    }
  }, []);

  return {
    messages,
    isLoading,
    activeTool,
    error,
    sendMessage,
    loadHistory,
    clearHistory,
    cancelRequest,
  };
}
