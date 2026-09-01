const STORAGE_KEY = "redirectAfterLogin";
const SAFE_INTERNAL_PATH = /^\/(?![\\/])[^\s\\]*$/;

export const normalizeLoginRedirect = (value, fallback = "/") => {
  const path = typeof value === "string" ? value : "";
  return path.length <= 2048 && SAFE_INTERNAL_PATH.test(path)
    ? path
    : fallback;
};

export const rememberLoginRedirect = (
  value,
  storage = window.localStorage,
) => {
  const path = normalizeLoginRedirect(value, "");
  if (path) storage.setItem(STORAGE_KEY, path);
};

export const consumeLoginRedirect = (storage = window.localStorage) => {
  const path = normalizeLoginRedirect(storage.getItem(STORAGE_KEY));
  storage.removeItem(STORAGE_KEY);
  return path;
};
