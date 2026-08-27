const SHA_PATTERN = /^[0-9a-f]{40}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,159}$/i;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const validateInput = ({ id, expectedSha, token, name }) => {
  assert(ID_PATTERN.test(String(id || "")), `${name} id is invalid`);
  assert(SHA_PATTERN.test(String(expectedSha || "")), "Expected SHA is invalid");
  assert(String(token || "").length >= 20, `${name} API token is missing`);
};

const readJson = async (response, name) => {
  assert(response.status === 200, `${name} API returned ${response.status}`);
  const payload = await response.json();
  assert(payload && typeof payload === "object", `${name} deploy payload is invalid`);
  return payload;
};

export const validateDeploymentIdentityEvidence = (
  evidence,
  { expectedSha } = {},
) => {
  assert(
    evidence && typeof evidence === "object" && !Array.isArray(evidence),
    "Deployment identity evidence is invalid",
  );
  const allowed = new Set(["schemaVersion", "checkedAt", "sha", "client", "server"]);
  for (const field of Object.keys(evidence)) {
    assert(allowed.has(field), `Deployment identity evidence contains unsupported field: ${field}`);
  }
  assert(evidence.schemaVersion === 1, "Unsupported deployment identity schemaVersion");
  const checkedAt = new Date(evidence.checkedAt);
  assert(
    Number.isFinite(checkedAt.getTime()) && checkedAt.toISOString() === evidence.checkedAt,
    "Deployment identity checkedAt is invalid",
  );
  assert(SHA_PATTERN.test(String(evidence.sha || "")), "Deployment identity SHA is invalid");
  if (expectedSha) {
    assert(evidence.sha === expectedSha, "Deployment identity evidence does not match expected SHA");
  }
  const identities = [
    [evidence.client, "netlify", "ready"],
    [evidence.server, "render", "live"],
  ];
  for (const [identity, provider, state] of identities) {
    assert(identity && typeof identity === "object", `${provider} identity is invalid`);
    assert(
      Object.keys(identity).sort().join(",") === "deployId,provider,sha,state",
      `${provider} identity fields are invalid`,
    );
    assert(identity.provider === provider, `${provider} identity provider is invalid`);
    assert(ID_PATTERN.test(String(identity.deployId || "")), `${provider} deploy id is invalid`);
    assert(identity.sha === evidence.sha, `${provider} deploy SHA does not match`);
    assert(identity.state === state, `${provider} deploy state is invalid`);
  }
  return evidence;
};

export const verifyNetlifyDeploy = async ({
  siteId,
  deployId,
  expectedSha,
  token,
  fetchImpl = fetch,
}) => {
  validateInput({ id: siteId, expectedSha, token, name: "Netlify site" });
  validateInput({ id: deployId, expectedSha, token, name: "Netlify deploy" });
  const response = await fetchImpl(
    `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/deploys/${encodeURIComponent(deployId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "htcoaching-release-gate/1.0",
      },
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = await readJson(response, "Netlify");
  assert(payload.id === deployId, "Netlify deploy id does not match");
  assert(payload.site_id === siteId, "Netlify site id does not match");
  assert(payload.commit_ref === expectedSha, "Netlify deploy commit does not match");
  assert(payload.state === "ready", "Netlify deploy is not ready");
  return { provider: "netlify", deployId, sha: expectedSha, state: payload.state };
};

export const verifyRenderDeploy = async ({
  serviceId,
  deployId,
  expectedSha,
  token,
  fetchImpl = fetch,
}) => {
  validateInput({ id: serviceId, expectedSha, token, name: "Render service" });
  validateInput({ id: deployId, expectedSha, token, name: "Render deploy" });
  const response = await fetchImpl(
    `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys/${encodeURIComponent(deployId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "htcoaching-release-gate/1.0",
      },
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = await readJson(response, "Render");
  assert(payload.id === deployId, "Render deploy id does not match");
  assert(payload.commit?.id === expectedSha, "Render deploy commit does not match");
  assert(payload.status === "live", "Render deploy is not live");
  return { provider: "render", deployId, sha: expectedSha, state: payload.status };
};
