import { isAbsolute, relative, resolve } from "node:path";

import {
  ENGINE_VERSION,
  RULESET_VERSION,
  RULE_BY_ID,
  UI_AUDIT_CATEGORIES,
  UI_AUDIT_RULES,
} from "./catalog.mjs";
import { RULE_RUNNERS } from "./rules.mjs";
import { readUiSources, toPosixPath } from "./source.mjs";

const FORMATS = new Set(["human", "json", "prompt"]);

export {
  attachUiAuditBaseline,
  createUiAuditBaseline,
  readUiAuditBaseline,
  writeUiAuditBaseline,
} from "./baseline.mjs";

const compareFindings = (a, b) =>
  a.file.localeCompare(b.file, "en") ||
  a.line - b.line ||
  RULE_BY_ID.get(a.ruleId).index - RULE_BY_ID.get(b.ruleId).index ||
  a.key.localeCompare(b.key, "en");

const ensureInsideRepo = (target) => {
  if (isAbsolute(target)) throw new Error("UI audit target must stay inside the repository.");
  const normalized = target.replaceAll("\\", "/");
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error("UI audit target must stay inside the repository.");
  }
  return normalized.replace(/^\.\//, "") || "client/src";
};

export const parseUiAuditArgs = (args) => {
  const options = {
    format: "human",
    category: null,
    target: "client/src",
    baseline: null,
    writeBaseline: null,
    failOnNewHigh: false,
  };
  let targetSeen = false;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--format") {
      const format = args[++index];
      if (!FORMATS.has(format)) throw new Error(`Unsupported UI audit format: ${format}`);
      options.format = format;
    } else if (value === "--category") {
      const category = args[++index];
      if (!UI_AUDIT_CATEGORIES.includes(category)) throw new Error(`Unsupported UI audit category: ${category}`);
      options.category = category;
    } else if (value === "--baseline") {
      const baseline = args[++index];
      if (!baseline || baseline.startsWith("-")) {
        throw new Error("--baseline requires a path value.");
      }
      options.baseline = ensureInsideRepo(baseline);
    } else if (value === "--write-baseline") {
      const baseline = args[++index];
      if (!baseline || baseline.startsWith("-")) {
        throw new Error("--write-baseline requires a path value.");
      }
      options.writeBaseline = ensureInsideRepo(baseline);
    } else if (value === "--fail-on-new-high") {
      options.failOnNewHigh = true;
    } else if (value?.startsWith("-")) {
      throw new Error(`Unknown UI audit option: ${value}`);
    } else if (targetSeen) {
      throw new Error("UI audit accepts only one target directory.");
    } else {
      options.target = ensureInsideRepo(value);
      targetSeen = true;
    }
  }
  if (options.baseline && options.writeBaseline) {
    throw new Error("Use either --baseline or --write-baseline, not both.");
  }
  if (options.failOnNewHigh && !options.baseline) {
    throw new Error("--fail-on-new-high requires --baseline.");
  }
  return options;
};

export const runUiAudit = async ({ rootDir = process.cwd(), target = "client/src", category = null } = {}) => {
  const repoRoot = resolve(rootDir);
  const safeTarget = ensureInsideRepo(target);
  const sources = await readUiSources({ repoRoot, target: safeTarget });
  const rules = category
    ? UI_AUDIT_RULES.filter((rule) => rule.category === category)
    : UI_AUDIT_RULES;
  const findings = [];
  for (const source of sources) {
    for (const rule of rules) findings.push(...RULE_RUNNERS.get(rule.id)(source));
  }
  findings.sort(compareFindings);
  const keyOccurrences = new Map();
  for (const item of findings) {
    const occurrence = keyOccurrences.get(item.key) ?? 0;
    keyOccurrences.set(item.key, occurrence + 1);
    if (occurrence > 0) item.key = `${item.key}-${occurrence + 1}`;
  }
  const byStatus = findings.reduce(
    (summary, finding) => ({ ...summary, [finding.status]: summary[finding.status] + 1 }),
    { fail: 0, advisory: 0 },
  );
  return {
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    target: toPosixPath(relative(repoRoot, resolve(repoRoot, safeTarget))),
    category,
    scannedFiles: sources.length,
    evaluatedRules: rules.length,
    summary: { findings: findings.length, ...byStatus },
    findings,
  };
};

const renderHuman = (report) => {
  const lines = [
    `UI AUDIT ${report.engineVersion} · ruleset ${report.rulesetVersion}`,
    `Target: ${report.target} · Files: ${report.scannedFiles} · Rules: ${report.evaluatedRules}`,
    `Findings: ${report.summary.findings} (${report.summary.fail} fail, ${report.summary.advisory} advisory)`,
  ];
  if (report.regression) {
    lines.push(
      `Regression: ${report.regression.newFindings} new (${report.regression.newHighConfidence} high-confidence blocking), ${report.regression.resolvedFindings} resolved · baseline ${report.regression.baseline}`,
    );
  }
  const visibleKeys = report.regression
    ? new Set(report.regression.newKeys)
    : null;
  for (const item of report.findings) {
    if (visibleKeys && !visibleKeys.has(item.key)) continue;
    lines.push(`${item.status.toUpperCase()} ${item.ruleId} ${item.file}:${item.line} — ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
};

const renderPrompt = (report) => {
  const lines = [
    "HTCOACHING UI AUDIT HANDOFF",
    `ENGINE ${report.engineVersion}`,
    `RULESET ${report.rulesetVersion}`,
    "Chỉ sửa finding đã được xác minh trong context; advisory cần rendered/manual evidence.",
  ];
  if (report.regression) {
    lines.push(
      `BASELINE ${report.regression.baseline}`,
      `REGRESSION ${report.regression.newFindings} new · ${report.regression.newHighConfidence} high-confidence blocking · ${report.regression.resolvedFindings} resolved`,
    );
  }
  const visibleKeys = report.regression
    ? new Set(report.regression.newKeys)
    : null;
  for (const item of report.findings) {
    if (visibleKeys && !visibleKeys.has(item.key)) continue;
    lines.push(
      "",
      `RULE ${item.ruleId}`,
      `STATUS ${item.status} · CONFIDENCE ${item.confidence} · SEVERITY ${item.severity}`,
      `EVIDENCE ${item.file}:${item.line}`,
      item.evidence,
      `PROBLEM ${item.message}`,
      `SUGGESTED FIX ${item.remediation}`,
      "ACCEPTANCE CRITERIA",
      `- Finding ${item.ruleId} được xác minh và xử lý hoặc ghi verified-no-change có lý do.`,
      "- Không đổi behavior ngoài phạm vi evidence.",
      "- Chạy lại cùng ruleset và verification liên quan.",
    );
  }
  return `${lines.join("\n")}\n`;
};

export const renderUiAuditReport = (report, format = "human") => {
  if (format === "json") return `${JSON.stringify(report, null, 2)}\n`;
  if (format === "prompt") return renderPrompt(report);
  if (format === "human") return renderHuman(report);
  throw new Error(`Unsupported UI audit format: ${format}`);
};
