const ROOT_FOLDER = "htcoaching";

export const resolveCloudinaryFolder = (folder) => {
  const normalized = String(folder || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (String(process.env.APP_ENV || "").toLowerCase() !== "staging") {
    return normalized;
  }

  if (!normalized || normalized === ROOT_FOLDER) {
    return `${ROOT_FOLDER}/staging`;
  }
  if (normalized.startsWith(`${ROOT_FOLDER}/staging/`)) {
    return normalized;
  }
  if (normalized.startsWith(`${ROOT_FOLDER}/`)) {
    return `${ROOT_FOLDER}/staging/${normalized.slice(ROOT_FOLDER.length + 1)}`;
  }
  return `${ROOT_FOLDER}/staging/${normalized}`;
};
