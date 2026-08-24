export const CHECKIN_PAGE_SIZE_OPTIONS = [5, 10, 15];
export const CHECKIN_PAGE_SIZE_STORAGE_KEY =
  "htcoaching:trainer-checkin-history:page-size";

export const readCheckinPageSize = (storage = globalThis.localStorage) => {
  try {
    const value = Number(storage?.getItem(CHECKIN_PAGE_SIZE_STORAGE_KEY));
    return CHECKIN_PAGE_SIZE_OPTIONS.includes(value) ? value : 10;
  } catch {
    return 10;
  }
};

export const saveCheckinPageSize = (
  value,
  storage = globalThis.localStorage,
) => {
  const normalized = Number(value);
  if (!CHECKIN_PAGE_SIZE_OPTIONS.includes(normalized)) return false;
  try {
    storage?.setItem(CHECKIN_PAGE_SIZE_STORAGE_KEY, String(normalized));
    return true;
  } catch {
    return false;
  }
};
