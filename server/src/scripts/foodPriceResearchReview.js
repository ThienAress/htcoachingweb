import {
  FOOD_PRICE_DEFER_REASON,
  buildCatalogCoverageLedger,
} from "./foodPriceResearch.contract.js";

export const APPROVED_PRODUCTION_PRICE_LABELS = Object.freeze([
  "Bánh bao nhân thịt",
  "Bí đao (bí xanh)",
  "Bông cải xanh",
  "Bơ thực vật",
  "Bưởi",
  "Cà pháo",
  "Cà rốt",
  "Cải thìa",
  "Củ cải trắng",
  "Dưa gang",
  "Dưa leo",
  "Giò lụa",
  "Hạt chia",
  "Khoai môn",
  "Lạp xưởng",
  "Miến dong",
  "Măng tây",
  "Mướp",
  "Mề gà",
  "Nấm hương khô",
  "Nấm rơm",
  "Rau muống",
  "Rau mồng tơi",
  "Rau ngót",
  "Rau răm",
  "Rau thơm",
  "Tim gà",
  "Tía tô",
  "Tôm",
]);

const SOURCE_PRIORITY = Object.freeze({
  bach_hoa_xanh: 0,
  winmart: 1,
  coop_online: 2,
});

const selectObservation = (observations = []) =>
  [...observations].sort(
    (left, right) =>
      (SOURCE_PRIORITY[left.sourceKey] ?? Number.MAX_SAFE_INTEGER) -
      (SOURCE_PRIORITY[right.sourceKey] ?? Number.MAX_SAFE_INTEGER),
  )[0] || null;

const groupReviewedObservations = (observations) => {
  const grouped = new Map();
  for (const observation of observations || []) {
    if (!grouped.has(observation.foodLabel)) {
      grouped.set(observation.foodLabel, []);
    }
    grouped.get(observation.foodLabel).push(observation);
  }
  for (const [foodLabel, items] of grouped) {
    grouped.set(foodLabel, [selectObservation(items)]);
  }
  return grouped;
};

export const reviewFoodPriceResearch = ({
  report,
  approvedLabels = APPROVED_PRODUCTION_PRICE_LABELS,
  existingObservations = [],
}) => {
  const results = report?.results || [];
  const resultsByLabel = new Map(results.map((item) => [item.foodLabel, item]));
  const existingPrices = groupReviewedObservations(existingObservations);
  const approved = [...new Set(approvedLabels || [])];

  for (const foodLabel of approved) {
    const candidate = resultsByLabel.get(foodLabel);
    if (
      candidate?.status !== "priced" ||
      !selectObservation(candidate.observations)
    ) {
      throw new Error(`FOOD_PRICE_REVIEW_APPROVAL_MISSING_SOURCE:${foodLabel}`);
    }
  }

  const pricedLabels = [
    ...approved,
    ...[...existingPrices.keys()].filter((label) => !approved.includes(label)),
  ];
  const priced = new Set(pricedLabels);
  const observations = [
    ...approved.map((label) =>
      selectObservation(resultsByLabel.get(label).observations),
    ),
    ...[...existingPrices]
      .filter(([label]) => !approved.includes(label))
      .flatMap(([, items]) => items),
  ];
  const deferred = results
    .filter(({ foodLabel }) => !priced.has(foodLabel))
    .map(({ foodLabel, status, reason }) => ({
      foodLabel,
      reason:
        status === "deferred" && reason
          ? reason
          : FOOD_PRICE_DEFER_REASON.PRODUCT_FORM_MISMATCH,
    }));
  const coverage = buildCatalogCoverageLedger({
    productionLabels: results.map(({ foodLabel }) => foodLabel),
    pricedLabels,
    deferred,
  });
  return { coverage, pricedLabels, observations, deferred };
};
