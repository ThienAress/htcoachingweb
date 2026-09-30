export const getSculptFocusRestoreTarget = (trigger, documentObject = globalThis.document) => {
  if (!trigger?.isConnected) return null;

  const inertContainer = trigger.closest?.("[inert]");
  if (!inertContainer) return trigger;
  if (!inertContainer.id) return null;

  return Array.from(documentObject?.querySelectorAll?.("button[aria-controls]") || [])
    .find((button) =>
      button.isConnected
      && !button.closest?.("[inert]")
      && button.getAttribute("aria-controls") === inertContainer.id,
    ) || null;
};
