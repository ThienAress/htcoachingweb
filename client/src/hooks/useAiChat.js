import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteAiConversation,
  forkAiConversation,
  getAiConversationById,
  getAiConversations,
  getAiHistory,
  openAiChatStream,
} from "../services/ai.service";

const STREAM_FLUSH_MS = 80;

export function mapAiMessages(rawMessages = []) {
  const result = [];
  for (const message of rawMessages) {
    if (message.role === "user") {
      result.push({
        _id: message._id,
        role: "user",
        content: message.content || "",
        image: message.image || null,
        timestamp: message.timestamp,
      });
    } else if (message.role === "assistant") {
      result.push({
        _id: message._id,
        role: "assistant",
        content: message.content || "",
        feedback: message.feedback || null,
        uiCards: [],
        timestamp: message.timestamp,
      });
    } else if (message.role === "tool" && message.uiCard) {
      const lastAssistant = [...result]
        .reverse()
        .find((item) => item.role === "assistant");
      if (lastAssistant) lastAssistant.uiCards.push(message.uiCard);
    }
  }
  return result;
}

export default function useAiChat({ persistenceEnabled = true } = {}) {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState(null);

  const mountedRef = useRef(true);
  const messagesRef = useRef([]);
  const conversationIdRef = useRef(null);
  const activeSessionRef = useRef(null);
  const navigationSequenceRef = useRef(0);
  const sendingRef = useRef(false);
  const flushTimerRef = useRef(null);
  const reconcileTimerRef = useRef(null);
  const pendingTextRef = useRef("");
  const displayedTextRef = useRef("");

  const setCurrentConversationId = useCallback((value) => {
    conversationIdRef.current = value;
    if (mountedRef.current) setConversationId(value);
  }, []);

  const setCurrentMessages = useCallback((valueOrUpdater) => {
    if (!mountedRef.current) return;
    setMessages((previous) => {
      const next =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(previous)
          : valueOrUpdater;
      messagesRef.current = next;
      return next;
    });
  }, []);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flushPendingText = useCallback(
    (sessionId) => {
      const session = activeSessionRef.current;
      if (!session || session.id !== sessionId || !pendingTextRef.current) return;
      displayedTextRef.current += pendingTextRef.current;
      pendingTextRef.current = "";
      const content = displayedTextRef.current;
      setCurrentMessages((previous) =>
        previous.map((message) =>
          message.localId === session.assistantLocalId
            ? { ...message, content }
            : message,
        ),
      );
    },
    [setCurrentMessages],
  );

  const startFlushTimer = useCallback(
    (sessionId) => {
      clearFlushTimer();
      flushTimerRef.current = setInterval(
        () => flushPendingText(sessionId),
        STREAM_FLUSH_MS,
      );
    },
    [clearFlushTimer, flushPendingText],
  );

  const cancelRequest = useCallback(
    (flush = true) => {
      const session = activeSessionRef.current;
      if (session && flush) flushPendingText(session.id);
      session?.controller.abort();
      activeSessionRef.current = null;
      clearFlushTimer();
      pendingTextRef.current = "";
      displayedTextRef.current = "";
      sendingRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
        setActiveTool(null);
      }
      if (persistenceEnabled && flush && session) {
        const expectedConversationId =
          conversationIdRef.current || session.targetConversationId;
        const expectedNavigation = navigationSequenceRef.current;
        clearTimeout(reconcileTimerRef.current);
        reconcileTimerRef.current = setTimeout(async () => {
          if (
            !expectedConversationId ||
            !mountedRef.current ||
            activeSessionRef.current ||
            navigationSequenceRef.current !== expectedNavigation ||
            conversationIdRef.current !== expectedConversationId
          ) {
            return;
          }
          try {
            const response = await getAiConversationById(expectedConversationId);
            if (
              mountedRef.current &&
              !activeSessionRef.current &&
              navigationSequenceRef.current === expectedNavigation
            ) {
              setCurrentMessages(mapAiMessages(response.data?.messages));
            }
          } catch {
            // The user can still reload this conversation from the sidebar.
          }
        }, 180);
      }
    },
    [
      clearFlushTimer,
      flushPendingText,
      persistenceEnabled,
      setCurrentMessages,
    ],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeSessionRef.current?.controller.abort();
      activeSessionRef.current = null;
      sendingRef.current = false;
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setQuota(null);
  }, [persistenceEnabled]);

  const loadHistory = useCallback(async () => {
    if (!persistenceEnabled) return;
    const sequence = ++navigationSequenceRef.current;
    try {
      const response = await getAiHistory();
      if (!mountedRef.current || sequence !== navigationSequenceRef.current) return;
      if (response.data) {
        setCurrentConversationId(response.data.conversationId);
        setCurrentMessages(mapAiMessages(response.data.messages));
      }
    } catch {
      // Empty history is a valid state.
    }
  }, [persistenceEnabled, setCurrentConversationId, setCurrentMessages]);

  const loadConversations = useCallback(async () => {
    if (!persistenceEnabled) return;
    try {
      const response = await getAiConversations();
      if (mountedRef.current) setConversations(response.data || []);
    } catch {
      // The sidebar is non-critical.
    }
  }, [persistenceEnabled]);

  const switchConversation = useCallback(
    async (id) => {
      if (id === conversationIdRef.current) return;
      cancelRequest(false);
      clearTimeout(reconcileTimerRef.current);
      const sequence = ++navigationSequenceRef.current;
      try {
        const response = await getAiConversationById(id);
        if (!mountedRef.current || sequence !== navigationSequenceRef.current) return;
        if (response.data) {
          setCurrentConversationId(response.data.conversationId);
          setCurrentMessages(mapAiMessages(response.data.messages));
          setError(null);
        }
      } catch {
        if (mountedRef.current) setError("Không thể tải cuộc trò chuyện");
      }
    },
    [cancelRequest, setCurrentConversationId, setCurrentMessages],
  );

  const removeConversation = useCallback(
    async (id) => {
      if (id === conversationIdRef.current) cancelRequest(false);
      try {
        await deleteAiConversation(id);
        if (!mountedRef.current) return;
        setConversations((previous) =>
          previous.filter((conversation) => conversation._id !== id),
        );
        if (id === conversationIdRef.current) {
          setCurrentConversationId(null);
          setCurrentMessages([]);
          setError(null);
        }
      } catch (requestError) {
        if (mountedRef.current) {
          setError(
            requestError.response?.data?.message ||
              "Không thể xóa cuộc trò chuyện",
          );
        }
      }
    },
    [cancelRequest, setCurrentConversationId, setCurrentMessages],
  );

  const clearHistory = useCallback(() => {
    cancelRequest(false);
    navigationSequenceRef.current += 1;
    setCurrentConversationId(null);
    setCurrentMessages([]);
    setError(null);
  }, [cancelRequest, setCurrentConversationId, setCurrentMessages]);

  const sendMessage = useCallback(
    async (text, context = {}, options = {}) => {
      const normalizedText =
        String(text || "").trim() ||
        (context.image ? "Hãy phân tích hình ảnh này." : "");
      if (!normalizedText || sendingRef.current) return;

      cancelRequest(false);
      navigationSequenceRef.current += 1;
      sendingRef.current = true;
      const sessionId = crypto.randomUUID();
      const requestId = crypto.randomUUID();
      const assistantLocalId = `assistant-${sessionId}`;
      const targetConversationId =
        options.targetConversationId === undefined
          ? conversationIdRef.current
          : options.targetConversationId;
      const controller = new AbortController();
      activeSessionRef.current = {
        id: sessionId,
        controller,
        assistantLocalId,
        targetConversationId,
      };
      pendingTextRef.current = "";
      displayedTextRef.current = "";

      const timestamp = new Date().toISOString();
      setCurrentMessages((previous) => [
        ...previous,
        {
          localId: `user-${sessionId}`,
          role: "user",
          content: normalizedText,
          image: context.image || null,
          timestamp,
        },
        {
          localId: assistantLocalId,
          role: "assistant",
          content: "",
          uiCards: [],
          timestamp,
        },
      ]);
      setIsLoading(true);
      setError(null);
      setActiveTool(null);
      startFlushTimer(sessionId);

      const isActive = () =>
        mountedRef.current && activeSessionRef.current?.id === sessionId;

      try {
        const response = await openAiChatStream(
          {
            message: normalizedText,
            conversationId: targetConversationId,
            requestId,
            context,
          },
          { signal: controller.signal },
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data.meta?.quota && mountedRef.current) setQuota(data.meta.quota);
          throw new Error(data.message || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (isActive()) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const rawEvent of events) {
            if (!isActive() || !rawEvent.startsWith("data: ")) continue;
            let event;
            try {
              event = JSON.parse(rawEvent.slice(6));
            } catch {
              continue;
            }

            if (event.type === "quota") {
              if (event.quota && isActive()) setQuota(event.quota);
            } else if (event.type === "text") {
              pendingTextRef.current += String(event.content || "");
            } else if (event.type === "conversation") {
              if (event.conversationId) setCurrentConversationId(event.conversationId);
            } else if (event.type === "tool_start") {
              pendingTextRef.current = "";
              displayedTextRef.current = "";
              setActiveTool(event.tool);
              setCurrentMessages((previous) =>
                previous.map((message) =>
                  message.localId === assistantLocalId
                    ? { ...message, content: "" }
                    : message,
                ),
              );
            } else if (event.type === "tool_result") {
              setActiveTool(null);
            } else if (event.type === "ui_card") {
              setCurrentMessages((previous) =>
                previous.map((message) =>
                  message.localId === assistantLocalId
                    ? {
                        ...message,
                        uiCards: [
                          ...(message.uiCards || []),
                          { cardType: event.cardType, data: event.data },
                        ],
                      }
                    : message,
                ),
              );
            } else if (event.type === "error") {
              setError(event.message || "Có lỗi xảy ra");
            } else if (event.type === "done") {
              flushPendingText(sessionId);
              if (event.conversationId) setCurrentConversationId(event.conversationId);
              if (persistenceEnabled && event.conversationId) {
                const current = await getAiConversationById(event.conversationId);
                if (isActive() && current.data) {
                  setCurrentMessages(mapAiMessages(current.data.messages));
                }
              }
              loadConversations();
            }
          }
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError" && isActive()) {
          setError(requestError.message || "Không thể kết nối tới server");
          setCurrentMessages((previous) =>
            previous.filter(
              (message) =>
                message.localId !== assistantLocalId ||
                message.content ||
                message.uiCards?.length,
            ),
          );
        }
      } finally {
        if (activeSessionRef.current?.id === sessionId) {
          flushPendingText(sessionId);
          activeSessionRef.current = null;
          clearFlushTimer();
          pendingTextRef.current = "";
          displayedTextRef.current = "";
          sendingRef.current = false;
          if (mountedRef.current) {
            setIsLoading(false);
            setActiveTool(null);
          }
        }
      }
    },
    [
      cancelRequest,
      clearFlushTimer,
      flushPendingText,
      loadConversations,
      persistenceEnabled,
      setCurrentConversationId,
      setCurrentMessages,
      startFlushTimer,
    ],
  );

  const branchAndSend = useCallback(
    async (messageId, text, context = {}) => {
      const sourceConversationId = conversationIdRef.current;
      if (!sourceConversationId || !messageId) {
        clearHistory();
        return sendMessage(text, context, { targetConversationId: null });
      }

      cancelRequest(false);
      try {
        const response = await forkAiConversation(
          sourceConversationId,
          messageId,
        );
        if (!response.data || !mountedRef.current) return;
        setCurrentConversationId(response.data.conversationId);
        setCurrentMessages(mapAiMessages(response.data.messages));
        await sendMessage(text, context, {
          targetConversationId: response.data.conversationId,
        });
      } catch (requestError) {
        if (mountedRef.current) {
          setError(
            requestError.response?.data?.message ||
              "Không thể tạo nhánh cuộc trò chuyện",
          );
        }
      }
    },
    [
      cancelRequest,
      clearHistory,
      sendMessage,
      setCurrentConversationId,
      setCurrentMessages,
    ],
  );

  const retryLastMessage = useCallback(
    (messageId) => {
      const target = messageId
        ? messagesRef.current.find((message) => message._id === messageId)
        : [...messagesRef.current]
            .reverse()
            .find((message) => message.role === "user");
      if (target) {
        branchAndSend(target._id, target.content, { image: target.image });
      }
    },
    [branchAndSend],
  );

  const editMessage = useCallback(
    (messageId, newText) => {
      if (newText?.trim()) branchAndSend(messageId, newText.trim());
    },
    [branchAndSend],
  );

  return {
    messages,
    isLoading,
    activeTool,
    error,
    quota,
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
    editMessage,
  };
}
