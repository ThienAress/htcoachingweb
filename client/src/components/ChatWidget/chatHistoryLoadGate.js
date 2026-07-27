export function createChatHistoryLoadGate() {
  let loadedUserId = null;

  return {
    shouldLoad(userId) {
      const normalizedUserId = String(userId || "").trim();
      if (!normalizedUserId || normalizedUserId === loadedUserId) return false;

      loadedUserId = normalizedUserId;
      return true;
    },
  };
}
