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
  assert.match(safety, /const STAGING_DATABASE = "htcoaching_staging"/);
  assert.match(safety, /STAGING_OPERATION_DATABASE_REQUIRED/);
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
