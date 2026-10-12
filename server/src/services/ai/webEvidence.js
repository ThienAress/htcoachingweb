import { selectKnowledgeAnswerSegments } from "./knowledgeAnswerScope.js";

const PREFERRED_HOSTS = ["who.int", "cdc.gov", "nih.gov", "acsm.org", "uefa.com", "fifa.com", "olympics.com",
  "nba.com", "britannica.com", "espn.com", "mensfitness.com", "menshealth.com", "muscleandfitness.com"];
const hostnameMatches = (host, domain) => host === domain || host.endsWith(`.${domain}`);
const normalize = (value) => String(value || "").replace(/<[^>]*>/g, " ")
  .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
const escape = (value) => value.replace(/([\\[\]<>])/g, "\\$1");
const plainClaim = (value) => normalize(value)
  .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/(?:https?:\/\/|www\.)\S+/gi, "")
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
  .replace(/[\\[\]<>]/g, "").trim();

export function selectWebEvidence(body, query) {
  const results = body?.grounding?.generic;
  if (!Array.isArray(results)) return [];
  const seen = new Set();
  const requiredHost = /\bWHO\b|World Health Organization|Tổ chức Y tế Thế giới/iu.test(query) ? "who.int" : null;
  const selected = [];
  for (const result of results.slice(0, 10)) {
    if (typeof result?.url !== "string" || result.url.length > 2048 || !Array.isArray(result.snippets)) continue;
    try {
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /(?:^|\.)localhost$/i.test(url.hostname)) continue;
      if (requiredHost && !hostnameMatches(url.hostname, requiredHost)) continue;
      url.hash = "";
      if (seen.has(url.href)) continue;
      const snippets = result.snippets.filter((text) => typeof text === "string")
        .slice(0, 4).map((text) => normalize(text).slice(0, 2000)).filter((text) => text.length >= 24);
      if (!snippets.length) continue;
      seen.add(url.href);
      const title = normalize(result.title).slice(0, 120) || url.hostname;
      selected.push({ title: `${escape(title)} (${url.hostname})`, uri: url.href,
        snippets, preferred: PREFERRED_HOSTS.some((host) => hostnameMatches(url.hostname, host)) });
    } catch {
      continue;
    }
  }
  return selected.sort((a, b) => Number(b.preferred) - Number(a.preferred)).slice(0, 5)
    .map(({ preferred: _preferred, ...source }, index) => ({ ...source, id: `source_${index + 1}` }));
}

const MAX_SOURCES_PER_ANSWER = 3;
const MAX_GROUP_LENGTH = 40;

// The chat contract allows three distinct sources per answer. Pick the three that back the most
// facts (ties keep the earliest), and drop a fact only when none of its sources was chosen.
function chooseAnswerSources(selected) {
  const chosen = [];
  const covered = new Set();
  while (chosen.length < MAX_SOURCES_PER_ANSWER) {
    const gains = new Map();
    selected.forEach((segment, index) => {
      if (covered.has(index)) return;
      for (const source of segment.sources) {
        if (chosen.includes(source.uri)) continue;
        gains.set(source.uri, (gains.get(source.uri) || 0) + 1);
      }
    });
    let best = null;
    for (const [uri, gain] of gains) if (!best || gain > best.gain) best = { uri, gain };
    if (!best) break;
    chosen.push(best.uri);
    selected.forEach((segment, index) => {
      if (segment.sources.some((source) => source.uri === best.uri)) covered.add(index);
    });
  }
  return chosen;
}

// Facts that share a topic read as one paragraph; the sources of the paragraph close it.
// A lone group has no heading.
function renderGroupedAnswer(selected) {
  const allowed = new Set(chooseAnswerSources(selected));
  const usable = selected
    .map((segment) => ({ ...segment, sources: segment.sources.filter((source) => allowed.has(source.uri)) }))
    .filter((segment) => segment.sources.length > 0);
  const groups = [];
  for (const segment of usable) {
    const label = normalize(segment.group).slice(0, MAX_GROUP_LENGTH);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.segments.push(segment);
    else groups.push({ label, segments: [segment] });
  }
  const sources = [];
  const paragraphs = groups.map(({ label, segments }) => {
    const unique = [...new Map(segments.flatMap((segment) => segment.sources)
      .map((source) => [source.uri, source])).values()];
    const links = unique.map(({ title, uri }) => {
      if (!sources.some((source) => source.uri === uri)) sources.push({ title, uri });
      return `[${title}](<${uri}>)`;
    });
    const body = `${segments.map((segment) => segment.text).join(" ")} ${links.join(" ")}`;
    return groups.length > 1 && label ? `**${escape(label)}**\n\n${body}` : body;
  });
  return { text: paragraphs.join("\n\n"), sources };
}

export function buildCitedWebAnswer(answer, evidence, query) {
  if (!Array.isArray(answer?.segments) || answer.segments.length > 10) return { text: "", sources: [] };
  const validated = [];
  for (const segment of answer.segments) {
    if (typeof segment?.text !== "string" || segment.text.length > 800 ||
      !Array.isArray(segment.supports) || !segment.supports.length || segment.supports.length > 3) continue;
    const sources = [];
    const quotes = [];
    let valid = true;
    for (const support of segment.supports) {
      const source = evidence.find((item) => item.id === support?.sourceId);
      const quote = typeof support?.quote === "string" ? normalize(support.quote) : "";
      if (!source || quote.length < 24 || quote.length > 600 ||
        !source.snippets.some((snippet) => snippet.includes(quote))) {
        valid = false;
        break;
      }
      sources.push(source);
      quotes.push(quote);
    }
    const text = plainClaim(segment.text);
    const claimNumbers = text.match(/\d+(?:[.,]\d+)?/g) || [];
    const quoteNumbers = new Set(quotes.join(" ").match(/\d+(?:[.,]\d+)?/g) || []);
    if (valid && text && claimNumbers.every((number) => quoteNumbers.has(number))) {
      validated.push({ text, sources, group: typeof segment.group === "string" ? segment.group : "" });
    }
  }
  return renderGroupedAnswer(selectKnowledgeAnswerSegments(query, validated));
}
