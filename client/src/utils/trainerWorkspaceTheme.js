export const TRAINER_WORKSPACE_THEME_STORAGE_KEY =
  "ht_trainer_workspace_theme_v1";

const VALID_TRAINER_WORKSPACE_THEMES = new Set(["light", "dark"]);

const resolveStorage = (storage) => storage ?? globalThis.localStorage;

export const resolveInitialTrainerWorkspaceTheme = (storage) => {
  try {
    const savedTheme = resolveStorage(storage)?.getItem(
      TRAINER_WORKSPACE_THEME_STORAGE_KEY,
    );
    return VALID_TRAINER_WORKSPACE_THEMES.has(savedTheme)
      ? savedTheme
      : "light";
  } catch {
    return "light";
  }
};

export const persistTrainerWorkspaceTheme = (theme, storage) => {
  if (!VALID_TRAINER_WORKSPACE_THEMES.has(theme)) return;

  try {
    resolveStorage(storage)?.setItem(
      TRAINER_WORKSPACE_THEME_STORAGE_KEY,
      theme,
    );
  } catch {
    // Keep the in-memory theme when storage is unavailable.
  }
};
