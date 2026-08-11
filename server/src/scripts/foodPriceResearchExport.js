import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { LOCAL_FOOD_PRICE_OBSERVATIONS } from "../constants/localFoodPriceObservations.js";
import { validatePriceManifest } from "./localFoodPriceImport.contract.js";
import { FOOD_PRICE_DEFER_REASON } from "./foodPriceResearch.contract.js";
import { reviewFoodPriceResearch } from "./foodPriceResearchReview.js";

const RESEARCH_INPUT = fileURLToPath(
  new URL("../../../.local-data/food-price-research-2026-08-11.json", import.meta.url),
);
const REVIEWED_JSON_OUTPUT = fileURLToPath(
  new URL("../../../.local-data/food-price-reviewed-2026-08-11.json", import.meta.url),
);
const OBSERVATIONS_CSV_OUTPUT = fileURLToPath(
  new URL(
    "../../../.local-data/food-price-approved-observations-2026-08-11.csv",
    import.meta.url,
  ),
);
const COVERAGE_CSV_OUTPUT = fileURLToPath(
  new URL("../../../.local-data/food-price-coverage-2026-08-11.csv", import.meta.url),
);

const DEFER_REASON_LABELS = Object.freeze({
  [FOOD_PRICE_DEFER_REASON.INSUFFICIENT_RETAILERS]:
    "Chưa tìm thấy một nguồn bán lẻ có sản phẩm tương đương",
  [FOOD_PRICE_DEFER_REASON.RAW_COOKED_MISMATCH]:
    "Chỉ tìm thấy sản phẩm khác trạng thái sống/chín",
  [FOOD_PRICE_DEFER_REASON.UNIT_CONVERSION_UNSAFE]:
    "Không đủ căn cứ quy đổi về gram",
  [FOOD_PRICE_DEFER_REASON.PRODUCT_FORM_MISMATCH]:
    "Kết quả bán lẻ khác dạng hoặc khác bản chất thực phẩm",
});

export const foodPriceDeferReasonLabel = (reason) =>
  DEFER_REASON_LABELS[reason] || "";

export const toSafeCsvCell = (value) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const toCsv = (headers, rows) =>
  `\uFEFF${[
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? "")),
  ]
    .map((row) => row.map(toSafeCsvCell).join(","))
    .join("\r\n")}\r\n`;

const typicalPricePer100g = (observations) => {
  const prices = observations
    .map(({ packGrams, regularPriceVnd }) =>
      Math.round((regularPriceVnd / packGrams) * 100),
    )
    .sort((left, right) => left - right);
  return prices.length >= 1 ? prices[0] : "";
};

export const runFoodPriceResearchExport = async () => {
  const report = JSON.parse(await readFile(RESEARCH_INPUT, "utf8"));
  const reviewed = reviewFoodPriceResearch({
    report,
    existingObservations: LOCAL_FOOD_PRICE_OBSERVATIONS,
  });
  validatePriceManifest(reviewed.observations);

  const observationsByLabel = new Map();
  for (const observation of reviewed.observations) {
    if (!observationsByLabel.has(observation.foodLabel)) {
      observationsByLabel.set(observation.foodLabel, []);
    }
    observationsByLabel.get(observation.foodLabel).push(observation);
  }
  const deferredByLabel = new Map(
    reviewed.deferred.map(({ foodLabel, reason }) => [foodLabel, reason]),
  );
  const coverageRows = report.results.map(({ foodLabel }) => {
    const observations = observationsByLabel.get(foodLabel) || [];
    return {
      "Tên thực phẩm": foodLabel,
      "Trạng thái": observations.length >= 1 ? "Có giá" : "Để trống",
      "Mã lý do": deferredByLabel.get(foodLabel) || "",
      "Lý do": foodPriceDeferReasonLabel(deferredByLabel.get(foodLabel)),
      "Số nguồn": observations.length,
      "Giá ước tính mỗi 100g (VND)": typicalPricePer100g(observations),
    };
  });

  await mkdir(dirname(REVIEWED_JSON_OUTPUT), { recursive: true });
  await Promise.all([
    writeFile(
      REVIEWED_JSON_OUTPUT,
      `${JSON.stringify(reviewed, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      OBSERVATIONS_CSV_OUTPUT,
      toCsv(
        [
          "Tên thực phẩm",
          "Nguồn",
          "Khối lượng (g)",
          "Giá thường (VND)",
          "Giá khuyến mãi (VND)",
          "Liên kết nguồn",
          "Ngày ghi nhận",
        ],
        reviewed.observations.map((observation) => ({
          "Tên thực phẩm": observation.foodLabel,
          "Nguồn": observation.sourceKey,
          "Khối lượng (g)": observation.packGrams,
          "Giá thường (VND)": observation.regularPriceVnd,
          "Giá khuyến mãi (VND)": observation.promotionalPriceVnd,
          "Liên kết nguồn": observation.sourceUrl,
          "Ngày ghi nhận": observation.observedAt,
        })),
      ),
      "utf8",
    ),
    writeFile(
      COVERAGE_CSV_OUTPUT,
      toCsv(
        [
          "Tên thực phẩm",
          "Trạng thái",
          "Mã lý do",
          "Lý do",
          "Số nguồn",
          "Giá ước tính mỗi 100g (VND)",
        ],
        coverageRows,
      ),
      "utf8",
    ),
  ]);
  return {
    ...reviewed.coverage,
    observations: reviewed.observations.length,
    outputs: {
      reviewedJson: REVIEWED_JSON_OUTPUT,
      observationsCsv: OBSERVATIONS_CSV_OUTPUT,
      coverageCsv: COVERAGE_CSV_OUTPUT,
    },
  };
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runFoodPriceResearchExport()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({ success: false, message: error.message }));
      process.exitCode = 1;
    });
}
