const APPROVED_CLIENT_ORIGIN =
  "https://staging--htcoachingweb.netlify.app";
const APPROVED_API_ORIGIN = "https://htcoachingweb-staging.onrender.com";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const asApprovedOrigin = (value, approved, name) => {
  const origin = new URL(String(value || approved)).origin;
  assert(origin === approved, `${name} is not the approved staging origin`);
  return origin;
};

const configuration = () => {
  assert(
    process.env.ALLOW_REMOTE_STAGING_HEALTH === "true",
    "Set ALLOW_REMOTE_STAGING_HEALTH=true after confirming the staging targets",
  );
  return {
    clientOrigin: asApprovedOrigin(
      process.env.STAGING_CLIENT_URL,
      APPROVED_CLIENT_ORIGIN,
      "STAGING_CLIENT_URL",
    ),
    apiOrigin: asApprovedOrigin(
      process.env.STAGING_API_URL,
      APPROVED_API_ORIGIN,
      "STAGING_API_URL",
    ),
  };
};

const fetchTimed = async (url, options = {}) => {
  const startedAt = performance.now();
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: "*/*",
      "User-Agent": "htcoaching-staging-health/1.0",
      ...options.headers,
    },
    ...options,
  });
  return {
    response,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
  };
};

const main = async () => {
  const config = configuration();
  const checks = [];
  const check = async (name, action) => {
    const result = await action();
    checks.push({ name, status: "passed", ...result });
  };

  await check("client document", async () => {
    const { response, durationMs } = await fetchTimed(config.clientOrigin);
    assert(response.status === 200, `Client returned ${response.status}`);
    assert(
      response.headers.get("content-type")?.includes("text/html"),
      "Client did not return HTML",
    );
    const html = await response.text();
    assert(html.includes('id="root"'), "Client HTML is missing the React root");
    return { httpStatus: response.status, durationMs };
  });

  await check("web manifest", async () => {
    const { response, durationMs } = await fetchTimed(
      `${config.clientOrigin}/favicon/site.webmanifest`,
    );
    assert(response.status === 200, `Manifest returned ${response.status}`);
    assert(
      response.headers.get("content-type")?.includes("manifest+json"),
      "Manifest MIME type is invalid",
    );
    const manifest = await response.json();
    assert(manifest.name === "HTCOACHING", "Manifest name is invalid");
    assert(
      Array.isArray(manifest.icons) && manifest.icons.length >= 2,
      "Manifest icons are missing",
    );
    return { httpStatus: response.status, durationMs };
  });

  for (const [name, path, validateBody] of [
    ["api liveness", "/api/ops/health/live"],
    ["api readiness", "/api/ops/health/ready"],
    ["blog public API", "/api/blog?limit=1"],
    [
      "recipe public API",
      "/api/recipes?limit=1",
      (body) =>
        Array.isArray(body.data) &&
        Number.isInteger(body.pagination?.total) &&
        body.pagination?.limit === 1,
    ],
    [
      "recipe taxonomy API",
      "/api/recipes/categories",
      (body) => Array.isArray(body.data),
    ],
  ]) {
    await check(name, async () => {
      const { response, durationMs } = await fetchTimed(
        `${config.apiOrigin}${path}`,
        { headers: { Accept: "application/json" } },
      );
      assert(response.status === 200, `${name} returned ${response.status}`);
      assert(
        response.headers.get("content-type")?.includes("application/json"),
        `${name} did not return JSON`,
      );
      const body = await response.json();
      assert(body?.success === true, name + " returned an unsuccessful payload");
      assert(
        !validateBody || validateBody(body),
        name + " returned an invalid response contract",
      );
      return { httpStatus: response.status, durationMs };
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        success: true,
        checkedAt: new Date().toISOString(),
        checks,
      },
      null,
      2,
    )}\n`,
  );
};

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ success: false, error: error.message })}\n`,
  );
  process.exitCode = 1;
});
