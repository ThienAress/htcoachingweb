import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  verifyNetlifyDeploy,
  verifyRenderDeploy,
  verifyRenderSingleInstanceTopology,
} from "./lib/deployment-identity.mjs";

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const main = async () => {
  const sha = required("RELEASE_SHA").toLowerCase();
  const renderToken = required("RENDER_API_KEY");
  const renderServiceId = required("RENDER_STAGING_SERVICE_ID");
  const topologyOutput = String(process.env.RENDER_TOPOLOGY_OUTPUT || "").trim();
  const [client, server, serviceTopology] = await Promise.all([
    verifyNetlifyDeploy({
      siteId: required("NETLIFY_STAGING_SITE_ID"),
      deployId: required("STAGING_CLIENT_DEPLOY_ID"),
      expectedSha: sha,
      token: required("NETLIFY_AUTH_TOKEN"),
    }),
    verifyRenderDeploy({
      serviceId: renderServiceId,
      deployId: required("STAGING_SERVER_DEPLOY_ID"),
      expectedSha: sha,
      token: renderToken,
    }),
    ...(topologyOutput
      ? [verifyRenderSingleInstanceTopology({ serviceId: renderServiceId, token: renderToken })]
      : [Promise.resolve(null)]),
  ]);
  const checkedAt = new Date().toISOString();
  const evidence = {
    schemaVersion: 1,
    checkedAt,
    sha,
    client,
    server,
  };
  const outputPath = path.resolve(required("DEPLOY_IDENTITY_OUTPUT"));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  if (topologyOutput) {
    const topologyPath = path.resolve(topologyOutput);
    await mkdir(path.dirname(topologyPath), { recursive: true });
    await writeFile(topologyPath, `${JSON.stringify({
      schemaVersion: 1,
      kind: "render-single-instance-topology",
      releaseSha: sha,
      checkedAt,
      serviceTopology,
    }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }
  process.stdout.write(
    `${JSON.stringify({ success: true, sha, providers: [client.provider, server.provider] })}\n`,
  );
};

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ success: false, error: error.message })}\n`,
  );
  process.exitCode = 1;
});
