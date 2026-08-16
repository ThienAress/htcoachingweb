import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASELINE_SCHEMA_VERSION = 1;

const validateBaseline = (report, baseline) => {
  if (!baseline || typeof baseline !== "object") {
    throw new Error("UI audit baseline must be a JSON object.");
  }
  if (baseline.schemaVersion !== BASELINE_SCHEMA_VERSION) {
    throw new Error(
      `UI audit baseline schema mismatch: expected ${BASELINE_SCHEMA_VERSION}, received ${baseline.schemaVersion}.`,
    );
  }
  if (baseline.rulesetVersion !== report.rulesetVersion) {
    throw new Error(
      `UI audit ruleset mismatch: baseline ${baseline.rulesetVersion}, scanner ${report.rulesetVersion}.`,
    );
  }
  if (baseline.target !== report.target) {
    throw new Error(
      `UI audit baseline target mismatch: baseline ${baseline.target}, scan ${report.target}.`,
    );
  }
  if ((baseline.category ?? null) !== (report.category ?? null)) {
    throw new Error("UI audit baseline category does not match the current scan.");
  }
  if (!Array.isArray(baseline.findings)) {
    throw new Error("UI audit baseline findings must be an array.");
  }

  const keys = new Set();
  for (const finding of baseline.findings) {
    if (!finding?.key || typeof finding.key !== "string") {
      throw new Error("Every UI audit baseline finding must have a stable key.");
    }
    if (keys.has(finding.key)) {
      throw new Error(`Duplicate UI audit baseline key: ${finding.key}.`);
    }
    keys.add(finding.key);
  }
};

export const createUiAuditBaseline = (report) => ({
  schemaVersion: BASELINE_SCHEMA_VERSION,
  rulesetVersion: report.rulesetVersion,
  target: report.target,
  category: report.category,
  findings: report.findings.map(
    ({ key, ruleId, file, line, confidence, severity, status }) => ({
      key,
      ruleId,
      file,
      line,
      confidence,
      severity,
      status,
    }),
  ),
});

export const attachUiAuditBaseline = (report, baseline, baselinePath) => {
  validateBaseline(report, baseline);
  const baselineKeys = new Set(baseline.findings.map((finding) => finding.key));
  const currentKeys = new Set(report.findings.map((finding) => finding.key));
  const newFindings = report.findings.filter(
    (finding) => !baselineKeys.has(finding.key),
  );
  const newHighConfidence = newFindings.filter(
    (finding) => finding.status === "fail" && finding.confidence === "high",
  );
  const resolvedFindings = baseline.findings.filter(
    (finding) => !currentKeys.has(finding.key),
  );

  return {
    ...report,
    regression: {
      baseline: baselinePath,
      baselineFindings: baseline.findings.length,
      currentFindings: report.findings.length,
      newFindings: newFindings.length,
      newHighConfidence: newHighConfidence.length,
      resolvedFindings: resolvedFindings.length,
      shouldFail: newHighConfidence.length > 0,
      newKeys: newFindings.map((finding) => finding.key),
      newHighConfidenceKeys: newHighConfidence.map((finding) => finding.key),
      resolvedKeys: resolvedFindings.map((finding) => finding.key),
    },
  };
};

export const readUiAuditBaseline = async ({ rootDir, baselinePath }) => {
  const contents = await readFile(resolve(rootDir, baselinePath), "utf8");
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`UI audit baseline is not valid JSON: ${error.message}`);
  }
};

export const writeUiAuditBaseline = async ({
  rootDir,
  baselinePath,
  baseline,
}) => {
  const outputPath = resolve(rootDir, baselinePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
};
