import test from "node:test";
import assert from "node:assert/strict";

import {
  validateDeploymentIdentityEvidence,
  verifyNetlifyDeploy,
  verifyRenderDeploy,
} from "./lib/deployment-identity.mjs";

const SHA = "a".repeat(40);
const response = (payload, status = 200) => ({
  status,
  json: async () => payload,
});

test("Netlify deploy identity must be ready and match the exact commit", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(options.method, "GET");
    assert.match(url, /\/sites\/site-123\/deploys\/deploy-456$/);
    return response({
      id: "deploy-456",
      site_id: "site-123",
      commit_ref: SHA,
      state: "ready",
    });
  };
  assert.deepEqual(
    await verifyNetlifyDeploy({
      siteId: "site-123",
      deployId: "deploy-456",
      expectedSha: SHA,
      token: "n".repeat(24),
      fetchImpl,
    }),
    { provider: "netlify", deployId: "deploy-456", sha: SHA, state: "ready" },
  );
});

test("Render deploy identity must be live and match the exact commit", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(options.method, "GET");
    assert.match(url, /\/services\/srv-123\/deploys\/dep-456$/);
    return response({
      id: "dep-456",
      status: "live",
      commit: { id: SHA },
    });
  };
  assert.deepEqual(
    await verifyRenderDeploy({
      serviceId: "srv-123",
      deployId: "dep-456",
      expectedSha: SHA,
      token: "r".repeat(24),
      fetchImpl,
    }),
    { provider: "render", deployId: "dep-456", sha: SHA, state: "live" },
  );
});

test("provider deploy verification fails closed on commit drift", async () => {
  await assert.rejects(
    verifyNetlifyDeploy({
      siteId: "site-123",
      deployId: "deploy-456",
      expectedSha: SHA,
      token: "n".repeat(24),
      fetchImpl: async () =>
        response({
          id: "deploy-456",
          site_id: "site-123",
          commit_ref: "b".repeat(40),
          state: "ready",
        }),
    }),
    /commit does not match/i,
  );
});

const deploymentEvidence = () => ({
    schemaVersion: 1,
    checkedAt: "2026-08-24T08:00:00.000Z",
    sha: SHA,
    client: { provider: "netlify", deployId: "deploy-456", sha: SHA, state: "ready" },
    server: { provider: "render", deployId: "dep-456", sha: SHA, state: "live" },
});

test("deployment identity artifact accepts exact verified provider states", () => {
  const evidence = deploymentEvidence();
  assert.equal(validateDeploymentIdentityEvidence(evidence, { expectedSha: SHA }), evidence);
});

test("deployment identity artifact rejects secret-adjacent extra fields", () => {
  assert.throws(
    () => validateDeploymentIdentityEvidence({ ...deploymentEvidence(), apiToken: "hidden" }),
    /unsupported field/,
  );
});

test("deployment identity artifact rejects an unverified provider state", () => {
  const evidence = deploymentEvidence();
  assert.throws(
    () =>
      validateDeploymentIdentityEvidence({
        ...evidence,
        server: { ...evidence.server, state: "building" },
      }),
    /state is invalid/,
  );
});
