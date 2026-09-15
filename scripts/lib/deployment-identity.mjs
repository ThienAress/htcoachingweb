const SHA_PATTERN = /^[0-9a-f]{40}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,159}$/i;
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isCanonicalTimestamp = (value) => {
  if (typeof value !== "string") return false;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute, rawSecond,
    , , rawOffsetHour, rawOffsetMinute] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  const second = Number(rawSecond);
  const offsetHour = rawOffsetHour == null ? 0 : Number(rawOffsetHour);
  const offsetMinute = rawOffsetMinute == null ? 0 : Number(rawOffsetMinute);
  if (
    month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 23 || offsetMinute > 59
  ) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth && Number.isFinite(Date.parse(value));
};

const validateInput = ({ id, expectedSha, token, name }) => {
  assert(ID_PATTERN.test(String(id || "")), `${name} id is invalid`);
  assert(SHA_PATTERN.test(String(expectedSha || "")), "Expected SHA is invalid");
  assert(String(token || "").length >= 20, `${name} API token is missing`);
};

const parseJson = async (response, name) => {
  try {
    return await response.json();
  } catch {
    // Upstream JSON exceptions can contain response-body excerpts.
    throw new Error(`${name} API returned invalid JSON`);
  }
};

const readJson = async (response, name) => {
  assert(response.status === 200, `${name} API returned ${response.status}`);
  const payload = await parseJson(response, name);
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

export const validateRenderTopologyEvidence = (
  evidence,
  { expectedSha } = {},
) => {
  assert(
    evidence && typeof evidence === "object" && !Array.isArray(evidence),
    "Render topology evidence is invalid",
  );
  const allowed = new Set([
    "schemaVersion", "kind", "releaseSha", "checkedAt", "serviceTopology",
  ]);
  for (const field of Object.keys(evidence)) {
    assert(allowed.has(field), `Render topology evidence contains unsupported field: ${field}`);
  }
  assert(evidence.schemaVersion === 1, "Unsupported Render topology schemaVersion");
  assert(evidence.kind === "render-single-instance-topology", "Render topology kind is invalid");
  assert(SHA_PATTERN.test(String(evidence.releaseSha || "")), "Render topology SHA is invalid");
  if (expectedSha) {
    assert(evidence.releaseSha === expectedSha, "Render topology evidence does not match expected SHA");
  }
  const checkedAt = new Date(evidence.checkedAt);
  assert(
    Number.isFinite(checkedAt.getTime()) && checkedAt.toISOString() === evidence.checkedAt,
    "Render topology checkedAt is invalid",
  );
  assert(
    evidence.serviceTopology &&
      typeof evidence.serviceTopology === "object" &&
      !Array.isArray(evidence.serviceTopology),
    "Render service topology is invalid",
  );
  assert(
    Object.keys(evidence.serviceTopology).sort().join(",") ===
      "configuredInstances,currentInstances",
    "Render service topology fields are invalid",
  );
  assert(
    evidence.serviceTopology.configuredInstances === 1 &&
      evidence.serviceTopology.currentInstances === 1,
    "Render topology evidence is not single-instance",
  );
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

export const verifyRenderSingleInstanceTopology = async ({
  serviceId,
  token,
  fetchImpl = fetch,
}) => {
  assert(ID_PATTERN.test(String(serviceId || "")), "Render service id is invalid");
  assert(String(token || "").length >= 20, "Render service API token is missing");
  const request = async (suffix, label) => {
    const response = await fetchImpl(
      `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}${suffix}`,
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
    assert(response.status === 200, `${label} API returned ${response.status}`);
    return parseJson(response, label);
  };

  const service = await request("", "Render service");
  assert(service && typeof service === "object" && !Array.isArray(service),
    "Render service payload is invalid");
  assert(service.id === serviceId, "Render topology service id does not match");
  assert(service.type === "web_service", "Render topology target is not a web service");
  const details = service.serviceDetails;
  assert(details && typeof details === "object" && !Array.isArray(details),
    "Render service details are invalid");
  assert(details.autoscaling == null || details.autoscaling.enabled === false,
    "Render autoscaling must be disabled for process-local metrics");
  assert(details.numInstances === 1,
    "Render metrics topology must configure a single instance");

  const instances = await request("/instances", "Render instances");
  assert(instances !== null, "Render running-instance inventory is unavailable");
  assert(Array.isArray(instances), "Render instances payload is invalid");
  for (const instance of instances) {
    assert(
      instance && typeof instance === "object" && !Array.isArray(instance) &&
        typeof instance.id === "string" && ID_PATTERN.test(instance.id) &&
        isCanonicalTimestamp(instance.createdAt),
      "Render instance record is invalid",
    );
  }
  assert(instances.length === 1,
    "Render metrics topology must have exactly one running instance");
  return { configuredInstances: details.numInstances, currentInstances: instances.length };
};
