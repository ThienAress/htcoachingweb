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
import {
  createAiChatStreamPacer,
  stopAiChatStreamSession,
} from "./aiChatStreamPacer.js";

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
          uiCards: [
            ...(message.uiCards || []),
            ...ephemeralCards.filter(
              (card) => !(message.uiCards || []).includes(card),
            ),
          ],
        }
      : message,
  );
}

function mergePersistedMessageIdentity(persistedMessages, localMessages) {
  const usedLocalIndexes = new Set();
  const localIndexByPersistedIndex = new Map();
  const merged = persistedMessages.map((persistedMessage, persistedIndex) => {
    let localIndex = localMessages.findIndex(
      (message, index) =>
        !usedLocalIndexes.has(index) &&
        message._id &&
        String(message._id) === String(persistedMessage._id),
    );
    if (localIndex < 0) {
      localIndex = localMessages.findIndex(
        (message, index) =>
          !usedLocalIndexes.has(index) &&
          !message._id &&
          message.role === persistedMessage.role &&
          message.content === persistedMessage.content &&
          (message.role !== "user" ||
            (message.image || null) === (persistedMessage.image || null)),
      );
    }
    if (
      localIndex < 0 &&
      persistedMessage.role === "assistant" &&
      persistedMessage.content
    ) {
      // Stop may persist a longer prefix; only reconcile within its user turn.
      const precedingUserIndex = persistedMessages.findLastIndex(
        (message, index) =>
          index < persistedIndex && message.role === "user",
      );
      const localUserIndex = localIndexByPersistedIndex.get(precedingUserIndex);
      if (localUserIndex !== undefined) {
        const nextLocalUserIndex = localMessages.findIndex(
          (message, index) =>
            index > localUserIndex && message.role === "user",
        );
        const turnEnd = nextLocalUserIndex < 0
          ? localMessages.length
          : nextLocalUserIndex;
        localIndex = localMessages.findIndex(
          (message, index) =>
            index > localUserIndex &&
            index < turnEnd &&
            !usedLocalIndexes.has(index) &&
            message.role === "assistant" &&
            Boolean(message.content) &&
            persistedMessage.content.startsWith(message.content),
        );
      }
    }
    if (localIndex < 0) return persistedMessage;

    usedLocalIndexes.add(localIndex);
    localIndexByPersistedIndex.set(persistedIndex, localIndex);
    const localMessage = localMessages[localIndex];
    return {
      ...persistedMessage,
      ...(localMessage.localId ? { localId: localMessage.localId } : {}),
    };
  });

  localMessages.forEach((message, index) => {
    if (!usedLocalIndexes.has(index)) merged.push(message);
  });
  return merged;
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
  const reconcileQueueRef = useRef(new Map());

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
    (sessionId, { drainAll = false } = {}) => {
      const session = registryRef.current.getSession(sessionId);
      if (!session) return;
      const nextText = drainAll
        ? session.streamPacer.takeAll()
        : session.streamPacer.takeNext();
      if (!nextText) return;
      session.displayedText += nextText;
      const content = session.displayedText;
      updateView(session.viewKey, (view) => ({
        messages: view.messages.map((message) =>
          message.localId === session.assistantLocalId
            ? { ...message, content }
            : message,
        ),
      }));
      if (!session.streamPacer.hasPending() && session.resolveDrain) {
        const resolveDrain = session.resolveDrain;
        session.resolveDrain = null;
        resolveDrain();
      }
    },
    [updateView],
  );

  const waitForPendingTextDrain = useCallback((sessionId) => {
    const session = registryRef.current.getSession(sessionId);
    if (!session?.streamPacer.hasPending()) return Promise.resolve();
    return new Promise((resolve) => {
      session.resolveDrain = resolve;
    });
  }, []);

  const reconcileConversation = useCallback(
    (conversationId, viewKey, assistantLocalId = null) => {
      if (!persistenceEnabled || !conversationId || !viewKey) {
        return Promise.resolve(null);
      }
      const queue = reconcileQueueRef.current;
      const previous = queue.get(conversationId);
      if (
        previous &&
        (!assistantLocalId || previous.assistantLocalId === assistantLocalId)
      ) {
        return previous.promise;
      }
      const generation = (previous?.generation || 0) + 1;

      if (registryRef.current.getView(viewKey)) {
        updateView(viewKey, { isReconciling: true });
      }
      let reconcile;
      reconcile = (async () => {
        if (previous) {
          await previous.promise.catch(() => null);
        }
        const retryDelays = [0, 120, 280];
        let latestMessages = null;
        for (const delay of retryDelays) {
          if (delay) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          if (!mountedRef.current || !registryRef.current.getView(viewKey)) {
            return null;
          }
          try {
            const response = await getAiConversationById(conversationId);
            if (!response.data || !registryRef.current.getView(viewKey)) {
              continue;
            }
            const localMessages =
              registryRef.current.getView(viewKey)?.messages || [];
            const persistedMessages = mergePersistedMessageIdentity(
              mapAiMessages(response.data.messages),
              localMessages,
            );
            const messages = assistantLocalId
              ? mergeEphemeralConfirmationCards(
                  persistedMessages,
                  localMessages,
                  assistantLocalId,
                )
              : persistedMessages;
            latestMessages = messages;
            updateView(viewKey, {
              messages,
              loaded: true,
            });
            const targetAssistant = assistantLocalId
              ? messages.find(
                  (message) => message.localId === assistantLocalId,
                )
              : null;
            if (
              !assistantLocalId ||
              !targetAssistant ||
              targetAssistant._id != null
            ) {
              return messages;
            }
          } catch {
            // A stopped stream can take a moment to finalize on the server.
          }
        }
        return latestMessages;
      })().finally(() => {
        const current = queue.get(conversationId);
        if (
          current?.generation === generation &&
          current.promise === reconcile
        ) {
          queue.delete(conversationId);
          if (registryRef.current.getView(viewKey)) {
            updateView(viewKey, { isReconciling: false });
          }
        }
      });
      queue.set(conversationId, {
        generation,
        assistantLocalId,
        promise: reconcile,
      });
      return reconcile;
    },
    [persistenceEnabled, updateView],
  );

  const stopSession = useCallback(
    (session, { flush = true, outcome = "cancelled", reconcile = true } = {}) => {
      if (!session) return;
      const pendingText = stopAiChatStreamSession(session, {
        drainPending: flush,
      });
      if (pendingText) {
        session.displayedText += pendingText;
        const content = session.displayedText;
        updateView(session.viewKey, (view) => ({
          messages: view.messages.map((message) =>
            message.localId === session.assistantLocalId
              ? { ...message, content }
              : message,
          ),
        }));
      }
      const viewKey = session.viewKey;
      const conversationId =
        session.targetConversationId ||
        registryRef.current.getView(viewKey)?.conversationId;
      registryRef.current.removeSession(session.id);
      clearSessionTimer(session);
      updateView(viewKey, {
        isLoading: false,
        activeTool: null,
        terminalOutcome: outcome,
      });
      if (reconcile) {
        void reconcileConversation(
          conversationId,
          viewKey,
          session.assistantLocalId,
        );
      }
    },
    [clearSessionTimer, reconcileConversation, updateView],
  );

  const cancelRequest = useCallback(
    () => {
      const selectedKey = registryRef.current.getSelectedKey();
      stopSession(registryRef.current.getSessionForView(selectedKey), {
        flush: true,
      });
    },
    [stopSession],
  );

  useEffect(() => {
    mountedRef.current = true;
    const registry = registryRef.current;
    return () => {
      mountedRef.current = false;
      registry.listSessions().forEach((session) => {
        stopSession(session, { flush: false, reconcile: false });
      });
    };
  }, [stopSession]);

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
      if (session) {
        stopSession(session, { flush: false, reconcile: false });
      }
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

  const updateMessageFeedback = useCallback(
    (conversationId, messageId, feedback) => {
      const key = String(conversationId || "");
      const view = registryRef.current.getView(key);
      if (!view || !messageId) return;
      updateView(key, (current) => ({
        messages: current.messages.map((message) =>
          message._id === messageId
            ? { ...message, feedback: feedback || null }
            : message,
        ),
      }));
    },
    [updateView],
  );

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
      const userLocalId = `user-${sessionId}`;
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
        userLocalId,
        assistantLocalId,
        targetConversationId,
        viewKey,
        streamPacer: createAiChatStreamPacer(),
        displayedText: "",
        flushTimer: null,
        resolveDrain: null,
        networkComplete: false,
        serverErrorReceived: false,
        requestSequence: ++requestSequenceRef.current,
      });

      const timestamp = new Date().toISOString();
      updateView(viewKey, (view) => {
        const failedUserIndex = view.terminalOutcome === "error" &&
          view.retryableFailedLocalId &&
          targetConversationId === view.conversationId
          ? view.messages.findIndex(
              (message) =>
                message.localId === view.retryableFailedLocalId &&
                message.role === "user" &&
                !message._id,
            )
          : -1;
        const lastUserIndex = view.messages.findLastIndex(
          (message) => message.role === "user",
        );
        const previousMessages = failedUserIndex >= 0 &&
          failedUserIndex === lastUserIndex
          ? view.messages.slice(0, failedUserIndex)
          : view.messages;
        return {
          messages: [
            ...previousMessages,
            {
              localId: userLocalId,
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
          terminalOutcome: null,
          retryableFailedLocalId: null,
          isReconciling: false,
          loaded: true,
        };
      });
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
          if (done) {
            const activeSession = registry.getSession(sessionId);
            if (
              activeSession &&
              !activeSession.networkComplete &&
              !activeSession.serverErrorReceived
            ) {
              flushPendingText(sessionId, { drainAll: true });
              throw new Error(
                "Câu trả lời chưa hoàn tất do kết nối bị gián đoạn. Vui lòng gửi lại câu hỏi để thử lại.",
              );
            }
            break;
          }
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
              activeSession.streamPacer.append(event.content);
            } else if (event.type === "conversation") {
              assignConversation(event.conversationId);
              void loadConversations();
            } else if (event.type === "tool_start") {
              activeSession.streamPacer.cancel();
              activeSession.streamPacer = createAiChatStreamPacer();
              activeSession.displayedText = "";
              updateView(activeSession.viewKey, (view) => ({
                activeTool: event.tool || "processing",
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
              activeSession.serverErrorReceived = true;
              activeSession.terminalOutcome = "error";
              updateView(activeSession.viewKey, {
                error: event.message || "Có lỗi xảy ra",
                terminalOutcome: "error",
                retryableFailedLocalId:
                  event.retryable === true ? activeSession.userLocalId : null,
              });
            } else if (event.type === "done") {
              activeSession.networkComplete = true;
              activeSession.terminalOutcome = "completed";
              activeSession.streamPacer.markComplete();
              flushPendingText(sessionId);
              assignConversation(event.conversationId);
              await waitForPendingTextDrain(sessionId);
              const completedSession = registry.getSession(sessionId);
              if (completedSession) {
                updateView(completedSession.viewKey, {
                  terminalOutcome: "completed",
                });
                void reconcileConversation(
                  event.conversationId,
                  completedSession.viewKey,
                  completedSession.assistantLocalId,
                );
              }
              void loadConversations();
            }
          }
        }
      } catch (requestError) {
        const activeSession = registry.getSession(sessionId);
        if (requestError.name !== "AbortError" && activeSession) {
          activeSession.terminalOutcome = "error";
          updateView(activeSession.viewKey, (view) => ({
            error: requestError.message || "Không thể kết nối tới server",
            terminalOutcome: "error",
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
          if (!activeSession.networkComplete) {
            flushPendingText(sessionId, { drainAll: true });
          }
          registry.removeSession(sessionId);
          clearSessionTimer(activeSession);
          updateView(activeSession.viewKey, {
            isLoading: false,
            activeTool: null,
            terminalOutcome:
              activeSession.terminalOutcome ||
              (activeSession.networkComplete ? "completed" : "error"),
          });
          if (!activeSession.networkComplete) {
            void reconcileConversation(
              activeSession.targetConversationId ||
                registry.getView(activeSession.viewKey)?.conversationId,
              activeSession.viewKey,
              activeSession.serverErrorReceived
                ? null
                : activeSession.assistantLocalId,
            );
          }
        }
      }
    },
    [
      clearSessionTimer,
      applySessionQuota,
      flushPendingText,
      loadConversations,
      refreshViews,
      reconcileConversation,
      updateView,
      waitForPendingTextDrain,
    ],
  );

  const branchAndSend = useCallback(
    async (messageId, text, context = {}, sourceMessage = null) => {
      const sourceViewKey = registryRef.current.getSelectedKey();
      const sourceNavigationSequence = navigationSequenceRef.current;
      const sourceConversationId =
        registryRef.current.getSelectedView().conversationId;
      const sourceIsActive = () =>
        mountedRef.current &&
        navigationSequenceRef.current === sourceNavigationSequence &&
        registryRef.current.getSelectedKey() === sourceViewKey &&
        Boolean(registryRef.current.getView(sourceViewKey));
      if (!sourceConversationId) {
        clearHistory();
        return sendMessage(text, context, { targetConversationId: null });
      }

      let resolvedMessageId = messageId;
      if (!resolvedMessageId) {
        const messages = await reconcileConversation(
          sourceConversationId,
          sourceViewKey,
        );
        if (
          !sourceIsActive() ||
          !messages
        ) {
          return;
        }
        const resolved = sourceMessage?.localId
          ? messages.find(
              (message) => message.localId === sourceMessage.localId,
            )
          : [...messages]
              .reverse()
              .find(
                (message) =>
                  message.role === "user" &&
                  message.content === sourceMessage?.content,
              );
        resolvedMessageId = resolved?._id;
      }
      if (!resolvedMessageId) {
        const view = registryRef.current.getView(sourceViewKey);
        const lastUser = [...(view?.messages || [])]
          .reverse()
          .find((message) => message.role === "user");
        if (
          view?.terminalOutcome === "error" &&
          sourceMessage?.localId &&
          view.retryableFailedLocalId === sourceMessage.localId &&
          lastUser?.localId === sourceMessage.localId &&
          !registryRef.current.getSessionForView(sourceViewKey)
        ) {
          updateView(sourceViewKey, (current) => ({
            messages: current.messages.slice(
              0,
              current.messages.findIndex(
                (message) => message.localId === sourceMessage.localId,
              ),
            ),
            retryableFailedLocalId: null,
          }));
          await sendMessage(text, context, {
            targetConversationId: sourceConversationId,
          });
          return;
        }
        updateView(sourceViewKey, {
          error:
            "Tin nhắn chưa đồng bộ xong. Vui lòng chờ một chút rồi thử lại.",
        });
        return;
      }

      try {
        const response = await forkAiConversation(
          sourceConversationId,
          resolvedMessageId,
        );
        if (
          !response.data ||
          !sourceIsActive()
        ) {
          return;
        }
        navigationSequenceRef.current += 1;
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
        if (!sourceIsActive()) {
          return;
        }
        updateView(sourceViewKey, {
          error:
            requestError.response?.data?.message ||
            "Không thể tạo nhánh cuộc trò chuyện",
        });
      }
    },
    [
      clearHistory,
      reconcileConversation,
      refreshViews,
      sendMessage,
      updateView,
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
        void branchAndSend(
          target._id,
          target.content,
          { image: target.image },
          target,
        );
      }
    },
    [branchAndSend],
  );

  const editMessage = useCallback(
    (messageId, newText) => {
      if (newText?.trim()) {
        const sourceMessage = messageId
          ? messagesRef.current.find((message) => message._id === messageId)
          : [...messagesRef.current]
              .reverse()
              .find((message) => message.role === "user" && !message._id);
        void branchAndSend(messageId, newText.trim(), {}, sourceMessage);
      }
    },
    [branchAndSend],
  );

  return {
    messages: selectedView.messages,
    isLoading: selectedView.isLoading,
    activeTool: selectedView.activeTool,
    error: selectedView.error,
    terminalOutcome: selectedView.terminalOutcome || null,
    isReconciling: Boolean(selectedView.isReconciling),
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
    updateMessageFeedback,
  };
}
