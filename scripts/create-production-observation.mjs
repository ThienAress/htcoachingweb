import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  verifyNetlifyDeploy,
  verifyRenderDeploy,
} from "./lib/deployment-identity.mjs";
import {
  evaluatePostDeployEvidence,
  validateReleaseCandidate,
} from "./lib/release-evidence.mjs";

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const main = async () => {
  const candidate = JSON.parse(
    await readFile(path.resolve(required("RELEASE_CANDIDATE_MANIFEST")), "utf8"),
  );
  validateReleaseCandidate(candidate);
  const sha = candidate.release.sha;
  const [client, server] = await Promise.all([
    verifyNetlifyDeploy({
      siteId: required("NETLIFY_PRODUCTION_SITE_ID"),
      deployId: required("PRODUCTION_CLIENT_DEPLOY_ID"),
      expectedSha: sha,
      token: required("NETLIFY_AUTH_TOKEN"),
    }),
    verifyRenderDeploy({
      serviceId: required("RENDER_PRODUCTION_SERVICE_ID"),
      deployId: required("PRODUCTION_SERVER_DEPLOY_ID"),
      expectedSha: sha,
      token: required("RENDER_API_KEY"),
    }),
  ]);
  const evidence = {
    schemaVersion: 1,
    kind: "production-observation",
    candidateSha: sha,
    production: {
      client: { deployId: client.deployId, sha: client.sha },
      server: { deployId: server.deployId, sha: server.sha },
    },
    observation: {
      startedAt: required("OBSERVATION_STARTED_AT"),
      endedAt: new Date().toISOString(),
      monitorRunUrl: required("PRODUCTION_MONITOR_RUN_URL"),
      status: required("PRODUCTION_MONITOR_STATUS"),
      decision: required("PRODUCTION_RELEASE_DECISION"),
    },
  };
  const result = evaluatePostDeployEvidence(evidence, candidate);
  if (!result.ready) {
    throw new Error(`Post-deploy evidence is blocked: ${result.blockers.join(", ")}`);
  }
  const outputPath = path.resolve(required("PRODUCTION_OBSERVATION_OUTPUT"));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ ready: false, error: error.message })}\n`,
  );
  process.exitCode = 1;
});
