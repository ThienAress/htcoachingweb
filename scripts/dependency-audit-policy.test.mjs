import test from "node:test";
import assert from "node:assert/strict";

import { evaluateDependencyAudit } from "./check-dependency-audit.mjs";

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
