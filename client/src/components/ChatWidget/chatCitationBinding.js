const isWebSourcesCard = (card) => card?.cardType === "webSources";

// A persisted tool result can arrive before the assistant text it supports.
// Bind it only to the next assistant message before another user turn.
export const bindTurnCitationCards = (messages = []) => {
  const display = messages.map((message) => ({
    ...message,
    uiCards: [...(message.uiCards || [])],
  }));
  let pendingCards = [];
  let pendingOwner = null;

  const restorePending = () => {
    if (pendingOwner == null || pendingCards.length === 0) return;
    display[pendingOwner].uiCards.push(...pendingCards);
    pendingCards = [];
    pendingOwner = null;
  };

  for (let index = 0; index < display.length; index += 1) {
    const message = display[index];
    if (message.role === "user") {
      restorePending();
      continue;
    }
    const webSourceCards = message.uiCards.filter(isWebSourcesCard);
    if (message.role === "tool") {
      pendingCards.push(...webSourceCards);
      message.uiCards = message.uiCards.filter((card) => !isWebSourcesCard(card));
      continue;
    }
    if (message.role !== "assistant") continue;

    // mapAiMessages associates a persisted tool card with its preceding,
    // empty assistant tool-call placeholder. A card already attached to text
    // came from the live stream and is intentionally left in place.
    if (webSourceCards.length > 0 && !message.content) {
      pendingCards.push(...webSourceCards);
      pendingOwner = index;
      message.uiCards = message.uiCards.filter((card) => !isWebSourcesCard(card));
      continue;
    }
    if (pendingCards.length > 0 && message.content) {
      message.uiCards.push(...pendingCards);
      pendingCards = [];
      pendingOwner = null;
    }
  }
  restorePending();
  return display;
};
