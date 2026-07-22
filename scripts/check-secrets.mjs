import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const ignoredExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".lock",
  ".pdf",
  ".png",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
]);
const patterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["mongodb-credentials", /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@/i],
  ["cloudinary-credentials", /cloudinary:\/\/[^:\s]+:[^@\s]+@/i],
  ["openai-key", /\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{20,}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  [
    "google-app-password",
    /^(?:[a-z]{4}[ \t]+){3}[a-z]{4}[ \t]*$/im,
  ],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["resend-key", /\bre_[A-Za-z0-9]{24,}\b/],
  ["stripe-secret", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/],
];

const findings = [];
for (const relative of files) {
  if (
    relative.includes("node_modules/") ||
    relative.includes("test-results/") ||
    relative.includes("playwright-report/")
  ) {
    continue;
  }
  if (
    path.basename(relative).startsWith(".env") &&
    !relative.endsWith(".example")
  ) {
    findings.push({ file: relative, type: "tracked-env-file" });
    continue;
  }
  if (ignoredExtensions.has(path.extname(relative).toLowerCase())) continue;
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute) || fs.statSync(absolute).size > 2_000_000) {
    continue;
  }
  const content = fs.readFileSync(absolute, "utf8");
  for (const [type, pattern] of patterns) {
    if (pattern.test(content)) findings.push({ file: relative, type });
  }
}

if (findings.length > 0) {
  process.stderr.write(
    "Potential secrets found:\n" +
      findings
        .map((finding) => "- " + finding.file + " (" + finding.type + ")")
        .join("\n") +
      "\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write("Secret scan passed.\n");
}
