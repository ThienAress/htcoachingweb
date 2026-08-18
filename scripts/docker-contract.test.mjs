import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readRepoFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("backend image pins its runtime and runs non-root", async () => {
  const [dockerfile, dockerignore] = await Promise.all([
    readRepoFile("server/Dockerfile"),
    readRepoFile(".dockerignore"),
  ]);

  const pinnedBase =
    "node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3";

  assert.equal(
    dockerfile.split(pinnedBase).length - 1,
    2,
    "dependency and runtime stages must use the same immutable base",
  );
  assert.match(dockerfile, /npm ci --omit=dev/);
  assert.match(dockerfile, /\/opt\/yarn-v\*/);
  assert.match(dockerfile, /COPY --chown=node:node/);
  assert.doesNotMatch(dockerfile, /chown -R node:node \/app\s*$/m);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /^STOPSIGNAL SIGTERM$/m);
  assert.match(dockerfile, /\/api\/ops\/health\/live/);
  assert.match(dockerfile, /^CMD \["node", "server\.js"\]$/m);
  assert.match(dockerfile, /^WORKDIR \/app\/server$/m);
  assert.match(
    dockerfile,
    /\.agents\/upstream-skills\/watchlist\.json .*snapshot\.json \/app\/\.agents\/upstream-skills\//,
  );
  assert.doesNotMatch(dockerfile, /^COPY\s+\.\s+\.$/m);

  assert.match(dockerignore, /^\*\*$/m);
  assert.match(dockerignore, /^!server\/src\/\*\*$/m);
  assert.match(dockerignore, /^server\/src\/\*\*\/__tests__\/\*\*$/m);
  assert.match(dockerignore, /^server\/src\/migrations\/\*\*$/m);
  assert.match(dockerignore, /^server\/src\/scripts\/\*\*$/m);
  assert.match(dockerignore, /^!\.agents\/upstream-skills\/watchlist\.json$/m);
  assert.match(dockerignore, /^!\.agents\/upstream-skills\/snapshot\.json$/m);
  assert.doesNotMatch(dockerignore, /^!server\/\.env/m);
});

test("Compose keeps Mongo private and disables external side effects", async () => {
  const compose = await readRepoFile("compose.yaml");
  const mongoService = compose.slice(
    compose.indexOf("  mongo:"),
    compose.indexOf("  api:"),
  );

  assert.match(
    mongoService,
    /image: mongo:8\.2\.12-noble@sha256:dc23b0dde2221277b581dd76933f39f8a765fee9dbd99b9deb19184c063c061f/,
  );
  assert.match(mongoService, /mongo_data:\/data\/db/);
  assert.match(mongoService, /mongo_config:\/data\/configdb/);
  assert.doesNotMatch(mongoService, /^\s+ports:/m);

  assert.match(compose, /127\.0\.0\.1:\$\{HTCOACHING_API_PORT:-5000\}:5000/);
  assert.match(compose, /MONGO_URI: mongodb:\/\/mongo:27017\/htcoaching_local/);
  assert.match(compose, /APP_ENV: development/);
  assert.match(compose, /AI_PROVIDER: mock/);
  assert.match(compose, /MEAL_SCAN_PROVIDER: mock/);
  assert.match(compose, /AI_IMAGE_PROVIDER: mock/);
  assert.match(compose, /EMAIL_DELIVERY_MODE: disabled/);
  assert.match(compose, /BACKGROUND_JOBS_ENABLED: "false"/);
  assert.match(compose, /F1_RETENTION_ENFORCE: "false"/);
  assert.match(compose, /condition: service_healthy/);
  assert.match(compose, /\/api\/ops\/health\/ready/);

  assert.doesNotMatch(compose, /htcoachingweb\.onrender\.com/);
  assert.doesNotMatch(compose, /APP_ENV:\s*production/);
  assert.doesNotMatch(compose, /BACKGROUND_JOBS_ENABLED:\s*"?true"?/);
  assert.doesNotMatch(compose, /EMAIL_DELIVERY_MODE:\s*live/);
});

test("Docker CI uses immutable tools and scans an exported image", async () => {
  const workflow = await readRepoFile(".github/workflows/ci.yml");
  const dockerJob = workflow.slice(workflow.indexOf("  docker:"));
  const vulnerabilityReport = dockerJob.slice(
    dockerJob.indexOf("      - name: Report high and critical image vulnerabilities"),
    dockerJob.indexOf("      - name: Reject fixable critical image vulnerabilities"),
  );
  const criticalGate = dockerJob.slice(
    dockerJob.indexOf("      - name: Reject fixable critical image vulnerabilities"),
    dockerJob.indexOf("      - name: Show container logs on failure"),
  );

  assert.match(
    dockerJob,
    /actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/,
  );
  assert.match(
    dockerJob,
    /hadolint\/hadolint@sha256:158cd0184dcaa18bd8ec20b61f4c1cabdf8b32a592d062f57bdcb8e4c1d312e2/,
  );
  assert.match(
    dockerJob,
    /aquasec\/trivy@sha256:cffe3f5161a47a6823fbd23d985795b3ed72a4c806da4c4df16266c02accdd6f/,
  );
  assert.match(dockerJob, /docker compose config --quiet/);
  assert.match(
    dockerJob,
    /docker build --platform linux\/amd64 --file server\/Dockerfile --tag "\$API_IMAGE" \./,
  );
  assert.match(dockerJob, /docker compose up --detach --no-build --wait/);
  assert.match(dockerJob, /docker save/);
  assert.match(
    dockerJob,
    /github\.workspace \}\}\/htcoaching-api\.tar:\/workspace\/htcoaching-api\.tar:ro/,
  );
  assert.match(dockerJob, /--input \/workspace\/htcoaching-api\.tar/);
  assert.match(vulnerabilityReport, /--severity HIGH,CRITICAL --exit-code 0/);
  assert.doesNotMatch(vulnerabilityReport, /--ignore-unfixed/);
  assert.match(
    criticalGate,
    /--ignore-unfixed --severity CRITICAL --exit-code 1/,
  );
  assert.doesNotMatch(dockerJob, /github\.workspace \}\}:\/workspace:ro/);
  assert.match(dockerJob, /docker compose down --volumes --remove-orphans/);
  assert.doesNotMatch(dockerJob, /\/var\/run\/docker\.sock/);
  assert.doesNotMatch(dockerJob, /hadolint\/hadolint-action/);
  assert.doesNotMatch(dockerJob, /docker (?:image )?push/);
  assert.doesNotMatch(dockerJob, /docker\/login-action/);
});
