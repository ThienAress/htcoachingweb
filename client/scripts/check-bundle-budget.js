import { gzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DIST_DIR = path.resolve("dist");
const MANIFEST_PATH = path.join(DIST_DIR, ".vite", "manifest.json");
const KB = 1024;
const limits = {
  entryRaw: 700 * KB,
  entryGzip: 230 * KB,
  routeRaw: 600 * KB,
  routeGzip: 200 * KB,
  deferredPdfRaw: 1700 * KB,
  deferredPdfGzip: 550 * KB,
};
const routeFamilies = [
  {
    name: "f1-workflow",
    sourcePattern: /F1|f1Customer\.service/i,
    rawLimit: 240 * KB,
    gzipLimit: 70 * KB,
  },
  {
    name: "training-schedule",
    sourcePattern: /TrainingSchedule|trainingSchedule\.service/i,
    rawLimit: 60 * KB,
    gzipLimit: 20 * KB,
  },
];

if (!existsSync(MANIFEST_PATH)) {
  throw new Error("Bundle manifest is missing. Run vite build first.");
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const chunks = new Map();

for (const [source, entry] of Object.entries(manifest)) {
  if (!entry.file?.endsWith(".js")) continue;
  const record = chunks.get(entry.file) || {
    file: entry.file,
    sources: [],
    isEntry: false,
    raw: 0,
    gzip: 0,
  };
  record.sources.push(source);
  record.isEntry ||= Boolean(entry.isEntry);
  chunks.set(entry.file, record);
}

const failures = [];
const rows = [];

for (const chunk of chunks.values()) {
  const content = readFileSync(path.join(DIST_DIR, chunk.file));
  const raw = content.byteLength;
  const gzip = gzipSync(content).byteLength;
  chunk.raw = raw;
  chunk.gzip = gzip;
  const descriptor = [chunk.file, ...chunk.sources].join(" ");
  const isDeferredPdf = /react-pdf|renderer|pdfkit|yoga-layout|WorkoutPlanPDF/i.test(
    descriptor,
  );
  const rawLimit = isDeferredPdf
    ? limits.deferredPdfRaw
    : chunk.isEntry
      ? limits.entryRaw
      : limits.routeRaw;
  const gzipLimit = isDeferredPdf
    ? limits.deferredPdfGzip
    : chunk.isEntry
      ? limits.entryGzip
      : limits.routeGzip;

  rows.push({
    chunk: chunk.file,
    rawKb: (raw / KB).toFixed(1),
    gzipKb: (gzip / KB).toFixed(1),
    budget: isDeferredPdf ? "deferred-pdf" : chunk.isEntry ? "entry" : "route",
  });
  if (raw > rawLimit || gzip > gzipLimit) {
    failures.push(
      `${chunk.file}: ${(raw / KB).toFixed(1)} kB raw / ${(
        gzip / KB
      ).toFixed(1)} kB gzip`,
    );
  }
}

console.table(rows.sort((a, b) => Number(b.rawKb) - Number(a.rawKb)).slice(0, 15));

const familyRows = routeFamilies.map((family) => {
  const matchingChunks = [...chunks.values()].filter((chunk) =>
    family.sourcePattern.test([chunk.file, ...chunk.sources].join(" ")),
  );
  const raw = matchingChunks.reduce((total, chunk) => total + chunk.raw, 0);
  const gzip = matchingChunks.reduce((total, chunk) => total + chunk.gzip, 0);

  if (matchingChunks.length === 0) {
    failures.push(family.name + ": no matching route chunks found");
  } else if (raw > family.rawLimit || gzip > family.gzipLimit) {
    failures.push(
      family.name +
        ": " +
        (raw / KB).toFixed(1) +
        " kB raw / " +
        (gzip / KB).toFixed(1) +
        " kB gzip",
    );
  }

  return {
    routeFamily: family.name,
    chunks: matchingChunks.length,
    rawKb: (raw / KB).toFixed(1),
    gzipKb: (gzip / KB).toFixed(1),
    rawBudgetKb: family.rawLimit / KB,
    gzipBudgetKb: family.gzipLimit / KB,
  };
});

console.table(familyRows);

if (failures.length > 0) {
  throw new Error(`Bundle budget exceeded:\n${failures.join("\n")}`);
}

console.log("Bundle budget passed");
