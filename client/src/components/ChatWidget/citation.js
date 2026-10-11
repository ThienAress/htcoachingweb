const PUBLISHERS_BY_HOST = [
  ["ods.od.nih.gov", "NIH ODS"],
  ["pubmed.ncbi.nlm.nih.gov", "PubMed"],
  ["nih.gov", "NIH"],
  ["bmj.com", "BMJ"],
  ["who.int", "WHO"],
  ["cdc.gov", "CDC"],
  ["jissn.biomedcentral.com", "JISSN"],
];

const GOOGLE_GROUNDING_ORIGIN = "https://vertexaisearch.cloud.google.com";
const GOOGLE_GROUNDING_PATH = "/grounding-api-redirect/";
const RESERVED_PUBLISHER_HOSTS = [
  "localhost",
  "local",
  "internal",
  "test",
  "invalid",
  "example",
  "home",
  "lan",
  "localdomain",
  "onion",
  "arpa",
  "corp",
  "example.com",
  "example.net",
  "example.org",
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

const hasUnsafeUrlCharacters = (value) => Array.from(value).some((character) => {
  const code = character.codePointAt(0);
  return code <= 32 || code === 127 || character === "\\";
});

const isGoogleGroundingRedirect = (uri) => {
  if (typeof uri !== "string" || hasUnsafeUrlCharacters(uri)) return false;
  try {
    const url = new URL(uri);
    if (
      url.origin !== GOOGLE_GROUNDING_ORIGIN ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith(GOOGLE_GROUNDING_PATH)
    ) return false;
    return /^[A-Za-z0-9_-]+={0,2}$/.test(
      url.pathname.slice(GOOGLE_GROUNDING_PATH.length),
    );
  } catch {
    return false;
  }
};

const isGoogleGroundingTransport = (uri) => {
  if (typeof uri !== "string" || hasUnsafeUrlCharacters(uri)) return false;
  try {
    const url = new URL(uri);
    return (
      url.origin === GOOGLE_GROUNDING_ORIGIN &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.pathname.startsWith("/grounding/") || url.pathname.startsWith(GOOGLE_GROUNDING_PATH))
    );
  } catch {
    return false;
  }
};

const isPublicPublisherHost = (value) => {
  const host = String(value || "").toLowerCase();
  if (
    host.length > 253 ||
    host === "localhost" ||
    !host.includes(".") ||
    RESERVED_PUBLISHER_HOSTS.some((reservedHost) =>
      host === reservedHost || host.endsWith(`.${reservedHost}`),
    )
  ) return false;

  const labels = host.split(".");
  return labels.every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
  ) && /[a-z]/i.test(labels.at(-1));
};

const getProvenancePublisherHost = (source) => {
  if (!isGoogleGroundingRedirect(source?.uri)) return null;
  const provenance = source?.provenance;
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) return null;
  if (provenance.kind !== "google_grounding_redirect") return null;
  if (typeof provenance.publisherHost !== "string") return null;
  const publisherHost = provenance.publisherHost.toLowerCase();
  return isPublicPublisherHost(publisherHost) ? publisherHost : null;
};

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
    const provenanceHost = getProvenancePublisherHost(source);
    const isUnresolvedRedirect = isGoogleGroundingTransport(source?.uri) && !provenanceHost;
    const publisher = isUnresolvedRedirect
      ? "Nguồn web"
      : getPublisher(provenanceHost || host);
    return {
      title,
      host,
      publisher,
      uri: url.href,
      avatar: isUnresolvedRedirect ? "globe" : "monogram",
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
