import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { analyzeMealImage } from "../services/mealScan.service.js";
import {
  parseNutrition5kMetadata,
  selectBenchmarkIds,
} from "./mealScanBenchmarkDataset.js";
import {
  evaluateMealScanQuality,
  scoreMealScanCase,
  summarizeMealScanBenchmark,
} from "./mealScanBenchmarkMetrics.js";

const DATASET_ROOT =
  "https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset";
const DATASET_URLS = {
  cafe1: `${DATASET_ROOT}/metadata/dish_metadata_cafe1.csv`,
  cafe2: `${DATASET_ROOT}/metadata/dish_metadata_cafe2.csv`,
  testIds: `${DATASET_ROOT}/dish_ids/splits/depth_test_ids.txt`,
};
const DATASET_SOURCE =
  "https://github.com/google-research-datasets/Nutrition5k";
const MAX_IMAGE_BYTES = 280 * 1024;
const MAX_EDGE_STEPS = [1280, 998, 778, 607, 473];
const QUALITY_STEPS = [82, 70, 58, 46];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(__dirname, "../../..");

const parseInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const argumentValue = (name) => {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
};

const options = {
  limit: parseInteger(argumentValue("limit"), 30, 1, 50),
  locale: argumentValue("locale") === "vi" ? "vi" : "en",
  delayMs: parseInteger(argumentValue("delay-ms"), 250, 0, 5_000),
  output: argumentValue("output"),
  excludeReport: argumentValue("exclude-report"),
  failOnQuality: process.argv.includes("--fail-on-quality"),
};

const loadExcludedDishIds = async (reportPath) => {
  if (!reportPath) return new Set();
  const report = JSON.parse(await readFile(path.resolve(reportPath), "utf8"));
  const cases = Array.isArray(report.cases) ? report.cases : [];
  return new Set(cases.map((entry) => entry.dishId).filter(Boolean));
};


if (process.env.MEAL_SCAN_BENCHMARK_ALLOW_LIVE !== "true") {
  throw new Error(
    "Live benchmark disabled. Set MEAL_SCAN_BENCHMARK_ALLOW_LIVE=true explicitly.",
  );
}
if (process.env.AI_PROVIDER !== "gemini" || !process.env.GEMINI_API_KEY) {
  throw new Error("Benchmark requires AI_PROVIDER=gemini and GEMINI_API_KEY.");
}

const fetchResource = async (url, responseType) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`Dataset request failed with ${response.status}`);
      error.code = `DATASET_HTTP_${response.status}`;
      throw error;
    }
    if (responseType === "buffer") {
      return Buffer.from(await response.arrayBuffer());
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const prepareImage = async (source) => {
  let lastResult = null;
  for (const maxEdge of MAX_EDGE_STEPS) {
    for (const quality of QUALITY_STEPS) {
      lastResult = await sharp(source)
        .rotate()
        .resize({
          width: maxEdge,
          height: maxEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer();
      if (lastResult.length <= MAX_IMAGE_BYTES) return lastResult;
      lastResult.fill(0);
    }
  }
  throw new Error("Unable to compress benchmark image below 280 KB");
};

const loadDataset = async () => {
  const [cafe1, cafe2, testIdsText] = await Promise.all([
    fetchResource(DATASET_URLS.cafe1, "text"),
    fetchResource(DATASET_URLS.cafe2, "text"),
    fetchResource(DATASET_URLS.testIds, "text"),
  ]);
  const metadata = parseNutrition5kMetadata(`${cafe1}\n${cafe2}`);
  const testIds = testIdsText
    .split(/\r?\n/)
    .map((dishId) => dishId.trim())
    .filter((dishId) => dishId && metadata.has(dishId));
  return { metadata, testIds };
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const runDish = async (dishId, reference) => {
  const imageUrl = `${DATASET_ROOT}/imagery/realsense_overhead/${dishId}/rgb.png`;
  let source = null;
  let prepared = null;
  let base64 = "";
  const startedAt = performance.now();

  try {
    source = await fetchResource(imageUrl, "buffer");
    prepared = await prepareImage(source);
    base64 = prepared.toString("base64");
    const result = await analyzeMealImage({
      mimeType: "image/webp",
      base64,
      locale: options.locale,
    });
    const score = scoreMealScanCase(result, reference);
    return {
      dishId,
      success: true,
      latencyMs: Math.round(performance.now() - startedAt),
      reference,
      prediction: {
        mealName: result.mealName,
        confidence: result.confidence,
        total: result.total,
        portionEstimate: score.portion.estimate,
        labels: result.items.map((item) => item.label),
        questions: result.questions,
      },
      score,
    };
  } catch (error) {
    return {
      dishId,
      success: false,
      latencyMs: Math.round(performance.now() - startedAt),
      errorCode: error?.code || error?.name || "UNKNOWN",
    };
  } finally {
    base64 = "";
    source?.fill(0);
    prepared?.fill(0);
  }
};

const { metadata, testIds } = await loadDataset();
const excludedIds = await loadExcludedDishIds(options.excludeReport);
const selectedIds = selectBenchmarkIds(
  testIds,
  options.limit,
  excludedIds,
);
if (selectedIds.length !== options.limit) {
  throw new Error(
    `Nutrition5k provided ${selectedIds.length}/${options.limit} benchmark samples.`,
  );
}
const cases = [];

for (const [index, dishId] of selectedIds.entries()) {
  process.stderr.write(
    `[meal-scan-benchmark] ${index + 1}/${selectedIds.length} ${dishId}\n`,
  );
  cases.push(await runDish(dishId, metadata.get(dishId)));
  if (index < selectedIds.length - 1 && options.delayMs > 0) {
    await sleep(options.delayMs);
  }
}

const summary = summarizeMealScanBenchmark(cases);
const qualityDecision = evaluateMealScanQuality(summary);
const timestamp = new Date().toISOString();
const report = {
  benchmark: "Nutrition5k overhead RGB test subset",
  source: DATASET_SOURCE,
  license: "CC BY 4.0",
  timestamp,
  model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  locale: options.locale,
  requestedSamples: options.limit,
  excludedSamples: excludedIds.size,
  summary,
  qualityDecision,
  limitations: [
    "Nutrition5k was collected in California cafeterias and is not representative of Vietnamese cuisine.",
    "Overhead scanning-rig images are cleaner than typical customer phone photos.",
    "Ingredient recall uses token overlap and is a directional heuristic.",
  ],
  cases,
};
const defaultOutput = path.join(
  repositoryRoot,
  ".local-data",
  "meal-scan",
  `nutrition5k-${timestamp.replaceAll(":", "-")}.json`,
);
const outputPath = path.resolve(options.output || defaultOutput);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}${os.EOL}`, "utf8");

process.stdout.write(
  `${JSON.stringify({ outputPath, summary, qualityDecision }, null, 2)}\n`,
);
if (options.failOnQuality && !qualityDecision.passed) process.exitCode = 2;
