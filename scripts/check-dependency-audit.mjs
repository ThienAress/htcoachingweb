import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MINIMUM_SEVERITY = "high";
const SEVERITY_RANK = new Map([
  ["info", 0],
  ["low", 1],
  ["moderate", 2],
  ["high", 3],
  ["critical", 4],
]);
const CLIENT_RSC_ADVISORY =
  "https://github.com/advisories/GHSA-qwww-vcr4-c8h2";
const RSC_PATTERNS = [
  /@vitejs\/plugin-rsc/,
  /react-router\/internal\/react-server-client/,
  /react-server-dom-/,
  /unstable_(?:createCallServer|RSC)/,
];

const relevantSeverity = (severity) =>
  (SEVERITY_RANK.get(String(severity || "").toLowerCase()) ?? -1) >=
  SEVERITY_RANK.get(MINIMUM_SEVERITY);

const collectSourceFiles = (target) => {
  if (!existsSync(target)) return [];
  const entries = readdirSync(target, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(target, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return [path];
  });
};

export const findClientRscUsage = (repoRoot = REPO_ROOT) => {
  const candidates = [
    join(repoRoot, "client", "package.json"),
    join(repoRoot, "client", "vite.config.js"),
    join(repoRoot, "client", "vite.config.mjs"),
    ...collectSourceFiles(join(repoRoot, "client", "src")).filter((path) =>
      [".js", ".jsx", ".mjs", ".ts", ".tsx"].includes(extname(path)),
    ),
  ];
  return candidates.flatMap((path) => {
    if (!existsSync(path)) return [];
    const source = readFileSync(path, "utf8");
    return RSC_PATTERNS.some((pattern) => pattern.test(source))
      ? [path.slice(repoRoot.length + 1)]
      : [];
  });
};

export const evaluateDependencyAudit = (
  payload,
  { scope, clientRscUsage = [] },
) => {
  const vulnerabilities = Object.entries(payload?.vulnerabilities || {});
  const relevantPackages = new Map(
    vulnerabilities.filter(([, value]) => relevantSeverity(value?.severity)),
  );
  const approvedUrls =
    scope === "client" && clientRscUsage.length === 0
      ? new Set([CLIENT_RSC_ADVISORY])
      : new Set();
  const approvedPackages = new Set();

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, vulnerability] of relevantPackages) {
      if (approvedPackages.has(name)) continue;
      const relevantVia = (vulnerability.via || []).filter(
        (via) => typeof via === "string" || relevantSeverity(via?.severity),
      );
      if (
        relevantVia.length > 0 &&
        relevantVia.every((via) =>
          typeof via === "string"
            ? approvedPackages.has(via)
            : approvedUrls.has(via.url),
        )
      ) {
        approvedPackages.add(name);
        changed = true;
      }
    }
  }

  const findings = [...relevantPackages]
    .filter(([name]) => !approvedPackages.has(name))
    .map(([name, vulnerability]) => ({
      name,
      severity: vulnerability.severity,
      advisories: (vulnerability.via || [])
        .filter(
          (via) => typeof via !== "string" && relevantSeverity(via?.severity),
        )
        .map((via) => ({ title: via.title, url: via.url })),
    }));
  const waivedAdvisories = vulnerabilities.flatMap(([, vulnerability]) =>
    (vulnerability.via || [])
      .filter(
        (via) =>
          typeof via !== "string" &&
          relevantSeverity(via?.severity) &&
          approvedUrls.has(via.url),
      )
      .map((via) => ({ title: via.title, url: via.url })),
  );

  return {
    success: findings.length === 0,
    findings,
    waivedAdvisories,
    clientRscUsage,
  };
};

const main = () => {
  const scope = String(process.argv[2] || "");
  if (!["client", "server"].includes(scope)) {
    throw new Error("Usage: node scripts/check-dependency-audit.mjs <client|server>");
  }
  const audit = spawnSync(
    "npm",
    ["audit", "--omit=dev", "--audit-level=high", "--json"],
    {
      cwd: join(REPO_ROOT, scope),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32",
    },
  );
  if (audit.error) throw audit.error;
  if (![0, 1].includes(audit.status)) {
    throw new Error(audit.stderr || `npm audit exited with ${audit.status}`);
  }

  const payload = JSON.parse(audit.stdout);
  if (payload?.error) {
    throw new Error(payload.error.summary || payload.error.message || "npm audit failed");
  }
  const result = evaluateDependencyAudit(payload, {
    scope,
    clientRscUsage: scope === "client" ? findClientRscUsage() : [],
  });
  if (!result.success) {
    process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        success: true,
        scope,
        waivedAdvisories: result.waivedAdvisories,
      },
      null,
      2,
    )}\n`,
  );
};

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ success: false, error: error.message })}\n`,
    );
    process.exitCode = 1;
  }
}
