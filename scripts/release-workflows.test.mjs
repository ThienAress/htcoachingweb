import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

const actionRuntimeContracts = new Map([
  ["actions/checkout", {
    major: 5,
    sha: "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09",
    release: "v5.1.0",
  }],
  ["actions/setup-node", {
    major: 5,
    sha: "a0853c24544627f65ddf259abe73b1d18a591444",
    release: "v5.0.0",
  }],
  ["actions/upload-artifact", {
    major: 6,
    sha: "b7c566a772e6b6bfb58ed0dc250532a479d7789f",
    release: "v6.0.0",
  }],
  ["actions/download-artifact", {
    major: 7,
    sha: "37930b1c2abaa49bbe596cd826c3c89aef350131",
    release: "v7.0.0",
  }],
  ["actions/github-script", {
    major: 8,
    sha: "ed597411d8f924073f98dfc5c65a23a2325f34cd",
    release: "v8.0.0",
  }],
]);

test("official action runtimes are upgraded while application Node remains 22.23.1", async () => {
  const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
  const workflowFiles = (await readdir(workflowsDirectory))
    .filter((file) => file.endsWith(".yml"));
  const workflows = await Promise.all(workflowFiles.map(async (file) => ({
    file,
    source: await read(`.github/workflows/${file}`),
  })));
  let inspectedActions = 0;
  let setupNodeSteps = 0;

  for (const { file, source } of workflows) {
    for (const match of source.matchAll(
      /^\s*(?:-\s*)?uses:\s*(actions\/(?:checkout|setup-node|upload-artifact|download-artifact|github-script))@([^\s#]+)(?:\s+#\s*(\S+))?\s*$/gm,
    )) {
      inspectedActions += 1;
      const [, action, reference, releaseComment] = match;
      const expected = actionRuntimeContracts.get(action);
      const allowedReference = reference === `v${expected.major}` || reference === expected.sha;

      assert.ok(
        allowedReference,
        `${file}: ${action}@${reference} must use v${expected.major} or ${expected.sha}`,
      );
      if (reference === expected.sha) {
        assert.equal(
          releaseComment,
          expected.release,
          `${file}: pinned ${action} must document ${expected.release}`,
        );
      }
    }

    for (const match of source.matchAll(
      /^\s{6}- uses: actions\/setup-node@[^\r\n]+\r?\n\s{8}with:\r?\n((?:\s{10}[^\r\n]+(?:\r?\n|$))+)/gm,
    )) {
      setupNodeSteps += 1;
      const inputs = match[1];
      assert.match(inputs, /^\s{10}node-version-file: \.node-version$/m, `${file}: setup-node must read .node-version`);
      assert.match(inputs, /^\s{10}package-manager-cache: false$/m, `${file}: setup-node automatic cache must stay disabled`);
    }
  }

  assert.equal(inspectedActions, 72, "the action-runtime inventory changed; review the new call site");
  assert.equal(setupNodeSteps, 20, "the setup-node inventory changed; review its Node/cache contract");

  const [nodeVersion, nvmrc, rootPackage] = await Promise.all([
    read(".node-version"),
    read(".nvmrc"),
    read("package.json").then(JSON.parse),
  ]);
  assert.equal(nodeVersion.trim(), "22.23.1");
  assert.equal(nvmrc.trim(), "22.23.1");
  assert.equal(rootPackage.engines?.node, "22.23.1");
});

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

test("staging acceptance maintenance modes are explicit and preserve acceptance as default", async () => {
  const workflow = await read(".github/workflows/staging-acceptance.yml");
  assert.match(workflow, /operation:[\s\S]*default: acceptance/);
  assert.match(workflow, /release_sha:[\s\S]*?required: true/);
  assert.match(workflow, /ci_run_url:[\s\S]*?required: true/);
  assert.match(workflow, /staging_client_deploy_id:[\s\S]*?required: true/);
  assert.match(workflow, /staging_server_deploy_id:[\s\S]*?required: true/);
  for (const operation of [
    "search-cohort-rollback-preflight",
    "search-cohort-rollback-apply",
    "ai-catalog-preflight",
    "ai-catalog-apply",
    "ai-catalog-rollback-preflight",
    "ai-catalog-rollback-apply",
  ]) assert.match(workflow, new RegExp(operation));
  assert.match(workflow, /MIGRATION_TARGET_DATABASE: htcoaching_staging/);
  assert.match(workflow, /STAGING_MAINTENANCE_OUTPUT: \.\.\/artifacts\/staging-maintenance\.json/);
  assert.match(workflow, /STAGING_SEARCH_INDEX_COHORT_EXPECTED_PLAN_DIGEST:/);
  assert.match(workflow, /STAGING_AI_CATALOG_EXPECTED_PLAN_DIGEST:/);
  assert.match(workflow, /CONFIRM_STAGING_SEARCH_INDEX_COHORT_ROLLBACK: "yes"/);
  assert.match(workflow, /CONFIRM_STAGING_AI_CATALOG_ROLLOUT: "yes"/);
  assert.match(workflow, /CONFIRM_STAGING_AI_CATALOG_ROLLBACK: "yes"/);
  assert.match(workflow, /if: \$\{\{ inputs\.operation == 'acceptance'/);
  assert.match(workflow, /data\.head_branch !== "staging"/);
  assert.match(workflow, /data\.head_repository\?\.full_name !== context\.repo\.owner \+ "\/" \+ context\.repo\.repo/);
  const inputValidation = workflow.match(
    /- name: Validate operation-specific inputs[\s\S]*?(?=\n      - name: Install server dependencies)/,
  )?.[0];
  assert.ok(inputValidation, "operation-specific input validation step is missing");
  assert.match(inputValidation, /STAGING_MAINTENANCE_OPERATION/);
  assert.match(inputValidation, /ROLLBACK_CLIENT_DEPLOY_ID/);
  assert.match(inputValidation, /ROLLBACK_SERVER_DEPLOY_ID/);
  assert.match(inputValidation, /Acceptance requires both production rollback deploy IDs/);
  const deployVerification = workflow.match(
    /- name: Verify exact Netlify and Render staging deploys[\s\S]*?(?=\n      - name: Run reviewed staging catalog maintenance)/,
  )?.[0];
  assert.ok(deployVerification, "staging deploy verification step is missing");
  assert.doesNotMatch(deployVerification, /^\s+if:/m);
  assert.match(deployVerification, /STAGING_CLIENT_DEPLOY_ID/);
  assert.match(deployVerification, /STAGING_SERVER_DEPLOY_ID/);
  const maintenanceReverification = workflow.match(
    /- name: Reverify deploy identity after staging catalog maintenance[\s\S]*?(?=\n      - name: Run write-enabled staging acceptance)/,
  )?.[0];
  assert.ok(maintenanceReverification, "post-maintenance deploy verification step is missing");
  assert.match(maintenanceReverification, /inputs\.operation != 'acceptance'/);
  assert.match(maintenanceReverification, /npm run verify:staging-deploys/);
  assert.match(
    maintenanceReverification,
    /DEPLOY_IDENTITY_OUTPUT: artifacts\/staging-deploy-identity-post-maintenance\.json/,
  );
  assert.match(workflow, /path: \|[\s\S]*artifacts\/staging-maintenance\.json[\s\S]*artifacts\/staging-deploy-identity\.json[\s\S]*artifacts\/staging-deploy-identity-post-maintenance\.json/);
});

test("Netlify staging always builds an exact release SHA", async () => {
  const config = await read("netlify.toml");
  const staging = config.match(
    /\[context\.staging\]\r?\n([\s\S]*?)(?=\r?\n\[|$)/,
  )?.[1];

  assert.ok(staging, "netlify.toml must define the exact staging deploy context");
  assert.match(staging, /^\s*ignore = "exit 1"$/m);
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
    assert.match(versionComment || "", /^v\d+\.\d+\.\d+$/, `${action} must retain its release comment`);
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

test("AC-009 docs keep pre-cohort readiness outside the exact-nine proof", async () => {
  const [adr, rollout, releaseSpec, runbook] = await Promise.all([
    read("docs/architecture/adr/0001-bind-staging-ai-acceptance-to-a-runtime-cohort.md"),
    read("docs/specs/knowledge-base-embedding-staging-rollout.md"),
    read("docs/specs/release-promotion-and-staging-acceptance.md"),
    read("docs/operations/runbooks/release-promotion.md"),
  ]);

  for (const source of [adr, rollout, releaseSpec, runbook]) {
    assert.match(source, /`pre-cohort readiness`/);
    assert.match(source, /non-certifying barrier/);
    assert.match(source, /hard deadline/);
    assert.match(source, /zero\s+fallback delta/);
    assert.match(source, /`metrics-before`/);
    assert.match(source, /exact-nine cohort/);
    assert.match(
      source,
      /readiness[\s\S]{0,180}(?:no field, JTI or\s+receipt|không\s+thêm field\/JTI\/receipt)/i,
    );
  }

  assert.match(adr, /inside the certified metrics window—seven chat attempts and two admin Knowledge/);
  assert.match(rollout, /exact root\s+và variant search/);
  assert.match(releaseSpec, /nine-purpose inventory bên trong certified window/);
  assert.match(runbook, /Trong certified metrics window, bảy chat attempts cùng hai/);
  for (const source of [adr, rollout, releaseSpec, runbook]) {
    assert.match(source, /raw evidence schema v3/i);
    assert.match(source, /release-candidate schema v3/i);
  }
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
