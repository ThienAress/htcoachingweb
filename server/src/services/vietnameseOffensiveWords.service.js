import { readFileSync } from "node:fs";

const SNAPSHOT_URL = new URL(
  "../data/moderation/vietnamese-offensive-words/vn_offensive_words.txt",
  import.meta.url,
);

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

const parseTerms = (content) => [
  ...new Set(
    String(content || "")
      .split(/\r?\n/)
      .map(normalizeText)
      .filter((line) => line && !line.startsWith("#")),
  ),
];

const escapePattern = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Giữ các từ đã được HTCOACHING chặn trước khi vendor snapshot upstream.
const PROJECT_SUPPLEMENTAL_TERMS = ["dit me", "du ma", "du me", "vkl", "shit"];
const REVIEWED_SHORT_ASCII_TERMS = new Set([
  "dm",
  "dcm",
  "dit",
  "deo",
  "loz",
  "vcl",
  "vkl",
]);

const isUsableTerm = (term) =>
  !/^[a-z0-9]{1,3}$/i.test(term) || REVIEWED_SHORT_ASCII_TERMS.has(term);

export const vietnameseOffensiveTerms = Object.freeze(
  [
    ...new Set([
      ...parseTerms(readFileSync(SNAPSHOT_URL, "utf8")),
      ...PROJECT_SUPPLEMENTAL_TERMS,
    ].filter(isUsableTerm)),
  ],
);

const OFFENSIVE_TERM_PATTERN = new RegExp(
  `(^|[^\\p{L}\\p{N}])(?:${vietnameseOffensiveTerms
    .slice()
    .sort((left, right) => right.length - left.length)
    .map(escapePattern)
    .join("|")})(?=$|[^\\p{L}\\p{N}])`,
  "iu",
);

export const containsVietnameseOffensiveTerm = (value) =>
  OFFENSIVE_TERM_PATTERN.test(normalizeText(value));
