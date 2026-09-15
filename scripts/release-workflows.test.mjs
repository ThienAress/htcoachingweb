import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("staging live acceptance is explicitly write-enabled only behind staging locks", async () => {
  const [workflow, safety] = await Promise.all([
    read(".github/workflows/staging-acceptance.yml"),
    read("server/src/config/stagingOperationSafety.js"),
  ]);
  assert.match(workflow, /environment: staging-live-acceptance/);
  assert.match(workflow, /APP_ENV: staging/);
  assert.match(workflow, /CONFIRM_STAGING_ACCEPTANCE: "yes"/);
  assert.match(workflow, /STAGING_ACCEPTANCE_OUTPUT:/);
  const aiStep = workflow.match(
    /- name: Run authenticated staging AI acceptance with verified cleanup[\s\S]*?(?=\n      - name: Reverify deploy identity)/,
  )?.[0];
  assert.ok(aiStep, "live AI acceptance step is missing");
  assert.match(workflow, /npm run acceptance:staging:ai/);
  for (const required of [
    /ALLOWED_ORIGINS: https:\/\/staging--htcoachingweb\.netlify\.app/,
    /BACKGROUND_JOBS_ENABLED: "false"/,
    /EMAIL_DELIVERY_MODE: disabled/,
    /F1_RETENTION_ENFORCE: "false"/,
    /CONFIRM_STAGING_AI_ACCEPTANCE: "yes"/,
    /STAGING_AI_ACCEPTANCE_OUTPUT:/,
    /STAGING_AI_ACCEPTANCE_RECOVERY_OUTPUT:/,
    /STAGING_AI_ACCEPTANCE_ENABLED: "true"/,
    /EXPECTED_KB_EMBEDDING_VERSION: gemini-embedding-2:768:question-answering-v1/,
    /STAGING_RENDER_TOPOLOGY_EVIDENCE:/,
  ]) assert.match(aiStep, required);
  assert.match(workflow, /RENDER_TOPOLOGY_OUTPUT: artifacts\/staging-render-topology\.json/);
  assert.match(workflow, /RENDER_TOPOLOGY_OUTPUT: artifacts\/staging-render-topology-post-ai\.json/);
  assert.match(workflow, /staging-deploy-identity-post-ai\.json/);
  for (const requiredCandidateEvidence of [
    /STAGING_AI_ACCEPTANCE_EVIDENCE: artifacts\/staging-ai-acceptance\.json/,
    /STAGING_DEPLOY_IDENTITY_POST_AI_EVIDENCE: artifacts\/staging-deploy-identity-post-ai\.json/,
    /STAGING_RENDER_TOPOLOGY_EVIDENCE: artifacts\/staging-render-topology\.json/,
    /STAGING_RENDER_TOPOLOGY_POST_AI_EVIDENCE: artifacts\/staging-render-topology-post-ai\.json/,
  ]) assert.match(workflow, requiredCandidateEvidence);
  assert.match(workflow, /getWorkflow\(/);
  assert.match(workflow, /\.github\/workflows\/ci\.yml/);
  assert.match(safety, /const STAGING_DATABASE = "htcoaching_staging"/);
  assert.match(safety, /STAGING_OPERATION_DATABASE_REQUIRED/);
});

test("staging acceptance derives deposit amount from the canonical policy", async () => {
  const source = await read("server/src/scripts/stagingAcceptance.js");

  assert.match(source, /import \{ DEPOSIT_POLICY \} from "\.\.\/constants\/depositPolicy\.js";/);
  assert.match(source, /const amount = DEPOSIT_POLICY\.minAmount;/);
  assert.doesNotMatch(source, /const amount = 5000;/);
});

test("production promotion and observation workflows never run write acceptance", async () => {
  const source = await Promise.all([
    read(".github/workflows/release-promotion-gate.yml"),
    read(".github/workflows/post-deploy-observation.yml"),
  ]).then((parts) => parts.join("\n"));
  assert.doesNotMatch(source, /acceptance:staging|CONFIRM_STAGING|MONGO_URI/);
  assert.match(source, /environment: production-approval/);
  assert.match(source, /environment: production-observation/);
  assert.match(source, /--mode=candidate/);
  assert.match(source, /--expected-sha=/);
  assert.match(source, /--mode=post-deploy/);
});

test("pre-deploy and ship point to the canonical promotion policy", async () => {
  const [preDeploy, ship] = await Promise.all([
    read(".agents/skills/pre-deploy/SKILL.md"),
    read(".agents/skills/ship/SKILL.md"),
  ]);
  for (const skill of [preDeploy, ship]) {
    assert.match(skill, /\.agents\/rules\/workflow\/release-promotion\.md/);
    assert.match(skill, /docs\/operations\/runbooks\/release-promotion\.md/);
  }
});
