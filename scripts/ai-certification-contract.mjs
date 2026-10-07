import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const shaPattern = /^[a-f0-9]{40}$/;
const objectIdPattern = /^[a-f0-9]{24}$/;
const timestamp = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const EXPECTED_MODEL = "deepseek-v4.1-flash";
const CI_JOBS = ["client", "docker", "e2e", "secrets", "server"];

export function verifyAiCertification(evidence, corpus) {
  const reasons = [];
  const reject = (condition, reason) => {
    if (!condition) reasons.push(reason);
  };
  if (!evidence || !corpus || !Array.isArray(corpus.cases)) {
    return { go: false, reasons: ["invalid_contract"] };
  }
  const { sha, runStartedAt, cases = [], talk01, ci, deploy, health, safety } = evidence;
  reject(evidence.environment === "staging", "environment_mismatch");
  reject(shaPattern.test(sha || ""), "invalid_sha");
  reject(timestamp(runStartedAt), "invalid_run_time");
  reject(evidence.model === EXPECTED_MODEL && evidence.provider === "vibi", "provider_mismatch");
  reject(Array.isArray(cases) && cases.length === 15 && corpus.cases.length === 15, "exact_15_required");
  const records = Array.isArray(cases) ? cases.filter((record) => record && typeof record === "object") : [];
  const prompts = Array.isArray(corpus.cases) ? corpus.cases : [];
  const ids = new Set();
  const conversations = new Set();
  for (const item of prompts) {
    const matched = records.filter((record) => record.id === item.id);
    reject(matched.length === 1, `case_${item.id}_record_count`);
    const record = matched[0];
    if (!record) continue;
    reject(record.prompt === item.prompt, `case_${item.id}_prompt_mismatch`);
    reject(record.sha === sha && record.configuredModel === EXPECTED_MODEL &&
      typeof record.model === "string" && record.model.length <= 100, `case_${item.id}_identity_mismatch`);
    reject(record.grade === "PASS" && record.completed === true, `case_${item.id}_not_passed`);
    reject(record.runStartedAt === runStartedAt && record.reused !== true, `case_${item.id}_reused`);
    reject(timestamp(record.startedAt) && timestamp(record.finishedAt) &&
      Date.parse(record.startedAt) >= Date.parse(runStartedAt) &&
      Date.parse(record.finishedAt) >= Date.parse(record.startedAt), `case_${item.id}_time_mismatch`);
    reject(objectIdPattern.test(record.conversationId || ""), `case_${item.id}_conversation_missing`);
    reject(objectIdPattern.test(record.userMessageId || "") && !ids.has(record.userMessageId),
      `case_${item.id}_user_turn_missing`);
    ids.add(record.userMessageId);
    if (item.dependsOn) {
      const parent = records.find((entry) => entry.id === item.dependsOn);
      reject(parent?.conversationId === record.conversationId &&
        Date.parse(record.startedAt) >= Date.parse(parent?.finishedAt), `case_${item.id}_parent_mismatch`);
    } else {
      reject(record.firstUserTurn === true && !conversations.has(record.conversationId),
        `case_${item.id}_not_new_conversation`);
      conversations.add(record.conversationId);
    }
  }
  reject(Boolean(talk01) && talk01.grade === "PASS" && talk01.sha === sha &&
    talk01.model === EXPECTED_MODEL && talk01.runStartedAt === runStartedAt &&
    talk01.completedToolGroups >= 3 && talk01.requestCount >= 3 &&
    Array.isArray(talk01.errors) && talk01.errors.length === 0 &&
    !conversations.has(talk01.conversationId) && objectIdPattern.test(talk01.conversationId || ""),
  "talk01_live_required");
  reject(Boolean(ci) && ci.sha === sha && Array.isArray(ci.jobs) && ci.jobs.length === 5 &&
    ci.jobs.map((job) => job?.name).sort().join(",") === CI_JOBS.join(",") &&
    ci.jobs.every((job) => job.conclusion === "success"), "ci_5_of_5_required");
  reject(Boolean(deploy) && deploy.serverSha === sha && deploy.clientSha === sha &&
    deploy?.serverStatus === "live" && deploy?.clientStatus === "ready", "deploy_sha_mismatch");
  reject(health?.ready === true && health?.status === 200 && timestamp(health?.checkedAt) &&
    Date.parse(health.checkedAt) >= Date.parse(runStartedAt), "fresh_health_required");
  reject(safety?.reviewed === true && Array.isArray(safety.blockers) && safety.blockers.length === 0,
    "safety_review_required");
  return { go: reasons.length === 0, reasons };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const [evidencePath, corpusPath] = process.argv.slice(2);
    if (!evidencePath || !corpusPath || process.argv.length !== 4) throw new Error("arguments_required");
    const [evidence, corpus] = await Promise.all([
      readFile(evidencePath, "utf8").then(JSON.parse), readFile(corpusPath, "utf8").then(JSON.parse),
    ]);
    const result = verifyAiCertification(evidence, corpus);
    console.log(JSON.stringify({ decision: result.go ? "GO" : "NO-GO", reasons: result.reasons }));
    if (!result.go) process.exitCode = 1;
  } catch {
    console.error("Certification evidence unreadable or invalid");
    process.exitCode = 1;
  }
}
