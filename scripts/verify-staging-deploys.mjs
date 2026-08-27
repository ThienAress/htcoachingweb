import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  verifyNetlifyDeploy,
  verifyRenderDeploy,
} from "./lib/deployment-identity.mjs";

const required = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const main = async () => {
  const sha = required("RELEASE_SHA").toLowerCase();
  const [client, server] = await Promise.all([
    verifyNetlifyDeploy({
      siteId: required("NETLIFY_STAGING_SITE_ID"),
      deployId: required("STAGING_CLIENT_DEPLOY_ID"),
      expectedSha: sha,
      token: required("NETLIFY_AUTH_TOKEN"),
    }),
    verifyRenderDeploy({
      serviceId: required("RENDER_STAGING_SERVICE_ID"),
      deployId: required("STAGING_SERVER_DEPLOY_ID"),
      expectedSha: sha,
      token: required("RENDER_API_KEY"),
    }),
  ]);
  const evidence = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
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
