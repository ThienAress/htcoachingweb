export const CHUNK_RECOVERY_SESSION_KEY =
  "htcoaching:stale-chunk-recovery-attempted";

const STALE_DYNAMIC_IMPORT_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk [^ ]+ failed/i,
  /unable to preload css/i,
];

export const isStaleDynamicImportError = (error) => {
  const message = String(error?.message || error || "");
  return STALE_DYNAMIC_IMPORT_PATTERNS.some((pattern) => pattern.test(message));
};

export const recoverStaleDynamicImport = (
  error,
  {
    storage = globalThis.window?.sessionStorage,
    reload = () => globalThis.window?.location.reload(),
  } = {},
) => {
  if (!isStaleDynamicImportError(error) || !storage) return false;

  try {
    if (storage.getItem(CHUNK_RECOVERY_SESSION_KEY) === "1") return false;
    storage.setItem(CHUNK_RECOVERY_SESSION_KEY, "1");
    reload();
    return true;
  } catch {
    return false;
  }
};
