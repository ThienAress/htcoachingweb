import test from "node:test";
import assert from "node:assert/strict";

import {
  validateDeploymentIdentityEvidence,
  validateRenderTopologyEvidence,
  verifyNetlifyDeploy,
  verifyRenderDeploy,
  verifyRenderSingleInstanceTopology,
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

test("Render metrics topology requires one configured and one running instance", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(options.method, "GET");
    calls.push(url);
    if (url.endsWith("/instances")) {
      return response([{ id: "instance-1", createdAt: "2026-09-15T00:00:00.000Z" }]);
    }
    return response({
      id: "srv-123",
      type: "web_service",
      serviceDetails: { numInstances: 1 },
    });
  };

  assert.deepEqual(
    await verifyRenderSingleInstanceTopology({
      serviceId: "srv-123",
      token: "r".repeat(24),
      fetchImpl,
    }),
    { configuredInstances: 1, currentInstances: 1 },
  );
  assert.deepEqual(calls, [
    "https://api.render.com/v1/services/srv-123",
    "https://api.render.com/v1/services/srv-123/instances",
  ]);
});

test("Render metrics topology fails closed for autoscaling or multiple running instances", async () => {
  const scenarios = [
    {
      service: {
        id: "srv-123",
        type: "web_service",
        serviceDetails: { numInstances: 1, autoscaling: { enabled: true, min: 1, max: 2 } },
      },
      instances: [{ id: "instance-1" }],
    },
    {
      service: { id: "srv-123", type: "web_service", serviceDetails: { numInstances: 1 } },
      instances: [{ id: "instance-1" }, { id: "instance-2" }],
    },
  ];

  for (const scenario of scenarios) {
    await assert.rejects(
      verifyRenderSingleInstanceTopology({
        serviceId: "srv-123",
        token: "r".repeat(24),
        fetchImpl: async (url) => response(url.endsWith("/instances")
          ? scenario.instances
          : scenario.service),
      }),
      /single.instance|autoscaling|exactly one/i,
    );
  }
});

test("Render topology artifact is closed, single-instance and bound to the release SHA", () => {
  const evidence = {
    schemaVersion: 1,
    kind: "render-single-instance-topology",
    releaseSha: SHA,
    checkedAt: "2026-09-15T00:00:00.000Z",
    serviceTopology: { configuredInstances: 1, currentInstances: 1 },
  };
  assert.equal(validateRenderTopologyEvidence(evidence, { expectedSha: SHA }), evidence);
  assert.throws(
    () => validateRenderTopologyEvidence({ ...evidence, releaseSha: "b".repeat(40) }, {
      expectedSha: SHA,
    }),
    /does not match expected SHA/,
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
