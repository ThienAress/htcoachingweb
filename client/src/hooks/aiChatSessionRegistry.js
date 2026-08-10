const createView = ({ key, conversationId = null, loaded = false } = {}) => ({
  key,
  conversationId,
  loaded,
  messages: [],
  isLoading: false,
  activeTool: null,
  error: null,
});

const defaultCreateKey = () => `new-${crypto.randomUUID()}`;

export const createAiChatSessionRegistry = ({
  createKey = defaultCreateKey,
} = {}) => {
  const views = new Map();
  const sessions = new Map();
  const sessionByViewKey = new Map();

  const createNewView = () => {
    const key = createKey();
    views.set(key, createView({ key }));
    return key;
  };

  let selectedKey = createNewView();

  const ensureConversationView = (conversationId) => {
    const key = String(conversationId || "");
    if (!key) throw new Error("conversationId is required");
    if (!views.has(key)) {
      views.set(
        key,
        createView({ key, conversationId: key }),
      );
    }
    return key;
  };

  const updateView = (key, updater) => {
    const current = views.get(key);
    if (!current) throw new Error(`Unknown AI chat view: ${key}`);
    const next = typeof updater === "function" ? updater(current) : updater;
    views.set(key, { ...current, ...next, key });
    return views.get(key);
  };

  const selectConversation = (conversationId) => {
    const key = ensureConversationView(conversationId);
    selectedKey = key;
    return key;
  };

  const selectNewConversation = () => {
    selectedKey = createNewView();
    return selectedKey;
  };

  const registerSession = (session) => {
    if (!session?.id || !views.has(session.viewKey)) {
      throw new Error("AI chat session requires a known view and id");
    }
    if (sessionByViewKey.has(session.viewKey)) {
      throw new Error("An AI chat session is already active for this view");
    }
    sessions.set(session.id, session);
    sessionByViewKey.set(session.viewKey, session.id);
    return session;
  };

  const removeSession = (sessionId) => {
    const session = sessions.get(sessionId);
    if (!session) return null;
    sessions.delete(sessionId);
    if (sessionByViewKey.get(session.viewKey) === sessionId) {
      sessionByViewKey.delete(session.viewKey);
    }
    return session;
  };

  const rekeySession = (sessionId, conversationId) => {
    const session = sessions.get(sessionId);
    if (!session) return null;
    const nextKey = String(conversationId || "");
    if (!nextKey || nextKey === session.viewKey) {
      if (nextKey) {
        updateView(session.viewKey, { conversationId: nextKey });
      }
      return session;
    }

    const previousKey = session.viewKey;
    const previousView = views.get(previousKey);
    if (!previousView) throw new Error(`Unknown AI chat view: ${previousKey}`);

    const existingView = views.get(nextKey);
    views.set(nextKey, {
      ...(existingView || createView({ key: nextKey })),
      ...previousView,
      key: nextKey,
      conversationId: nextKey,
    });
    views.delete(previousKey);
    sessionByViewKey.delete(previousKey);
    session.viewKey = nextKey;
    session.targetConversationId = nextKey;
    sessionByViewKey.set(nextKey, sessionId);
    if (selectedKey === previousKey) selectedKey = nextKey;
    return session;
  };

  const deleteView = (key) => {
    if (sessionByViewKey.has(key)) {
      throw new Error("Cannot delete an AI chat view with an active session");
    }
    views.delete(key);
    if (selectedKey === key) selectedKey = createNewView();
    return selectedKey;
  };

  const listPendingConversationIds = () => {
    const conversationIds = new Set();
    for (const session of sessions.values()) {
      const conversationId = views.get(session.viewKey)?.conversationId;
      if (conversationId) conversationIds.add(String(conversationId));
    }
    return [...conversationIds];
  };

  return {
    getSelectedKey: () => selectedKey,
    getSelectedView: () => views.get(selectedKey),
    getView: (key) => views.get(key) || null,
    getSession: (sessionId) => sessions.get(sessionId) || null,
    getSessionForView: (key) => {
      const sessionId = sessionByViewKey.get(key);
      return sessionId ? sessions.get(sessionId) || null : null;
    },
    listSessions: () => [...sessions.values()],
    listPendingConversationIds,
    updateView,
    selectConversation,
    selectNewConversation,
    registerSession,
    removeSession,
    rekeySession,
    deleteView,
  };
};
