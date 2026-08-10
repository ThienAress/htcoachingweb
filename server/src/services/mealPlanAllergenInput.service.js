import {
  MEAL_PLAN_OTHER_ALLERGEN_TEXT,
} from "../constants/mealPlanPreferences.js";

const DEFINITIONS = [
  { key: "crustacean_shellfish", kind: "major", label: "Giáp xác", aliases: ["giáp xác", "tôm", "cua"] },
  { key: "tree_nut", kind: "major", label: "Hạt cây", aliases: ["hạt cây", "hạt dinh dưỡng"] },
  { key: "peanut", kind: "major", label: "Đậu phộng", aliases: ["đậu phộng", "lạc"] },
  { key: "wheat", kind: "major", label: "Lúa mì", aliases: ["lúa mì"] },
  { key: "soy", kind: "major", label: "Đậu nành", aliases: ["đậu nành"] },
  { key: "sesame", kind: "major", label: "Mè", aliases: ["mè", "vừng"] },
  { key: "milk", kind: "major", label: "Sữa", aliases: ["sữa"] },
  { key: "egg", kind: "major", label: "Trứng", aliases: ["trứng"] },
  { key: "fish", kind: "major", label: "Cá", aliases: ["cá"] },
  { key: "beef", kind: "specific", label: "Bò", aliases: ["thịt bò", "bò"] },
  { key: "chicken", kind: "specific", label: "Gà", aliases: ["thịt gà", "gà"] },
  { key: "pork", kind: "specific", label: "Heo", aliases: ["thịt heo", "thịt lợn", "heo", "lợn"] },
  { key: "duck", kind: "specific", label: "Vịt", aliases: ["thịt vịt", "vịt"] },
  { key: "goat", kind: "specific", label: "Dê", aliases: ["thịt dê", "dê"] },
  { key: "lamb", kind: "specific", label: "Cừu", aliases: ["thịt cừu", "cừu"] },
];

const GENERIC_MEAT_ALIASES = [
  "thịt",
  "các loại thịt",
  "tất cả loại thịt",
  "tất cả thịt trên cạn",
];

const lookupText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

const displayText = (value) => {
  const normalized = String(value || "").normalize("NFKC").replace(/\s+/gu, " ").trim();
  return normalized ? normalized[0].toLocaleUpperCase("vi") + normalized.slice(1) : "";
};

const MATCHERS = [
  ...DEFINITIONS.flatMap((definition) =>
    definition.aliases.map((alias) => ({
      ...definition,
      alias: lookupText(alias),
    })),
  ),
  ...GENERIC_MEAT_ALIASES.map((alias) => ({
    key: null,
    kind: "generic_meat",
    label: "Thịt",
    alias: lookupText(alias),
  })),
].sort((left, right) => right.alias.split(" ").length - left.alias.split(" ").length);

const parseError = (code, message) =>
  Object.assign(new Error(message), { code, statusCode: 400 });

const tokenizeKnownChunk = (chunk) => {
  const words = lookupText(chunk).split(" ").filter(Boolean);
  const items = [];
  let index = 0;
  while (index < words.length) {
    const match = MATCHERS.find(({ alias }) => {
      const aliasWords = alias.split(" ");
      return aliasWords.every((word, offset) => words[index + offset] === word);
    });
    if (!match) return null;
    items.push({ key: match.key, kind: match.kind, label: match.label });
    index += match.alias.split(" ").length;
  }
  return items;
};

const dedupeItems = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const identity = item.key ? `${item.kind}:${item.key}` : `unmapped:${lookupText(item.label)}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

export const parseOtherAllergenText = (value) => {
  const normalized = String(value || "").normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return {
      canonicalText: "",
      items: [],
      majorKeys: [],
      specificKeys: [],
      hasUnmapped: false,
    };
  }
  if (normalized.includes(".")) {
    throw parseError(
      "MEAL_PLAN_OTHER_ALLERGEN_PERIOD_SEPARATOR",
      "Không dùng dấu chấm giữa các thực phẩm; hãy dùng dấu phẩy hoặc khoảng trắng",
    );
  }

  const chunks = normalized.split(/[,;\n]+/u).map((item) => item.trim()).filter(Boolean);
  const parsedItems = chunks.flatMap((chunk) => {
    const known = tokenizeKnownChunk(chunk);
    if (!known) return [{ key: null, kind: "unmapped", label: displayText(chunk) }];
    if (known.some(({ kind }) => kind === "generic_meat")) {
      throw parseError(
        "MEAL_PLAN_OTHER_ALLERGEN_TOO_GENERIC",
        "Hãy nhập rõ loại thịt như gà, bò hoặc heo",
      );
    }
    return known;
  });
  const items = dedupeItems(parsedItems);
  if (items.length > MEAL_PLAN_OTHER_ALLERGEN_TEXT.maxItems) {
    throw parseError(
      "MEAL_PLAN_OTHER_ALLERGEN_TOO_MANY",
      `Chỉ nhập tối đa ${MEAL_PLAN_OTHER_ALLERGEN_TEXT.maxItems} thực phẩm`,
    );
  }
  const majorKeys = items.filter(({ kind }) => kind === "major").map(({ key }) => key);
  const specificKeys = items
    .filter(({ kind }) => kind === "specific")
    .map(({ key }) => key);
  return {
    canonicalText: items.map(({ label }) => label).join(", "),
    items,
    majorKeys,
    specificKeys,
    hasUnmapped: items.some(({ kind }) => kind === "unmapped"),
  };
};
