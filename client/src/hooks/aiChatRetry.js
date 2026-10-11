export function resolveAiChatRetry({ view, target }) {
  if (!target || target.role !== "user") return null;
  const failed = view?.retryableFailedTurn;
  if (failed?.userLocalId && failed.userLocalId === target.localId) {
    return {
      mode: "same_conversation",
      conversationId: view.conversationId || null,
      failedUserLocalId: failed.userLocalId,
      failedAssistantLocalId: failed.assistantLocalId,
    };
  }
  return { mode: "fork", messageId: target._id || null };
}
