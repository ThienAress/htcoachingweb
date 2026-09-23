const REDIRECT_HOST = "vertexaisearch.cloud.google.com";

const stripUnsafeDisplayCharacters = (value) =>
  Array.from(String(value || ""), (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127 || (codePoint >= 0x202a && codePoint <= 0x202e) || (codePoint >= 0x2066 && codePoint <= 0x2069)
      ? " "
      : character;
  }).join("");

const cleanTitle = (value) =>
  stripUnsafeDisplayCharacters(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

export const normalizeCitationSource = (source) => {
  try {
    const url = new URL(String(source?.uri || ""));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    let title = cleanTitle(source?.title);
    if (!title || !host) return null;

    // Older grounding payloads included the redirect host in the title. It is
    // transport metadata, not a useful publisher label.
    title = title
      .replace(new RegExp(`\\s*\\(${REDIRECT_HOST.replaceAll(".", "\\.")}\\)\\s*$`, "i"), "")
      .trim();
    const isGroundingRedirect = host === REDIRECT_HOST;
    if (isGroundingRedirect && (!title || title.toLowerCase() === REDIRECT_HOST)) {
      title = "Nguồn";
    }
    if (!title) return null;
    const visibleHost = isGroundingRedirect ? "" : host;
    const label = visibleHost && !title.toLowerCase().endsWith(` (${visibleHost})`)
      ? `${title} (${visibleHost})`
      : title;
    return {
      title: label,
      host: visibleHost,
      uri: url.href,
      monogram: Array.from(title.trim())[0]?.toUpperCase() || "•",
    };
  } catch {
    return null;
  }
};

export const getSafeCitationSources = (sources, max = 3) => {
  const seen = new Set();
  return (Array.isArray(sources) ? sources : [])
    .map(normalizeCitationSource)
    .filter((source) => {
      if (!source || seen.has(source.uri)) return false;
      seen.add(source.uri);
      return true;
    })
    .slice(0, max);
};
