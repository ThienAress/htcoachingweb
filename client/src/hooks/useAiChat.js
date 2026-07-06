import { useState, useRef, useCallback } from "react";
import Cookies from "js-cookie";
import api from "../utils/api";
import {
  getAiHistory,
  getAiChatUrl,
  getAiConversations,
  getAiConversationById,
  deleteAiConversation,
} from "../services/ai.service";

/**
 * Gửi chat request qua fetch (cho SSE streaming)
 * Tự refresh token khi gặp 401
 */
async function fetchWithRefresh(url, options) {
  let response = await fetch(url, options);

  if (response.status === 401) {
    try {
      await api.post("/auth/refresh", {});
      const newCsrf = Cookies.get("csrfToken");
      if (newCsrf && options.headers) {
        options.headers["X-CSRF-Token"] = newCsrf;
      }
      response = await fetch(url, options);
    } catch {
      window.location.href = "/login";
      throw new Error("Phiên đăng nhập hết hạn");
    }
  }

  return response;
}

function mapMessages(rawMessages) {
  const result = [];
  for (const m of rawMessages) {
    if (m.role === "user") {
      result.push({ role: m.role, content: m.content || "", image: m.image || null, timestamp: m.timestamp });
    } else if (m.role === "assistant") {
      result.push({ role: m.role, content: m.content || "", uiCards: [], timestamp: m.timestamp });
    } else if (m.role === "tool" && m.uiCard) {
      // Gắn uiCard vào assistant message trước đó để render lịch sử
      const last = result[result.length - 1];
      if (last && last.role === "assistant") {
        last.uiCards.push(m.uiCard);
      }
    }
  }
  return result;
}

/**
 * Hook quản lý AI chat — SSE streaming + multi-conversation management
 */
export default function useAiChat() {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const sendingRef = useRef(false);


  // Typewriter Buffer Refs — Cơ chế tuyệt đối (Absolute State) để chống Race Condition
  const pendingTextRef = useRef("");
  const displayedTextRef = useRef(""); // Lưu chính xác những gì đang hiển thị trên UI
  const typeWriterIntervalRef = useRef(null);

  const stopTypewriter = useCallback(() => {
    if (typeWriterIntervalRef.current) {
      clearInterval(typeWriterIntervalRef.current);
      typeWriterIntervalRef.current = null;
    }
    if (pendingTextRef.current.length > 0) {
      const remaining = pendingTextRef.current;
      pendingTextRef.current = "";
      displayedTextRef.current += remaining;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, content: displayedTextRef.current };
        }
        return updated;
      });
    }
  }, []);

  const startTypewriter = useCallback(() => {
    if (typeWriterIntervalRef.current) return;
    typeWriterIntervalRef.current = setInterval(() => {
      const pendingLength = pendingTextRef.current.length;
      if (pendingLength > 0) {
        // Nếu bộ đệm dài, tăng tốc độ gõ để bắt kịp AI
        const charsToTake = pendingLength > 150 ? 12 : pendingLength > 50 ? 5 : 2;
        const chunk = pendingTextRef.current.slice(0, charsToTake);
        pendingTextRef.current = pendingTextRef.current.slice(charsToTake);
        displayedTextRef.current += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: displayedTextRef.current };
          }
          return updated;
        });
      }
    }, 25); // Render 40 khung hình / giây
  }, []);

  // Load conversation gần nhất (dùng khi mở panel lần đầu)
  const loadHistory = useCallback(async () => {
    try {
      const res = await getAiHistory();
      if (res.data) {
        setConversationId(res.data.conversationId);
        setMessages(mapMessages(res.data.messages));
      }
    } catch {
      // Chưa có history — bỏ qua
    }
  }, []);

  // Tải danh sách tất cả conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await getAiConversations();
      setConversations(res.data || []);
    } catch {
      // ignore
    }
  }, []);

  // Switch sang conversation khác
  const switchConversation = useCallback(async (id) => {
    try {
      const res = await getAiConversationById(id);
      if (res.data) {
        setConversationId(res.data.conversationId);
        setMessages(mapMessages(res.data.messages));
        setError(null);
      }
    } catch {
      // ignore
    }
  }, []);

  // Xóa 1 conversation cụ thể
  const removeConversation = useCallback(
    async (id) => {
      try {
        await deleteAiConversation(id);
        setConversations((prev) => prev.filter((c) => c._id !== id));
        // Nếu đang xem conversation bị xóa → reset về blank
        if (id === conversationId) {
          setMessages([]);
          setConversationId(null);
          setError(null);
        }
      } catch {
        // ignore
      }
    },
    [conversationId]
  );

  // Bắt đầu cuộc trò chuyện mới (reset state, không xóa cũ)
  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  // Gửi tin nhắn + nhận SSE stream
  const sendMessage = useCallback(
    async (text, context = {}) => {
      if (!text.trim() || isLoading || sendingRef.current) return;
      sendingRef.current = true;

      const userMsg = { 
        role: "user", 
        content: text.trim(), 
        image: context?.image || null, 
        timestamp: new Date().toISOString() 
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);
      setActiveTool(null);

      const assistantMsg = { role: "assistant", content: "", uiCards: [], timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        if (abortRef.current) {
          abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;
        pendingTextRef.current = "";
        displayedTextRef.current = "";
        startTypewriter();

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
                  if (event.content.includes("⚠️ Lỗi xử lý")) {
                    setMessages((prev) => {
                      const updated = [...prev];
                      const last = updated[updated.length - 1];
                      if (last?.role === "assistant") {
                        updated[updated.length - 1] = { ...last, isError: true };
                      }
                      return updated;
                    });
                  }
                  // Ném vào buffer để gõ từ từ
                  pendingTextRef.current += event.content;
                  break;

                case "tool_start":
                  setActiveTool(event.tool);
                  // Xóa sạch văn bản dở dang của Turn trước trên cả Buffer, State và UI
                  pendingTextRef.current = "";
                  displayedTextRef.current = "";
                  if (typeWriterIntervalRef.current) {
                    clearInterval(typeWriterIntervalRef.current);
                    typeWriterIntervalRef.current = null;
                  }
                  
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === "assistant") {
                      updated[updated.length - 1] = { ...last, content: "" };
                    }
                    return updated;
                  });

                  // Chạy lại Typewriter cho luồng văn bản mới
                  startTypewriter();
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
                  if (event.conversationId) {
                    const newId = event.conversationId;
                    setConversationId(newId);
                    // Refresh sidebar list
                    getAiConversations()
                      .then((r) => setConversations(r.data || []))
                      .catch(() => {});
                  }
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
        sendingRef.current = false;
        setActiveTool(null);
        abortRef.current = null;
        stopTypewriter();
      }
    },
    [conversationId, isLoading]
  );

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    sendingRef.current = false;
    setActiveTool(null);
    stopTypewriter();
  }, [stopTypewriter]);

  const retryLastMessage = useCallback(() => {
    setMessages((prev) => {
      const lastUserMsg = [...prev].reverse().find(m => m.role === "user");
      if (!lastUserMsg) return prev;
      
      // Xoá tin nhắn lỗi và tin nhắn user để tạo lại luồng mới
      const idx = prev.lastIndexOf(lastUserMsg);
      const newMessages = prev.slice(0, idx);

      // Async trigger send để nhường luồng React render state
      setTimeout(() => {
        sendMessage(lastUserMsg.content, { image: lastUserMsg.image });
      }, 10);
      
      return newMessages;
    });
  }, [sendMessage]);

  return {
    messages,
    isLoading,
    activeTool,
    error,
    conversationId,
    conversations,
    sendMessage,
    loadHistory,
    loadConversations,
    clearHistory,
    switchConversation,
    removeConversation,
    cancelRequest,
    retryLastMessage,
  };
}

