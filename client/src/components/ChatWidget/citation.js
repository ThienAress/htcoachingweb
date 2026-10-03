const PUBLISHERS_BY_HOST = [
  ["ods.od.nih.gov", "NIH ODS"],
  ["pubmed.ncbi.nlm.nih.gov", "PubMed"],
  ["nih.gov", "NIH"],
  ["who.int", "WHO"],
  ["cdc.gov", "CDC"],
  ["jissn.biomedcentral.com", "JISSN"],
];

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

const getPublisher = (host) =>
  PUBLISHERS_BY_HOST.find(([knownHost]) => host === knownHost || host.endsWith(`.${knownHost}`))?.[1] || host;

export const normalizeCitationUri = (value) => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
};

export const normalizeCitationSource = (source) => {
  try {
    const uri = normalizeCitationUri(source?.uri);
    if (!uri) return null;
    const url = new URL(uri);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    let title = cleanTitle(source?.title);
    if (!title || !host) return null;

    // Grounding metadata can append its redirect host to a title. Preserve a
    // concise tooltip, while deriving the visible identity from the link URL.
    title = title
      .replace(/\s*\([^)]*vertexaisearch\.cloud\.google\.com[^)]*\)\s*$/i, "")
      .trim();
    if (!title) return null;
    const publisher = getPublisher(host);
    return {
      title,
      host,
      publisher,
      uri: url.href,
      monogram: Array.from(publisher)[0]?.toUpperCase() || "•",
    };
  } catch {
    return null;
  }
};

export const getSafeCitationSources = (sources, max = 3) => {
  const seen = new Set();
  const limit = Math.min(Math.max(Number(max) || 0, 0), 3);
  return (Array.isArray(sources) ? sources : [])
    .map(normalizeCitationSource)
    .filter((source) => {
      if (!source || seen.has(source.uri)) return false;
      seen.add(source.uri);
      return true;
    })
    .slice(0, limit);
};

// Only collapse the disclosure for a conservative subset of inline links.
// Complex/reference Markdown keeps the disclosure instead of assuming a chip
// rendered merely because a URL occurs in text, an image, or a code block.
export const getInlineCitationUris = (value) => {
  if (/<!--|<\/?[a-z][a-z0-9-]*(?:\s|>)/i.test(String(value || ""))) return new Set();
  const text = String(value || "")
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*(?:\n|$)|$(?![\s\S]))/gm, "")
    .replace(/(`+)[\s\S]*?\1/g, "")
    .replace(/^(?: {4}|\t).*$/gm, "");
  const uris = new Set();
  for (const match of text.matchAll(/(?<![!\\])\[[^[\]\n]*\]\(<?(https:\/\/[^\s)>]+)>?\)/g)) {
    const uri = normalizeCitationUri(match[1]);
    if (uri) uris.add(uri);
  }
  return uris;
};
