export const FOOD_PRICE_DEFER_REASON = Object.freeze({
  INSUFFICIENT_RETAILERS: "INSUFFICIENT_RETAILERS",
  RAW_COOKED_MISMATCH: "RAW_COOKED_MISMATCH",
  UNIT_CONVERSION_UNSAFE: "UNIT_CONVERSION_UNSAFE",
  PRODUCT_FORM_MISMATCH: "PRODUCT_FORM_MISMATCH",
});

const DEFER_REASONS = new Set(Object.values(FOOD_PRICE_DEFER_REASON));
const PROCESSED_FORM_MARKERS = Object.freeze([
  "cô đặc",
  "đóng hộp",
  "nước ép",
  "sấy khô",
  "snack",
  "sốt",
  "xốt",
]);

const TEXT_SYNONYMS = Object.freeze([
  ["lợn", "heo"],
  ["đậu hũ", "đậu phụ"],
  ["cá lóc", "cá quả"],
  ["ngô", "bắp"],
  ["vừng", "mè"],
  ["lạc", "đậu phộng"],
]);

export const normalizeFoodResearchText = (value) =>
  TEXT_SYNONYMS.reduce(
    (text, [from, to]) => text.replaceAll(` ${from} `, ` ${to} `),
    ` ${String(value || "")
      .normalize("NFC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()} `,
  )
    .toLowerCase()
    .trim();

const parsePositiveDecimal = (value) => {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const parsePackGrams = (name, canonical, uomName) => {
  const text = String(`${canonical || ""} ${name || ""}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.,]+/g, " ")
    .trim();
  const unit = normalizeFoodResearchText(uomName);

  if (/\b(ml|lit|liter|litre)\b/.test(text)) return null;
  if (/\b\d+\s*(qua|trai|vien|cai)\b/.test(text) && !/\b\d+(?:[.,]\d+)?\s*(g|gr|gram|kg)\b/.test(text)) {
    return null;
  }
  if (/\b\d+\s*(hop|goi|chai|lo|hu|tui)\s*x\s*\d+/i.test(text)) {
    return null;
  }
  if (/\b(?:thung|loc|combo)\b/.test(text) && /\b\d+\s*(?:hop|goi|chai|lo|hu|tui)\b/.test(text)) {
    return null;
  }
  if (/\b(?:[2-9]|[1-9]\d+)\s*(?:hop|goi|chai|lo|hu|tui|thanh|cay)\b/.test(text)) {
    return null;
  }

  const weights = [...text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gram)\b/g)]
    .map((match) => {
      const value = parsePositiveDecimal(match[1]);
      return value ? Math.round(value * (match[2] === "kg" ? 1_000 : 1)) : null;
    })
    .filter(Boolean);
  const uniqueWeights = [...new Set(weights)];
  if (uniqueWeights.length > 1) return null;
  if (uniqueWeights.length === 1) return uniqueWeights[0];

  return /^(kg|kilogram)$/.test(unit) || /\bkg\b/.test(text) ? 1_000 : null;
};

const labelAliases = (foodLabel) => {
  const outside = normalizeFoodResearchText(foodLabel.replace(/\([^)]*\)/g, " "));
  const inside = [...String(foodLabel).matchAll(/\(([^)]*)\)/g)]
    .flatMap((match) => match[1].split(/[,/]/))
    .map((value) => normalizeFoodResearchText(value))
    .filter((value) => value.split(" ").length > 1);
  return [outside, ...inside].filter(Boolean);
};

const includesPhrase = (text, phrase) =>
  ` ${text} `.includes(` ${phrase} `);

const hasRawCookedMismatch = (foodLabel, candidateName) => {
  const label = normalizeFoodResearchText(foodLabel);
  const candidate = normalizeFoodResearchText(candidateName);
  if (includesPhrase(label, "cơm") && includesPhrase(candidate, "gạo")) return true;
  if (includesPhrase(label, "chín") && !includesPhrase(candidate, "chín")) return true;
  if (includesPhrase(label, "luộc") && !includesPhrase(candidate, "luộc")) return true;
  if (includesPhrase(label, "nướng") && !includesPhrase(candidate, "nướng")) return true;
  if (includesPhrase(label, "hầm") && !includesPhrase(candidate, "hầm")) return true;
  return false;
};

export const assessRetailCandidate = (foodLabel, candidate) => {
  const candidateName = normalizeFoodResearchText(candidate?.name);
  const hasExpectedPhrase = labelAliases(foodLabel).some((alias) =>
    includesPhrase(candidateName, alias),
  );

  if (hasRawCookedMismatch(foodLabel, candidate?.name)) {
    return {
      accepted: false,
      reason: FOOD_PRICE_DEFER_REASON.RAW_COOKED_MISMATCH,
    };
  }
  if (!hasExpectedPhrase) {
    return {
      accepted: false,
      reason: FOOD_PRICE_DEFER_REASON.PRODUCT_FORM_MISMATCH,
    };
  }

  const normalizedLabel = normalizeFoodResearchText(foodLabel);
  const unexpectedProcessedForm = PROCESSED_FORM_MARKERS.find(
    (marker) => candidateName.includes(marker) && !normalizedLabel.includes(marker),
  );
  if (unexpectedProcessedForm) {
    return {
      accepted: false,
      reason: FOOD_PRICE_DEFER_REASON.PRODUCT_FORM_MISMATCH,
    };
  }

  const packGrams = parsePackGrams(
    candidate?.name,
    candidate?.canonical,
    candidate?.uomName,
  );
  if (!packGrams) {
    return {
      accepted: false,
      reason: FOOD_PRICE_DEFER_REASON.UNIT_CONVERSION_UNSAFE,
    };
  }
  return { accepted: true, packGrams };
};

export const buildCatalogCoverageLedger = ({
  productionLabels,
  pricedLabels,
  deferred,
}) => {
  const production = new Set(productionLabels || []);
  const priced = new Set(pricedLabels || []);
  const deferredLabels = new Set();

  for (const item of deferred || []) {
    if (!DEFER_REASONS.has(item.reason)) {
      throw new Error(`CATALOG_PRICE_DEFER_REASON_INVALID:${item.foodLabel}`);
    }
    if (deferredLabels.has(item.foodLabel)) {
      throw new Error(`CATALOG_PRICE_CLASSIFICATION_DUPLICATE:${item.foodLabel}`);
    }
    deferredLabels.add(item.foodLabel);
  }

  for (const label of priced) {
    if (!production.has(label)) {
      throw new Error(`CATALOG_PRICE_CLASSIFICATION_UNKNOWN:${label}`);
    }
    if (deferredLabels.has(label)) {
      throw new Error(`CATALOG_PRICE_CLASSIFICATION_OVERLAP:${label}`);
    }
  }
  for (const label of deferredLabels) {
    if (!production.has(label)) {
      throw new Error(`CATALOG_PRICE_CLASSIFICATION_UNKNOWN:${label}`);
    }
  }

  const missing = [...production].filter(
    (label) => !priced.has(label) && !deferredLabels.has(label),
  );
  if (missing.length > 0) {
    throw new Error(`CATALOG_PRICE_CLASSIFICATION_MISSING:${missing.join(",")}`);
  }
  return {
    total: production.size,
    priced: priced.size,
    deferred: deferredLabels.size,
  };
};
