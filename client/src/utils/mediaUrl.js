export const getServerBaseUrl = (
  apiUrl = import.meta.env.VITE_API_URL || "",
) => apiUrl.replace(/\/api\/?$/, "");

export const resolveMediaUrl = (
  mediaUrl,
  apiUrl = import.meta.env.VITE_API_URL || "",
) => {
  if (!mediaUrl) return "";

  if (/^(?:https?:)?\/\//i.test(mediaUrl) || mediaUrl.startsWith("blob:")) {
    return mediaUrl;
  }

  if (mediaUrl.startsWith("/")) {
    return `${getServerBaseUrl(apiUrl)}${mediaUrl}`;
  }

  return mediaUrl;
};
