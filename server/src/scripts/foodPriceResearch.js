import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  FOOD_PRICE_DEFER_REASON,
  assessRetailCandidate,
  buildCatalogCoverageLedger,
  normalizeFoodResearchText,
} from "./foodPriceResearch.contract.js";

const PRODUCTION_FOODS_URL =
  "https://htcoachingweb.onrender.com/api/foods?all=true";
const BHX_SEARCH_URL =
  "https://api.bachhoaxanh.com/gw/search/v2/DataSearch";
const COOP_SEARCH_URL =
  "https://discovery.tekoapis.com/api/v2/search-skus-v2";
const BHX_STORE = Object.freeze({ provinceId: 3, storeId: 2272 });
const COOP_TERMINAL_ID = 26607;
const OBSERVED_AT = "2026-08-11T00:00:00.000Z";
const LOCAL_RESEARCH_OUTPUT = fileURLToPath(
  new URL("../../../.local-data/food-price-research-2026-08-11.json", import.meta.url),
);

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}:${url}`);
  return response.json();
};

const getProductionLabels = async () => {
  const payload = await fetchJson(PRODUCTION_FOODS_URL);
  return [...new Set((payload.data || []).map(({ label }) => label))];
};

const getBhxCandidates = async (foodLabel, apiKey) => {
  const payload = await fetchJson(BHX_SEARCH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
      platform: "webnew",
      reversehost: "http://bhxapi.live",
      xapikey: apiKey,
    },
    body: JSON.stringify({
      keywords: foodLabel,
      ...BHX_STORE,
      pageIndex: 0,
      pageSize: 20,
      sortStr: "",
    }),
  });
  return payload.data?.products || [];
};

const getCoopCandidates = async (foodLabel) => {
  const payload = await fetchJson(COOP_SEARCH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "vi",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      terminalId: COOP_TERMINAL_ID,
      query: foodLabel,
      page: 1,
      pageSize: 24,
      returnFilterable: [],
    }),
  });
  return payload.data?.products || [];
};

const productWords = (value) =>
  normalizeFoodResearchText(value)
    .replace(/\b\d+(?:\s*\d+)?\s*(?:g|gr|gram|kg)\b/g, " ")
    .replace(
      /\b(?:bach hoa xanh|coop select|tnx|khay|tui|goi|hop|hu|chai|lo|loai|l1|tuoi)\b/g,
      " ",
    )
    .split(" ")
    .filter(Boolean);

const scoreCandidate = (foodLabel, candidateName) => {
  const expected = productWords(foodLabel);
  const actual = productWords(candidateName);
  const extra = actual.filter((word) => !expected.includes(word)).length;
  const missing = expected.filter((word) => !actual.includes(word)).length;
  const startsExact = normalizeFoodResearchText(candidateName).startsWith(
    normalizeFoodResearchText(foodLabel),
  );
  return missing * 1_000 + extra * 10 - (startsExact ? 1 : 0);
};

const pickCandidate = (foodLabel, candidates, adapt) => {
  const reviewed = candidates.map((raw) => {
    const candidate = adapt(raw);
    return {
      ...candidate,
      assessment: assessRetailCandidate(foodLabel, candidate),
      score: scoreCandidate(foodLabel, candidate.name),
    };
  });
  const accepted = reviewed
    .filter(({ assessment }) => assessment.accepted)
    .sort((left, right) => left.score - right.score)[0];
  return { accepted: accepted || null, reviewed };
};

const adaptBhx = (product) => {
  const price = product.productPrices?.[0] || {};
  return {
    name: product.name,
    canonical: product.canonical,
    uomName: product.canonical,
    regularPriceVnd: Math.round(Number(price.sysPrice || price.price || 0)),
    promotionalPriceVnd:
      Number(price.price) > 0 && Number(price.price) < Number(price.sysPrice)
        ? Math.round(Number(price.price))
        : null,
    sourceUrl: `https://www.bachhoaxanh.com${product.url || ""}`,
  };
};

const adaptCoop = (product) => ({
  name: product.name,
  canonical: product.canonical,
  uomName: product.uomName,
  regularPriceVnd: Math.round(Number(product.supplierRetailPrice || 0)),
  promotionalPriceVnd:
    Number(product.latestPrice) > 0 &&
    Number(product.latestPrice) < Number(product.supplierRetailPrice)
      ? Math.round(Number(product.latestPrice))
      : null,
  sourceUrl: `https://cooponline.vn/${product.canonical || ""}`,
});

const toObservation = (foodLabel, sourceKey, candidate) => ({
  foodLabel,
  sourceKey,
  packGrams: candidate.assessment.packGrams,
  regularPriceVnd: candidate.regularPriceVnd,
  promotionalPriceVnd: candidate.promotionalPriceVnd,
  sourceUrl: candidate.sourceUrl,
  observedAt: OBSERVED_AT,
});

const reasonFromReviews = (reviews) => {
  const reasons = reviews.flatMap(({ reviewed }) =>
    reviewed.map(({ assessment }) => assessment.reason).filter(Boolean),
  );
  return (
    [
      FOOD_PRICE_DEFER_REASON.RAW_COOKED_MISMATCH,
      FOOD_PRICE_DEFER_REASON.UNIT_CONVERSION_UNSAFE,
      FOOD_PRICE_DEFER_REASON.PRODUCT_FORM_MISMATCH,
    ].find((reason) => reasons.includes(reason)) ||
    FOOD_PRICE_DEFER_REASON.INSUFFICIENT_RETAILERS
  );
};

const researchLabel = async (foodLabel, apiKey) => {
  let bhxCandidates = [];
  let coopCandidates = [];
  try {
    [bhxCandidates, coopCandidates] = await Promise.all([
      getBhxCandidates(foodLabel, apiKey),
      getCoopCandidates(foodLabel),
    ]);
  } catch (error) {
    return {
      foodLabel,
      status: "deferred",
      reason: FOOD_PRICE_DEFER_REASON.INSUFFICIENT_RETAILERS,
      error: error.message,
    };
  }

  const bhx = pickCandidate(foodLabel, bhxCandidates, adaptBhx);
  const coop = pickCandidate(foodLabel, coopCandidates, adaptCoop);
  const selected = bhx.accepted?.regularPriceVnd
    ? { sourceKey: "bach_hoa_xanh", candidate: bhx.accepted }
    : coop.accepted?.regularPriceVnd
      ? { sourceKey: "coop_online", candidate: coop.accepted }
      : null;
  if (!selected) {
    return {
      foodLabel,
      status: "deferred",
      reason: reasonFromReviews([bhx, coop]),
      candidates: {
        bach_hoa_xanh: bhx.accepted,
        coop_online: coop.accepted,
      },
    };
  }
  return {
    foodLabel,
    status: "priced",
    observations: [
      toObservation(foodLabel, selected.sourceKey, selected.candidate),
    ],
    candidates: {
      bach_hoa_xanh: bhx.accepted.name,
      coop_online: coop.accepted.name,
    },
  };
};

const parseIntegerArg = (argv, name, fallback) => {
  const value = argv.find((arg) => arg.startsWith(`--${name}=`));
  return value ? Number.parseInt(value.split("=")[1], 10) : fallback;
};

export const runFoodPriceResearch = async ({
  argv = process.argv.slice(2),
  apiKey = process.env.BHX_RESEARCH_API_KEY,
} = {}) => {
  if (!apiKey) throw new Error("BHX_RESEARCH_API_KEY_REQUIRED");
  const labels = await getProductionLabels();
  const start = parseIntegerArg(argv, "start", 0);
  const limit = parseIntegerArg(argv, "limit", labels.length);
  const selected = labels.slice(start, start + limit);
  const results = [];
  for (const [index, foodLabel] of selected.entries()) {
    results.push(await researchLabel(foodLabel, apiKey));
    if ((index + 1) % 25 === 0 || index + 1 === selected.length) {
      console.error(`researched ${index + 1}/${selected.length}`);
    }
    await sleep(75);
  }

  const pricedLabels = results
    .filter(({ status }) => status === "priced")
    .map(({ foodLabel }) => foodLabel);
  const deferred = results
    .filter(({ status }) => status === "deferred")
    .map(({ foodLabel, reason }) => ({ foodLabel, reason }));
  const coverage =
    selected.length === labels.length
      ? buildCatalogCoverageLedger({
          productionLabels: labels,
          pricedLabels,
          deferred,
        })
      : { total: selected.length, priced: pricedLabels.length, deferred: deferred.length };
  const report = { observedAt: OBSERVED_AT, start, coverage, results };
  if (argv.includes("--write-local-data")) {
    await mkdir(dirname(LOCAL_RESEARCH_OUTPUT), { recursive: true });
    await writeFile(LOCAL_RESEARCH_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  return report;
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runFoodPriceResearch()
    .then((result) =>
      console.log(
        process.argv.includes("--write-local-data")
          ? JSON.stringify({ output: LOCAL_RESEARCH_OUTPUT, ...result.coverage })
          : JSON.stringify(result, null, 2),
      ),
    )
    .catch((error) => {
      console.error(JSON.stringify({ success: false, message: error.message }));
      process.exitCode = 1;
    });
}
