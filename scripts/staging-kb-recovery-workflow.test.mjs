import fs from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

test("KB recovery archives and downloads verified proof before any deletion", async () => {
  const workflow = await fs.readFile(new URL("../.github/workflows/staging-ai-recovery.yml", import.meta.url), "utf8");
  const steps = [
    "Verify registered completed KB failure without database writes",
    "Archive KB proof before deletion",
    "Download immutable KB proof before deletion",
    "Verify immutable KB archive provenance",
    "Recover exact AC-009 synthetic residue",
  ].map(name => workflow.indexOf(`- name: ${name}`));
  assert.ok(steps.every((position, index) => position >= 0 && (!index || position > steps[index - 1])));
  assert.match(workflow, /data\.workflow_run\?\.head_sha !== context\.sha/);
  assert.match(workflow, /kbFailureProofDigest\(original\) !== kbFailureProofDigest\(archived\)/);
  assert.match(workflow, /steps\.kb-archive-provenance\.outcome == 'success'/);
  assert.match(workflow, /STAGING_AI_KB_FAILURE_EVIDENCE:.*\.\.\/artifacts\/kb-archived/);
});
