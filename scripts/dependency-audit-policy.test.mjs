import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { evaluateDependencyAudit } from "./check-dependency-audit.mjs";

test("client and server pin the reviewed patched transitive dependency versions", async () => {
  for (const scope of ["client", "server"]) {
    const manifest = JSON.parse(await readFile(new URL(`../${scope}/package.json`, import.meta.url), "utf8"));
    const lock = JSON.parse(await readFile(new URL(`../${scope}/package-lock.json`, import.meta.url), "utf8"));
    for (const [name, version] of [["proxy-addr", "2.0.8"], ["source-map-js", "1.2.2"]]) {
      assert.equal(manifest.overrides[name], version, `${scope}: ${name} security patch must stay pinned`);
      const copies = Object.entries(lock.packages).filter(([key]) => key.endsWith(`node_modules/${name}`));
      assert.ok(copies.length > 0, `${scope}: ${name} is missing from the lock`);
      for (const [key, entry] of copies) {
        assert.equal(entry.version, version, `${scope}/${key}: affected dependency version`);
        assert.equal(entry.resolved, `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`);
        assert.match(entry.integrity, /^sha512-[A-Za-z0-9+/]+=*$/);
      }
    }
  }
});

const rscAudit = {
  vulnerabilities: {
    "react-router": {
      severity: "high",
      via: [
        {
          severity: "high",
          title: "RSC-only advisory",
          url: "https://github.com/advisories/GHSA-qwww-vcr4-c8h2",
        },
      ],
    },
    "react-router-dom": {
      severity: "high",
      via: ["react-router"],
    },
  },
};

test("client policy waives only the reviewed RSC advisory", () => {
  const result = evaluateDependencyAudit(rscAudit, {
    scope: "client",
    clientRscUsage: [],
  });
  assert.equal(result.success, true);
  assert.equal(result.waivedAdvisories.length, 1);
});

test("client policy rejects the RSC waiver when RSC usage is detected", () => {
  const result = evaluateDependencyAudit(rscAudit, {
    scope: "client",
    clientRscUsage: ["client/src/rsc.js"],
  });
  assert.equal(result.success, false);
  assert.deepEqual(
    result.findings.map((finding) => finding.name),
    ["react-router", "react-router-dom"],
  );
});

test("client policy never waives an unrelated high advisory", () => {
  const result = evaluateDependencyAudit(
    {
      vulnerabilities: {
        postcss: {
          severity: "high",
          via: [
            {
              severity: "high",
              title: "Unrelated advisory",
              url: "https://github.com/advisories/GHSA-example",
            },
          ],
        },
      },
    },
    { scope: "client", clientRscUsage: [] },
  );
  assert.equal(result.success, false);
  assert.equal(result.findings[0].name, "postcss");
});

test("client policy rejects an unknown transitive high advisory", () => {
  const result = evaluateDependencyAudit(
    {
      vulnerabilities: {
        "react-router-dom": {
          severity: "high",
          via: ["not-reviewed-package"],
        },
      },
    },
    { scope: "client", clientRscUsage: [] },
  );
  assert.equal(result.success, false);
  assert.equal(result.findings[0].name, "react-router-dom");
});
