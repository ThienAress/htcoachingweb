import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteAiConversation,
  forkAiConversation,
  getAiConversationById,
  getAiConversations,
  getAiHistory,
  openAiChatStream,
} from "../services/ai.service";
import { createAiChatSessionRegistry } from "./aiChatSessionRegistry.js";

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

export function mergeEphemeralConfirmationCards(
  persistedMessages,
  localMessages,
  localAssistantId,
) {
  const ephemeralCards = (localMessages || [])
    .filter((message) => message.localId === localAssistantId)
    .flatMap((message) => message.uiCards || [])
    .filter((card) => card.cardType === "confirmation");
  if (ephemeralCards.length === 0) return persistedMessages;

  const targetIndex = [...persistedMessages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "assistant")?.index;
  if (targetIndex === undefined) return persistedMessages;

  return persistedMessages.map((message, index) =>
    index === targetIndex
      ? {
          ...message,
          uiCards: [...(message.uiCards || []), ...ephemeralCards],
        }
      : message,
  );
}

export default function useAiChat({ persistenceEnabled = true } = {}) {
  const registryRef = useRef(null);
  if (!registryRef.current) {
    registryRef.current = createAiChatSessionRegistry();
  }

  const [, setViewRevision] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [quota, setQuota] = useState(null);
  const mountedRef = useRef(true);
  const navigationSequenceRef = useRef(0);
  const conversationsLoadSequenceRef = useRef(0);
  const requestSequenceRef = useRef(0);
  const quotaSequenceRef = useRef(0);
  const messagesRef = useRef([]);
  const reconcileTimersRef = useRef(new Map());

  const refreshViews = useCallback(() => {
    if (mountedRef.current) setViewRevision((revision) => revision + 1);
  }, []);

  const updateView = useCallback(
    (key, updater) => {
      const next = registryRef.current.updateView(key, updater);
      refreshViews();
      return next;
    },
    [refreshViews],
  );

  const selectedView = registryRef.current.getSelectedView();
  const pendingConversationIds =
    registryRef.current.listPendingConversationIds();
  messagesRef.current = selectedView.messages;

  const clearSessionTimer = useCallback((session) => {
    if (session?.flushTimer) {
      clearInterval(session.flushTimer);
      session.flushTimer = null;
    }
  }, []);

  const flushPendingText = useCallback(
    (sessionId) => {
      const session = registryRef.current.getSession(sessionId);
      if (!session?.pendingText) return;
      session.displayedText += session.pendingText;
      session.pendingText = "";
      const content = session.displayedText;
      updateView(session.viewKey, (view) => ({
        messages: view.messages.map((message) =>
          message.localId === session.assistantLocalId
            ? { ...message, content }
            : message,
        ),
      }));
    },
    [updateView],
  );

  const scheduleReconcile = useCallback(
    (conversationId) => {
      if (!persistenceEnabled || !conversationId) return;
      const timers = reconcileTimersRef.current;
      clearTimeout(timers.get(conversationId));
      const timer = setTimeout(async () => {
        timers.delete(conversationId);
        if (
          !mountedRef.current ||
          registryRef.current.getSessionForView(conversationId)
        ) {
          return;
        }
        try {
          const response = await getAiConversationById(conversationId);
          if (
            mountedRef.current &&
            !registryRef.current.getSessionForView(conversationId) &&
            response.data
          ) {
            updateView(conversationId, {
              messages: mapAiMessages(response.data.messages),
              loaded: true,
            });
          }
        } catch {
          // The user can reload the conversation from the sidebar.
        }
      }, 180);
      timers.set(conversationId, timer);
    },
    [persistenceEnabled, updateView],
  );

  const stopSession = useCallback(
    (session, { flush = true, reconcile = true } = {}) => {
      if (!session) return;
      if (flush) flushPendingText(session.id);
      session.controller.abort();
      registryRef.current.removeSession(session.id);
      clearSessionTimer(session);
      updateView(session.viewKey, {
        isLoading: false,
        activeTool: null,
      });
      if (flush && reconcile) {
        scheduleReconcile(
          session.targetConversationId ||
            registryRef.current.getView(session.viewKey)?.conversationId,
        );
      }
    },
    [clearSessionTimer, flushPendingText, scheduleReconcile, updateView],
  );

  const cancelRequest = useCallback(
    (flush = true) => {
      const selectedKey = registryRef.current.getSelectedKey();
      stopSession(registryRef.current.getSessionForView(selectedKey), {
        flush,
        reconcile: flush,
      });
    },
    [stopSession],
  );

  useEffect(() => {
    mountedRef.current = true;
    const timers = reconcileTimersRef.current;
    const registry = registryRef.current;
    return () => {
      mountedRef.current = false;
      registry.listSessions().forEach((session) => {
        session.controller.abort();
        clearSessionTimer(session);
        registry.removeSession(session.id);
      });
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [clearSessionTimer]);

  useEffect(() => {
    setQuota(null);
    quotaSequenceRef.current = 0;
  }, [persistenceEnabled]);

  const applySessionQuota = useCallback((session, nextQuota) => {
    if (!nextQuota || session.requestSequence < quotaSequenceRef.current) {
      return;
    }
    quotaSequenceRef.current = session.requestSequence;
    if (mountedRef.current) setQuota(nextQuota);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!persistenceEnabled) return;
    const sequence = ++navigationSequenceRef.current;
    try {
      const response = await getAiHistory();
      const data = response.data;
      if (
        !mountedRef.current ||
        sequence !== navigationSequenceRef.current ||
        !data?.conversationId
      ) {
        return;
      }
      const key = registryRef.current.selectConversation(data.conversationId);
      registryRef.current.updateView(key, {
        messages: mapAiMessages(data.messages),
        loaded: true,
        error: null,
      });
      refreshViews();
    } catch {
      // Empty history is a valid state.
    }
  }, [persistenceEnabled, refreshViews]);

  const loadConversations = useCallback(async () => {
    if (!persistenceEnabled) return;
    const sequence = ++conversationsLoadSequenceRef.current;
    try {
      const response = await getAiConversations();
      if (
        mountedRef.current &&
        sequence === conversationsLoadSequenceRef.current
      ) {
        setConversations(response.data || []);
      }
    } catch {
      // The sidebar is non-critical.
    }
  }, [persistenceEnabled]);

  const switchConversation = useCallback(
    async (id) => {
      if (id === registryRef.current.getSelectedView().conversationId) return;
      navigationSequenceRef.current += 1;
      const key = registryRef.current.selectConversation(id);
      refreshViews();
      const localView = registryRef.current.getView(key);
      if (localView.loaded || registryRef.current.getSessionForView(key)) return;

      try {
        const response = await getAiConversationById(id);
        if (!mountedRef.current || !response.data) return;
        if (!registryRef.current.getSessionForView(key)) {
          updateView(key, {
            messages: mapAiMessages(response.data.messages),
            loaded: true,
            error: null,
          });
        }
      } catch {
        if (
          mountedRef.current &&
          !registryRef.current.getSessionForView(key)
        ) {
          updateView(key, { error: "Không thể tải cuộc trò chuyện" });
        }
      }
    },
    [refreshViews, updateView],
  );

  const removeConversation = useCallback(
    async (id) => {
      const session = registryRef.current.getSessionForView(id);
      if (session) stopSession(session, { flush: false, reconcile: false });
      try {
        await deleteAiConversation(id);
        if (!mountedRef.current) return;
        setConversations((previous) =>
          previous.filter((conversation) => conversation._id !== id),
        );
        registryRef.current.deleteView(id);
        navigationSequenceRef.current += 1;
        refreshViews();
      } catch (requestError) {
        const key = registryRef.current.getSelectedKey();
        updateView(key, {
          error:
            requestError.response?.data?.message ||
            "Không thể xóa cuộc trò chuyện",
        });
      }
    },
    [refreshViews, stopSession, updateView],
  );

  const clearHistory = useCallback(() => {
    navigationSequenceRef.current += 1;
    registryRef.current.selectNewConversation();
    refreshViews();
  }, [refreshViews]);

  const sendMessage = useCallback(
    async (text, context = {}, options = {}) => {
      const normalizedText =
        String(text || "").trim() ||
        (context.image ? "Hãy phân tích hình ảnh này." : "");
      if (!normalizedText) return;

      const registry = registryRef.current;
      const viewKey = registry.getSelectedKey();
      if (registry.getSessionForView(viewKey)) return;

      navigationSequenceRef.current += 1;
      const sessionId = crypto.randomUUID();
      const requestId = crypto.randomUUID();
      const assistantLocalId = `assistant-${sessionId}`;
      const selectedConversationId = registry.getSelectedView().conversationId;
      const targetConversationId =
        options.targetConversationId === undefined
          ? selectedConversationId
          : options.targetConversationId;
      const controller = new AbortController();
      const session = registry.registerSession({
        id: sessionId,
        controller,
        assistantLocalId,
        targetConversationId,
        viewKey,
        pendingText: "",
        displayedText: "",
        flushTimer: null,
        requestSequence: ++requestSequenceRef.current,
      });

      const timestamp = new Date().toISOString();
      updateView(viewKey, (view) => ({
        messages: [
          ...view.messages,
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
        ],
        isLoading: true,
        activeTool: null,
        error: null,
        loaded: true,
      }));
      session.flushTimer = setInterval(
        () => flushPendingText(sessionId),
        STREAM_FLUSH_MS,
      );

      const isActive = () =>
        mountedRef.current && Boolean(registry.getSession(sessionId));
      const assignConversation = (conversationId) => {
        if (!conversationId || !isActive()) return;
        registry.rekeySession(sessionId, conversationId);
        refreshViews();
      };

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
          applySessionQuota(session, data.meta?.quota);
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

            const activeSession = registry.getSession(sessionId);
            if (!activeSession) break;
            if (event.type === "quota") {
              applySessionQuota(activeSession, event.quota);
            } else if (event.type === "text") {
              activeSession.pendingText += String(event.content || "");
            } else if (event.type === "conversation") {
              assignConversation(event.conversationId);
              void loadConversations();
            } else if (event.type === "tool_start") {
              activeSession.pendingText = "";
              activeSession.displayedText = "";
              updateView(activeSession.viewKey, (view) => ({
                activeTool: event.tool,
                messages: view.messages.map((message) =>
                  message.localId === assistantLocalId
                    ? { ...message, content: "" }
                    : message,
                ),
              }));
            } else if (event.type === "tool_result") {
              updateView(activeSession.viewKey, { activeTool: null });
            } else if (event.type === "ui_card") {
              updateView(activeSession.viewKey, (view) => ({
                messages: view.messages.map((message) =>
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
              }));
            } else if (event.type === "error") {
              updateView(activeSession.viewKey, {
                error: event.message || "Có lỗi xảy ra",
              });
            } else if (event.type === "done") {
              flushPendingText(sessionId);
              assignConversation(event.conversationId);
              const completedSession = registry.getSession(sessionId);
              if (
                persistenceEnabled &&
                event.conversationId &&
                completedSession
              ) {
                const current = await getAiConversationById(
                  event.conversationId,
                );
                if (isActive() && current.data) {
                  const persistedMessages = mapAiMessages(
                    current.data.messages,
                  );
                  const localMessages = registry.getView(
                    completedSession.viewKey,
                  )?.messages;
                  updateView(completedSession.viewKey, {
                    messages: mergeEphemeralConfirmationCards(
                      persistedMessages,
                      localMessages,
                      completedSession.assistantLocalId,
                    ),
                    loaded: true,
                  });
                }
              }
              void loadConversations();
            }
          }
        }
      } catch (requestError) {
        const activeSession = registry.getSession(sessionId);
        if (requestError.name !== "AbortError" && activeSession) {
          updateView(activeSession.viewKey, (view) => ({
            error: requestError.message || "Không thể kết nối tới server",
            messages: view.messages.filter(
              (message) =>
                message.localId !== assistantLocalId ||
                message.content ||
                message.uiCards?.length,
            ),
          }));
        }
      } finally {
        const activeSession = registry.getSession(sessionId);
        if (activeSession) {
          flushPendingText(sessionId);
          registry.removeSession(sessionId);
          clearSessionTimer(activeSession);
          updateView(activeSession.viewKey, {
            isLoading: false,
            activeTool: null,
          });
        }
      }
    },
    [
      clearSessionTimer,
      applySessionQuota,
      flushPendingText,
      loadConversations,
      persistenceEnabled,
      refreshViews,
      updateView,
    ],
  );

  const branchAndSend = useCallback(
    async (messageId, text, context = {}) => {
      const sourceConversationId =
        registryRef.current.getSelectedView().conversationId;
      if (!sourceConversationId || !messageId) {
        clearHistory();
        return sendMessage(text, context, { targetConversationId: null });
      }

      try {
        const response = await forkAiConversation(
          sourceConversationId,
          messageId,
        );
        if (!response.data || !mountedRef.current) return;
        const key = registryRef.current.selectConversation(
          response.data.conversationId,
        );
        registryRef.current.updateView(key, {
          messages: mapAiMessages(response.data.messages),
          loaded: true,
          error: null,
        });
        refreshViews();
        await sendMessage(text, context, {
          targetConversationId: response.data.conversationId,
        });
      } catch (requestError) {
        const key = registryRef.current.getSelectedKey();
        updateView(key, {
          error:
            requestError.response?.data?.message ||
            "Không thể tạo nhánh cuộc trò chuyện",
        });
      }
    },
    [clearHistory, refreshViews, sendMessage, updateView],
  );

  const retryLastMessage = useCallback(
    (messageId) => {
      const target = messageId
        ? messagesRef.current.find((message) => message._id === messageId)
        : [...messagesRef.current]
            .reverse()
            .find((message) => message.role === "user");
      if (target) {
        void branchAndSend(target._id, target.content, { image: target.image });
      }
    },
    [branchAndSend],
  );

  const editMessage = useCallback(
    (messageId, newText) => {
      if (newText?.trim()) {
        void branchAndSend(messageId, newText.trim());
      }
    },
    [branchAndSend],
  );

  return {
    messages: selectedView.messages,
    isLoading: selectedView.isLoading,
    activeTool: selectedView.activeTool,
    error: selectedView.error,
    quota,
    conversationId: selectedView.conversationId,
    conversations,
    pendingConversationIds,
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
