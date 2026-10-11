// Shared cap for KB selection; shorter caller deadlines and cancellation still apply.
export const KNOWLEDGE_SELECTION_TIMEOUT_MS = 30_000;

// Chat prefers a prompt answer over waiting on a slow upstream selector: a selection
// that exceeds this budget degrades to a KB miss instead of failing the turn.
export const CHAT_KNOWLEDGE_SELECTION_TIMEOUT_MS = 12_000;
