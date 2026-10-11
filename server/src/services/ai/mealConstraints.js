const EXCLUSION_DEFINITIONS = Object.freeze([
  {
    key: "chicken",
    aliases: ["gà", "thịt gà", "ức gà", "đùi gà", "chicken"],
  },
  {
    key: "egg",
    aliases: ["trứng", "trứng gà", "trứng vịt", "egg"],
  },
  {
    key: "milk",
    aliases: ["sữa", "sữa bò", "sữa tươi", "sữa chua", "whey", "whey protein", "milk"],
  },
  {
    key: "beef",
    aliases: ["bò", "thịt bò", "beef"],
  },
  {
    key: "peanut",
    aliases: ["đậu phộng", "lạc", "peanut"],
  },
  {
    key: "soy",
    aliases: ["đậu nành", "soy"],
  },
  {
    key: "tofu",
    aliases: ["đậu phụ", "đậu hũ", "tofu"],
  },
  {
    key: "fish",
    aliases: ["cá", "cá hồi", "cá ngừ", "cá lóc", "fish"],
  },
  {
    key: "vegetable",
    aliases: ["rau", "rau củ", "rau xanh", "bông cải", "vegetable"],
  },
]);

const lookupText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/gu, "d")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const phraseTokens = (value) => lookupText(value).split(" ").filter(Boolean);
const accentSensitiveTokens = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

const hasAccent = (value) => {
  const token = String(value || "");
  return token.normalize("NFD").replace(/\p{M}/gu, "") !== token || /đ/iu.test(token);
};

const containsPhrase = (label, phrase) => {
  const labelTokens = phraseTokens(label);
  const sensitiveLabelTokens = accentSensitiveTokens(label);
  const sensitivePhraseTokens = accentSensitiveTokens(phrase);
  const phraseTokensValue = phraseTokens(phrase);
  if (labelTokens.length === 0 || phraseTokensValue.length === 0) return false;
  if (phraseTokensValue.length > labelTokens.length) return false;
  for (let start = 0; start <= labelTokens.length - phraseTokensValue.length; start += 1) {
    if (phraseTokensValue.every((token, offset) => {
      const labelIndex = start + offset;
      const phraseToken = sensitivePhraseTokens[offset];
      const labelToken = sensitiveLabelTokens[labelIndex];
      if (
        hasAccent(phraseToken) &&
        hasAccent(labelToken) &&
        phraseToken !== labelToken
      ) return false;
      return labelTokens[labelIndex] === token;
    })) {
      return true;
    }
  }
  return false;
};

const canonicalDefinition = (value) => {
  const normalized = lookupText(value);
  return EXCLUSION_DEFINITIONS.find((definition) =>
    definition.aliases.some((alias) => lookupText(alias) === normalized),
  );
};

const splitExclusionValue = (value) => {
  const source = String(value || "");
  const clauses = [
    ...source.matchAll(
      /(?:không\s+(?:ăn|dùng|thêm|uống)|tránh|loại\s+bỏ|without|no)\s+([^.;!?]+)/giu,
    ),
  ].map((match) => match[1]);
  const candidates = clauses.length > 0 ? clauses : [source];
  return candidates
    .flatMap((candidate) =>
      candidate
        .split(/\s+(?:và|hoặc|and|or)\s+|[,;]+/iu),
    )
    .map((part) =>
      part
        .trim()
        .replace(/^(?:không\s+(?:ăn|dùng|thêm|uống)|tránh|loại\s+bỏ|without|no)\s+/iu, "")
        .trim(),
    )
    .filter(Boolean);
};

export const normalizeMealFoodPhrase = lookupText;

const parseMealConstraintItems = (values, { dedupeCanonical }) => {
  const rawValues = Array.isArray(values) ? values : [values];
  const items = [];
  const seen = new Set();

  for (const value of rawValues) {
    if (typeof value !== "string") continue;
    for (const part of splitExclusionValue(value)) {
      const phrase = lookupText(part);
      if (!phrase) continue;
      const definition = canonicalDefinition(phrase);
      const identity = dedupeCanonical && definition
        ? `key:${definition.key}`
        : `phrase:${phrase}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const item = {
        key: definition?.key || null,
        phrase,
        aliases: definition?.aliases || [phrase],
      };
      Object.defineProperty(item, "rawPhrase", {
        value: part,
        enumerable: false,
      });
      items.push(item);
    }
  }

  return {
    items,
    keys: items.filter((item) => item.key).map((item) => item.key),
    phrases: items.map((item) => item.phrase),
  };
};

export const parseMealExclusions = (values) =>
  parseMealConstraintItems(values, { dedupeCanonical: true });

export const parseMealRequirements = (values) => {
  const rawValues = Array.isArray(values) ? values : [values];
  return parseMealConstraintItems(
    rawValues.map((value) =>
      typeof value === "string"
        ? value.replace(/^\s*(?:với|with)\s+/iu, "")
        : value,
    ),
    { dedupeCanonical: false },
  );
};

export const foodMatchesMealExclusion = (food, exclusions) => {
  const label = food?.label || food?.name || "";
  return (exclusions?.items || []).some((item) =>
    (item.key ? item.aliases : [item.rawPhrase || item.phrase])
      .some((alias) => containsPhrase(label, alias)),
  );
};

export const foodMatchesMealPhrase = (food, phrase) => {
  const requestedId = phrase && typeof phrase === "object"
    ? phrase.foodId || phrase.id
    : null;
  const foodId = food?.foodId || food?._id || food?.id;
  if (requestedId) return Boolean(foodId) && String(requestedId) === String(foodId);
  const canonicalAlias = phrase && typeof phrase === "object" && phrase.key
    ? phrase.aliases?.find((alias) => lookupText(alias) === lookupText(phrase.phrase))
    : null;
  return containsPhrase(
    food?.label || food?.name || "",
    canonicalAlias || phrase?.rawPhrase || phrase?.phrase || phrase,
  );
};
