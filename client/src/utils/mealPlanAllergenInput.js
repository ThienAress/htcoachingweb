const DEFINITIONS = [
  ["crustacean_shellfish", "major", "Giáp xác", ["giáp xác", "tôm", "cua"]],
  ["tree_nut", "major", "Hạt cây", ["hạt cây", "hạt dinh dưỡng"]],
  ["peanut", "major", "Đậu phộng", ["đậu phộng", "lạc"]],
  ["wheat", "major", "Lúa mì", ["lúa mì"]],
  ["soy", "major", "Đậu nành", ["đậu nành"]],
  ["sesame", "major", "Mè", ["mè", "vừng"]],
  ["milk", "major", "Sữa", ["sữa"]],
  ["egg", "major", "Trứng", ["trứng"]],
  ["fish", "major", "Cá", ["cá"]],
  ["beef", "specific", "Bò", ["thịt bò", "bò"]],
  ["chicken", "specific", "Gà", ["thịt gà", "ức gà", "gà"]],
  ["pork", "specific", "Heo", ["thịt heo", "thịt lợn", "heo", "lợn"]],
  ["duck", "specific", "Vịt", ["thịt vịt", "vịt"]],
  ["goat", "specific", "Dê", ["thịt dê", "dê"]],
  ["lamb", "specific", "Cừu", ["thịt cừu", "cừu"]],
];

const GENERIC_MEAT_ALIASES = [
  "thịt",
  "các loại thịt",
  "tất cả loại thịt",
  "tất cả thịt trên cạn",
];
export const normalizeFoodCatalogLabel = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gu, "d")
    .replace(/\s+/gu, " ")
    .trim();
const lookupText = normalizeFoodCatalogLabel;
const displayText = (value) => {
  const normalized = String(value || "").normalize("NFKC").replace(/\s+/gu, " ").trim();
  return normalized ? normalized[0].toLocaleUpperCase("vi") + normalized.slice(1) : "";
};
const MATCHERS = [
  ...DEFINITIONS.flatMap(([key, kind, label, aliases]) =>
    aliases.map((alias) => ({ key, kind, label, alias: lookupText(alias) })),
  ),
  ...GENERIC_MEAT_ALIASES.map((alias) => ({
    key: null,
    kind: "generic_meat",
    label: "Thịt",
    alias: lookupText(alias),
  })),
].sort((left, right) => right.alias.split(" ").length - left.alias.split(" ").length);

const tokenizeKnownChunk = (chunk) => {
  const words = lookupText(chunk).split(" ").filter(Boolean);
  const items = [];
  let index = 0;
  while (index < words.length) {
    const match = MATCHERS.find(({ alias }) =>
      alias.split(" ").every((word, offset) => words[index + offset] === word),
    );
    if (!match) return null;
    items.push({ key: match.key, kind: match.kind, label: match.label });
    index += match.alias.split(" ").length;
  }
  return items;
};

const dedupeItems = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const identity = item.key
      ? `${item.kind}:${item.key}`
      : `${item.kind}:${lookupText(item.label)}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

export const analyzeOtherAllergenText = (value, foods = []) => {
  const normalized = String(value || "").normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return {
      canonicalText: "",
      items: [],
      majorKeys: [],
      specificKeys: [],
      catalogFoodLabels: [],
      hasUnmapped: false,
      errorCode: null,
    };
  }
  if (normalized.includes(".")) {
    return {
      canonicalText: normalized,
      items: [],
      majorKeys: [],
      specificKeys: [],
      catalogFoodLabels: [],
      hasUnmapped: false,
      errorCode: "period_separator",
    };
  }
  const catalogLabels = new Map(
    (Array.isArray(foods) ? foods : [])
      .map((food) => String(food?.label || food?.name || "").normalize("NFKC").replace(/\s+/gu, " ").trim())
      .filter(Boolean)
      .map((label) => [lookupText(label), label]),
  );
  const chunks = normalized.split(/[,;\n]+/u).map((item) => item.trim()).filter(Boolean);
  let hasGenericMeat = false;
  const parsed = chunks.flatMap((chunk) => {
    const known = tokenizeKnownChunk(chunk);
    if (!known) {
      const catalogLabel = catalogLabels.get(lookupText(chunk));
      return [{
        key: null,
        kind: catalogLabel ? "catalog_food" : "unmapped",
        label: catalogLabel || displayText(chunk),
      }];
    }
    if (known.some(({ kind }) => kind === "generic_meat")) hasGenericMeat = true;
    return known.filter(({ kind }) => kind !== "generic_meat");
  });
  const items = dedupeItems(parsed);
  return {
    canonicalText: items.map(({ label }) => label).join(", "),
    items,
    majorKeys: items.filter(({ kind }) => kind === "major").map(({ key }) => key),
    specificKeys: items.filter(({ kind }) => kind === "specific").map(({ key }) => key),
    catalogFoodLabels: items
      .filter(({ kind }) => kind === "catalog_food")
      .map(({ label }) => label),
    hasUnmapped: items.some(({ kind }) => kind === "unmapped"),
    errorCode: hasGenericMeat
      ? "generic_meat"
      : items.length > 8
        ? "too_many"
        : null,
  };
};
