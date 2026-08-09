import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { analyzeMealImage } from "../services/mealScan.service.js";
import {
  evaluateProxyChecks,
  scoreProxyCase,
  summarizeProxyBenchmark,
} from "./mealScanProxyBenchmarkMetrics.js";
import { GLOBAL_SYNTHETIC_PROXY_CASES } from "./mealScanGlobalProxyCases.js";
import { VIETNAMESE_SYNTHETIC_PROXY_CASES } from "./mealScanVietnameseProxyCases.js";

const MAX_IMAGE_BYTES = 280 * 1024;
const MAX_EDGE_STEPS = [1280, 998, 778, 607, 473];
const QUALITY_STEPS = [82, 70, 58, 46];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(__dirname, "../../..");

const CASE_SET_CONFIG = {
  vi: {
    benchmark: "Vietnamese synthetic recognition proxy",
    cases: VIETNAMESE_SYNTHETIC_PROXY_CASES,
    imageDirectoryName: "vietnamese-synthetic",
    logLabel: "meal-scan-vi-proxy",
    outputPrefix: "vietnamese-synthetic-proxy",
  },
  global: {
    benchmark: "Global synthetic recognition and scenario proxy",
    cases: GLOBAL_SYNTHETIC_PROXY_CASES,
    imageDirectoryName: "global-synthetic",
    logLabel: "meal-scan-global-proxy",
    outputPrefix: "global-synthetic-proxy",
  },
};

const parseInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const argumentValue = (name) => {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
};

const caseSet = argumentValue("case-set") || "vi";
const caseSetConfig = CASE_SET_CONFIG[caseSet];
if (!caseSetConfig) {
  throw new Error(
    `Unsupported case set "${caseSet}". Expected one of: ${Object.keys(CASE_SET_CONFIG).join(", ")}.`,
  );
}
const referenceCases = caseSetConfig.cases;
const defaultImageDirectory = path.join(
  repositoryRoot,
  ".local-data",
  "meal-scan",
  caseSetConfig.imageDirectoryName,
);
const options = {
  delayMs: parseInteger(argumentValue("delay-ms"), 250, 0, 5_000),
  imageDirectory: path.resolve(
    argumentValue("image-dir") || defaultImageDirectory,
  ),
  limit: parseInteger(
    argumentValue("limit"),
    referenceCases.length,
    1,
    referenceCases.length,
  ),
  output: argumentValue("output"),
};

if (process.env.MEAL_SCAN_BENCHMARK_ALLOW_LIVE !== "true") {
  throw new Error(
    "Live benchmark disabled. Set MEAL_SCAN_BENCHMARK_ALLOW_LIVE=true explicitly.",
  );
}
if (process.env.AI_PROVIDER !== "gemini" || !process.env.GEMINI_API_KEY) {
  throw new Error("Benchmark requires AI_PROVIDER=gemini and GEMINI_API_KEY.");
}

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
  throw new Error("Unable to compress proxy image below 280 KB");
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const runCase = async (reference) => {
  const imagePath = path.join(options.imageDirectory, reference.imageFile);
  let source = null;
  let prepared = null;
  let base64 = "";
  const startedAt = performance.now();

  try {
    source = await readFile(imagePath);
    const imageSha256 = createHash("sha256").update(source).digest("hex");
    prepared = await prepareImage(source);
    base64 = prepared.toString("base64");
    const result = await analyzeMealImage({
      mimeType: "image/webp",
      base64,
      locale: "vi",
    });
    const score = scoreProxyCase(result, reference);

    return {
      caseId: reference.caseId,
      imageFile: reference.imageFile,
      imageSha256,
      success: true,
      latencyMs: Math.round(performance.now() - startedAt),
      reference: {
        mealAliases: reference.mealAliases,
        visibleIngredients: reference.ingredientGroups.map((group) => group.name),
        expectedScenario: reference.expectedScenario || null,
      },
      prediction: {
        mealName: result.mealName,
        confidence: result.confidence,
        imageAssessment: result.imageAssessment,
        labels: result.items.map((item) => item.label),
        questions: result.questions,
      },
      score,
    };
  } catch (error) {
    return {
      caseId: reference.caseId,
      imageFile: reference.imageFile,
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

const selectedCases = referenceCases.slice(0, options.limit);
const cases = [];

for (const [index, reference] of selectedCases.entries()) {
  process.stderr.write(
    `[${caseSetConfig.logLabel}] ${index + 1}/${selectedCases.length} ${reference.caseId}\n`,
  );
  cases.push(await runCase(reference));
  if (index < selectedCases.length - 1 && options.delayMs > 0) {
    await sleep(options.delayMs);
  }
}

const summary = summarizeProxyBenchmark(cases);
const proxyDecision = evaluateProxyChecks(summary);
const timestamp = new Date().toISOString();
const report = {
  benchmark: caseSetConfig.benchmark,
  caseSet,
  timestamp,
  model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  locale: "vi",
  requestedSamples: selectedCases.length,
  nutritionGroundTruth: false,
  provenance: {
    type: "synthetic",
    generator: "OpenAI image generation tool",
    generatedAt: "2026-08-03",
    storage: "Project-local ignored .local-data directory",
  },
  summary,
  proxyDecision,
  limitations: [
    "This dataset measures only directional meal-name, scenario and visible-ingredient recognition.",
    "It has no weighed portion or verified calorie/protein/carb/fat ground truth.",
    "Synthetic images are cleaner and less diverse than real customer phone photos.",
    "Prompted dish composition can make recognition easier than an uncurated field sample.",
    "INFORMATIONAL_PASS must not be used as a beta or nutrition-accuracy release gate.",
  ],
  cases,
};
const defaultOutput = path.join(
  repositoryRoot,
  ".local-data",
  "meal-scan",
  `${caseSetConfig.outputPrefix}-${timestamp.replaceAll(":", "-")}.json`,
);
const outputPath = path.resolve(options.output || defaultOutput);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}${os.EOL}`, "utf8");

process.stdout.write(
  `${JSON.stringify({ outputPath, summary, proxyDecision }, null, 2)}\n`,
);
