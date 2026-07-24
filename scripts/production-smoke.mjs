import {
  CANONICAL_CLIENT_ORIGIN,
  assert,
  fetchTimed,
  productionTargets,
  retryReadOnlyOperation,
  validateGoogleOAuthRedirect,
} from "./lib/production-monitoring.mjs";

const jsonCheck = async (url, name, validate = () => true) => {
  const { response, durationMs } = await fetchTimed(url, {
    headers: { Accept: "application/json" },
  });
  assert(response.status === 200, name + " returned " + response.status);
  assert(
    response.headers.get("content-type")?.includes("application/json"),
    name + " did not return JSON",
  );
  const body = await response.json();
  assert(body?.success === true, name + " returned an unsuccessful payload");
  assert(validate(body), name + " returned an invalid response contract");
  return { body, durationMs, httpStatus: response.status };
};

const main = async () => {
  assert(
    process.env.ALLOW_REMOTE_PRODUCTION_SMOKE === "true",
    "Set ALLOW_REMOTE_PRODUCTION_SMOKE=true after confirming production targets",
  );
  const targets = productionTargets();
  const checks = [];
  const record = (name, result) => {
    checks.push({ name, status: "passed", ...result });
  };

  const documentResult = await fetchTimed(targets.clientOrigin);
  assert(
    documentResult.response.status === 200,
    "Client returned " + documentResult.response.status,
  );
  assert(
    documentResult.response.headers.get("content-type")?.includes("text/html"),
    "Client did not return HTML",
  );
  const html = await documentResult.response.text();
  assert(html.includes('id="root"'), "Client HTML is missing the React root");
  record("client document", {
    httpStatus: documentResult.response.status,
    durationMs: documentResult.durationMs,
  });

  const manifestResult = await fetchTimed(
    targets.clientOrigin + "/favicon/site.webmanifest",
  );
  assert(
    manifestResult.response.status === 200,
    "Manifest returned " + manifestResult.response.status,
  );
  assert(
    manifestResult.response.headers
      .get("content-type")
      ?.includes("manifest+json"),
    "Manifest MIME type is invalid",
  );
  const manifest = await manifestResult.response.json();
  assert(manifest.name === "HTCOACHING", "Manifest name is invalid");
  assert(
    Array.isArray(manifest.icons) && manifest.icons.length >= 2,
    "Manifest icons are missing",
  );
  record("web manifest", {
    httpStatus: manifestResult.response.status,
    durationMs: manifestResult.durationMs,
  });

  for (const [name, path] of [
    ["api liveness", "/api/ops/health/live"],
    ["api readiness", "/api/ops/health/ready"],
  ]) {
    const result = await retryReadOnlyOperation(
      () => jsonCheck(targets.apiOrigin + path, name),
      {
        onRetry: (error, attempt) => {
          process.stderr.write(
            `[production-smoke] ${name} attempt ${attempt} failed: ${error.message}; retrying\n`,
          );
        },
      },
    );
    record(name, { httpStatus: 200, durationMs: result.durationMs });
  }

  const oauthResult = await fetchTimed(
    targets.apiOrigin +
      "/api/auth/google?client_url=" +
      encodeURIComponent(targets.clientOrigin),
  );
  assert(
    oauthResult.response.status >= 300 &&
      oauthResult.response.status < 400,
    "Google OAuth start returned " + oauthResult.response.status,
  );
  validateGoogleOAuthRedirect(oauthResult.response.headers.get("location"));
  record("Google OAuth topology", {
    httpStatus: oauthResult.response.status,
    durationMs: oauthResult.durationMs,
  });
  const blog = await jsonCheck(
    targets.apiOrigin + "/api/blog?limit=1",
    "blog public API",
    (body) => Array.isArray(body.data),
  );
  record("blog public API", { httpStatus: 200, durationMs: blog.durationMs });

  const recipes = await jsonCheck(
    targets.apiOrigin + "/api/recipes?limit=1",
    "recipe public API",
    (body) =>
      Array.isArray(body.data) &&
      Number.isInteger(body.pagination?.total) &&
      body.pagination?.limit === 1,
  );
  record("recipe public API", {
    httpStatus: 200,
    durationMs: recipes.durationMs,
  });

  const taxonomy = await jsonCheck(
    targets.apiOrigin + "/api/recipes/categories",
    "recipe taxonomy API",
    (body) => Array.isArray(body.data),
  );
  record("recipe taxonomy API", {
    httpStatus: 200,
    durationMs: taxonomy.durationMs,
  });

  const firstBlog = blog.body.data[0];
  if (firstBlog?.slug) {
    const detail = await jsonCheck(
      targets.apiOrigin + "/api/blog/" + encodeURIComponent(firstBlog.slug),
      "blog detail API",
      (body) => body.data?.slug === firstBlog.slug,
    );
    record("blog detail API", {
      httpStatus: 200,
      durationMs: detail.durationMs,
    });
  }

  const firstRecipe = recipes.body.data[0];
  if (firstRecipe?.slug) {
    const detail = await jsonCheck(
      targets.apiOrigin +
        "/api/recipes/detail/" +
        encodeURIComponent(firstRecipe.slug),
      "recipe detail API",
      (body) => body.data?.slug === firstRecipe.slug,
    );
    record("recipe detail API", {
      httpStatus: 200,
      durationMs: detail.durationMs,
    });
  }

  const sitemapResult = await fetchTimed(targets.clientOrigin + "/sitemap.xml");
  assert(
    sitemapResult.response.status === 200,
    "Sitemap returned " + sitemapResult.response.status,
  );
  const sitemap = await sitemapResult.response.text();
  assert(sitemap.includes("<urlset"), "Sitemap XML is invalid");
  for (const path of ["/blog", "/cong-thuc-nau-an"]) {
    assert(
      sitemap.includes("<loc>" + CANONICAL_CLIENT_ORIGIN + path + "</loc>"),
      "Sitemap is missing " + path,
    );
  }
  for (const [prefix, item] of [
    ["/blog/", firstBlog],
    ["/cong-thuc-nau-an/", firstRecipe],
  ]) {
    if (item?.slug) {
      assert(
        sitemap.includes(
          "<loc>" + CANONICAL_CLIENT_ORIGIN + prefix + item.slug + "</loc>",
        ),
        "Sitemap is missing the current " + prefix + " detail route",
      );
    }
  }
  record("dynamic sitemap", {
    httpStatus: sitemapResult.response.status,
    durationMs: sitemapResult.durationMs,
  });

  process.stdout.write(
    JSON.stringify(
      { success: true, checkedAt: new Date().toISOString(), checks },
      null,
      2,
    ) + "\n",
  );
};

main().catch((error) => {
  process.stderr.write(
    JSON.stringify({ success: false, error: error.message }) + "\n",
  );
  process.exitCode = 1;
});
