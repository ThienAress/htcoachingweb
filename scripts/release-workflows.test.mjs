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
  ]) assert.match(aiStep, required);
  assert.doesNotMatch(aiStep, /ADMIN_EMAIL:/);
  assert.doesNotMatch(workflow, /RENDER_TOPOLOGY_OUTPUT:/);
  assert.doesNotMatch(workflow, /STAGING_RENDER_TOPOLOGY_EVIDENCE:/);
  assert.match(workflow, /staging-deploy-identity-post-ai\.json/);
  for (const requiredCandidateEvidence of [
    /STAGING_AI_ACCEPTANCE_EVIDENCE: artifacts\/staging-ai-acceptance\.json/,
    /STAGING_DEPLOY_IDENTITY_POST_AI_EVIDENCE: artifacts\/staging-deploy-identity-post-ai\.json/,
  ]) assert.match(workflow, requiredCandidateEvidence);
  assert.match(workflow, /getWorkflow\(/);
  assert.match(workflow, /\.github\/workflows\/ci\.yml/);
  assert.match(safety, /const STAGING_DATABASE = "htcoaching_staging"/);
  assert.match(safety, /STAGING_OPERATION_DATABASE_REQUIRED/);
});

test("legacy AC-009 recovery is manual, staging-only and retains provider proof", async () => {
  const workflow = await read(".github/workflows/staging-ai-recovery.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /repository_dispatch:/);
  assert.match(workflow, /environment: staging-live-acceptance/);
  assert.match(workflow, /group: staging-live-acceptance/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /run-id: \$\{\{ inputs\.acceptance_run_id \}\}/);
  assert.match(workflow, /release-candidate-\$\{\{ inputs\.acceptance_run_id \}\}/);
  assert.match(workflow, /prior_recovery_run_id:/);
  assert.match(workflow, /prior_recovery_run_attempt:/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /context\.ref !== "refs\/heads\/staging"/);
  assert.match(workflow, /data\.head_branch !== "staging"/);
  assert.match(workflow, /trustedWorkflowPaths\.has\(workflow\.path\)/);
  assert.match(workflow, /\.github\/workflows\/staging-ai-recovery\.yml/);
  assert.match(workflow, /\.github\/workflows\/staging-security\.yml/);
  assert.match(workflow, /data\.run_attempt !== attempt/);
  assert.match(workflow, /staging-ai-recovery-\$\{\{ inputs\.prior_recovery_run_id \}\}-\$\{\{ inputs\.prior_recovery_run_attempt \}\}/);
  assert.match(workflow, /path: artifacts\/prior/);
  assert.match(workflow, /STAGING_AI_FIXTURE_REJECTION_EVIDENCE: \$\{\{ inputs\.fixture_request_id != ''/);
  assert.match(workflow, /verify:acceptance:staging:ai:fixture-rejection/);
  assert.match(workflow, /RENDER_API_KEY: \$\{\{ secrets\.RENDER_API_KEY \}\}/);
  assert.match(workflow, /STAGING_AI_FIXTURE_REJECTION_EVIDENCE:/);
  assert.match(workflow, /CONFIRM_STAGING_AI_ACCEPTANCE_RECOVERY: "yes"/);
  assert.match(workflow, /MONGO_URI: \$\{\{ secrets\.STAGING_MONGO_URI \}\}/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /staging-ai-recovery-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(workflow, /path: artifacts\/recovery\/\*\.json/);
  assert.doesNotMatch(workflow, /production-approval|PRODUCTION_MONGO|production write/i);
});

test("AC-009 recovery accepts journal v2 incidents without manufacturing legacy provider proof", async () => {
  const workflow = await read(".github/workflows/staging-ai-recovery.yml");
  const fixtureInputs = [...workflow.matchAll(
    /fixture_request_id:\r?\n\s+description: Optional exact Render application request ID for a legacy rejected fixture POST\r?\n\s+required: false/g,
  )];
  assert.equal(fixtureInputs.length, 2, "workflow_dispatch and workflow_call must both make legacy proof optional");
  assert.match(
    workflow,
    /if: \$\{\{ inputs\.prior_recovery_run_id == '' && inputs\.fixture_request_id != '' \}\}/,
  );
  assert.match(
    workflow,
    /STAGING_AI_FIXTURE_REJECTION_EVIDENCE: \$\{\{ inputs\.fixture_request_id != '' && inputs\.prior_recovery_run_id == ''/,
  );
});

test("registered staging monitor dispatch can invoke the same-commit AC-009 recovery", async () => {
  const [monitor, recovery] = await Promise.all([
    read(".github/workflows/staging-security.yml"),
    read(".github/workflows/staging-ai-recovery.yml"),
  ]);

  assert.match(monitor, /operation:[\s\S]*default: monitor/);
  assert.match(
    monitor,
    /github\.event_name == 'workflow_dispatch' && inputs\.operation == 'recover-ai-residue'/,
  );
  assert.match(monitor, /github\.event_name != 'workflow_dispatch' \|\| inputs\.operation == 'monitor'/);
  assert.match(monitor, /uses: \.\/\.github\/workflows\/staging-ai-recovery\.yml/);
  assert.match(monitor, /acceptance_run_id: \$\{\{ inputs\.recovery_acceptance_run_id \}\}/);
  assert.match(monitor, /release_sha: \$\{\{ inputs\.recovery_release_sha \}\}/);
  assert.match(monitor, /fixture_request_id: \$\{\{ inputs\.recovery_fixture_request_id \}\}/);
  assert.match(monitor, /confirmation: \$\{\{ inputs\.recovery_confirmation \}\}/);
  assert.match(monitor, /secrets: inherit/);
  assert.match(recovery, /workflow_call:/);
  assert.match(recovery, /\.github\/workflows\/staging-security\.yml/);
});

test("staging AI recovery pins every action to an immutable commit", async () => {
  const workflow = await read(".github/workflows/staging-ai-recovery.yml");
  const actionUses = [...workflow.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)(?:\s+#\s*(\S+))?\s*$/gm)];

  assert.ok(actionUses.length > 0, "recovery workflow must use at least one action");
  for (const [, action, versionComment] of actionUses) {
    assert.match(action, /^[^@\s]+@[0-9a-f]{40}$/, `${action} must use a full commit SHA`);
    assert.match(versionComment || "", /^v\d+$/, `${action} must retain its major-version comment`);
  }
  assert.doesNotMatch(workflow, /^\s*(?:-\s*)?uses:\s*[^\s#]+@v\d+/m);
});

test("release runbook retains the AC-009 fixture journal v2 contract", async () => {
  const [runbook, specification] = await Promise.all([
    read("docs/operations/runbooks/release-promotion.md"),
    read("docs/specs/knowledge-base-embedding-staging-rollout.md"),
  ]);

  for (const contract of ["terminal/created", "terminal/rejected", "KNOWLEDGE_QUERY_SENSITIVE"]) {
    assert.match(runbook, new RegExp(contract));
    assert.match(specification, new RegExp(contract));
  }
  assert.match(runbook, /Journal v1 legacy `pending` chỉ dùng ngoại lệ manual/);
  assert.match(runbook, /Với journal v2 terminal, bỏ hẳn input legacy/);
  assert.match(specification, /Manual recovery cho journal v2 terminal/);
  assert.doesNotMatch(runbook, /CAS journal sang `settled`/);
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
