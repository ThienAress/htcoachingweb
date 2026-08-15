import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  attachUiAuditBaseline,
  createUiAuditBaseline,
  parseUiAuditArgs,
  renderUiAuditReport,
  runUiAudit,
} from "./index.mjs";

const withFixture = async (files, callback) => {
  const rootDir = await mkdtemp(join(tmpdir(), "ht-ui-audit-"));
  try {
    for (const [relativePath, source] of Object.entries(files)) {
      const filePath = join(rootDir, relativePath);
      await mkdir(join(filePath, ".."), { recursive: true });
      await writeFile(filePath, source, "utf8");
    }
    return await callback(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
};

test("reports deterministic evidence for the bounded v1 rule catalog", async () => {
  await withFixture(
    {
      "client/src/BadSurface.jsx": `
        import { X } from "lucide-react";
        export default function BadSurface() {
          return <form>
            <img src="/missing-alt.png" />
            <input type="email" name="email" />
            <button className="outline-none transition-all"><X /></button>
            <a href="/next"><button type="button">Nested</button></a>
            <h2 className="bg-clip-text text-transparent">Slop</h2>
            <div className="z-[9999]" />
          </form>;
        }
        const animation = { ease: "bounce.out" };
      `,
      "client/src/Motion.jsx": `
        import { gsap } from "gsap";
        export const Motion = () => <div className="animate-pulse" />;
      `,
    },
    async (rootDir) => {
      const first = await runUiAudit({ rootDir });
      const second = await runUiAudit({ rootDir });
      assert.deepEqual(
        first.findings.map(({ ruleId, status, file, line }) => ({
          ruleId,
          status,
          file,
          line,
        })),
        [
          { ruleId: "image-alt", status: "fail", file: "client/src/BadSurface.jsx", line: 5 },
          { ruleId: "personal-input-autocomplete", status: "fail", file: "client/src/BadSurface.jsx", line: 6 },
          { ruleId: "form-button-type", status: "fail", file: "client/src/BadSurface.jsx", line: 7 },
          { ruleId: "icon-button-accessible-name", status: "fail", file: "client/src/BadSurface.jsx", line: 7 },
          { ruleId: "focus-visible-not-suppressed", status: "fail", file: "client/src/BadSurface.jsx", line: 7 },
          { ruleId: "transition-all", status: "fail", file: "client/src/BadSurface.jsx", line: 7 },
          { ruleId: "nested-interactive-control", status: "fail", file: "client/src/BadSurface.jsx", line: 8 },
          { ruleId: "gradient-text", status: "fail", file: "client/src/BadSurface.jsx", line: 9 },
          { ruleId: "extreme-z-index", status: "fail", file: "client/src/BadSurface.jsx", line: 10 },
          { ruleId: "bounce-easing", status: "fail", file: "client/src/BadSurface.jsx", line: 13 },
          { ruleId: "reduced-motion-strategy", status: "advisory", file: "client/src/Motion.jsx", line: 2 },
        ],
      );
      assert.deepEqual(first, second);
    },
  );
});

test("filters categories without changing finding identities", async () => {
  await withFixture(
    { "client/src/Surface.jsx": "export default () => <><img src='/x' /><h1 className='bg-clip-text text-transparent'>X</h1></>;" },
    async (rootDir) => {
      const all = await runUiAudit({ rootDir });
      const accessibility = await runUiAudit({ rootDir, category: "accessibility" });
      assert.deepEqual(
        accessibility.findings.map((finding) => finding.key),
        all.findings
          .filter((finding) => finding.category === "accessibility")
          .map((finding) => finding.key),
      );
    },
  );
});

test("renders stable JSON and an evidence-first agent handoff", async () => {
  await withFixture(
    { "client/src/Image.jsx": "export default () => <img src='/x' />;" },
    async (rootDir) => {
      const report = await runUiAudit({ rootDir });
      const json = renderUiAuditReport(report, "json");
      const prompt = renderUiAuditReport(report, "prompt");
      assert.deepEqual(
        {
          jsonStable: json === renderUiAuditReport(report, "json"),
          hasTimestamp: json.includes("generatedAt"),
          promptHasContract:
            prompt.includes("RULE image-alt") &&
            prompt.includes("EVIDENCE client/src/Image.jsx:1") &&
            prompt.includes("ACCEPTANCE CRITERIA"),
        },
        { jsonStable: true, hasTimestamp: false, promptHasContract: true },
      );
    },
  );
});

test("parses only bounded CLI options", () => {
  assert.deepEqual(
    parseUiAuditArgs(["--format", "json", "--category", "forms", "client/src"]),
    {
      format: "json",
      category: "forms",
      target: "client/src",
      baseline: null,
      writeBaseline: null,
      failOnNewHigh: false,
    },
  );
  assert.throws(() => parseUiAuditArgs(["--format", "xml"]), /format/i);
  assert.throws(() => parseUiAuditArgs(["../outside"]), /inside the repository/i);
  assert.throws(() => parseUiAuditArgs(["--baseline"]), /value/i);
});

test("keeps file/read-only inputs and self-closing overlay buttons out of scored findings", async () => {
  await withFixture(
    {
      "client/src/Controls.jsx": `
        export const Controls = () => <section>
          <input type="file" accept="image/png" />
          <input type="number" readOnly className="outline-none" />
          <input type="email" name="email" />
          <button type="button" aria-label="Đóng" onClick={() => {}} />
          <section role="dialog"><button type="button">Lưu</button></section>
          <button className="transition-all">Lưu</button>
          <button className="transition-all">Lưu</button>
        </section>;
      `,
    },
    async (rootDir) => {
      const report = await runUiAudit({ rootDir });
      assert.deepEqual(
        {
          ruleIds: report.findings.map((item) => item.ruleId),
          uniqueKeys: new Set(report.findings.map((item) => item.key)).size,
          totalKeys: report.findings.length,
        },
        {
          ruleIds: [
            "personal-input-autocomplete",
            "transition-all",
            "transition-all",
          ],
          uniqueKeys: 3,
          totalKeys: 3,
        },
      );
    },
  );
});

test("parses JSX handlers without scoring generic names or non-interactive focus containers", async () => {
  await withFixture(
    {
      "client/src/Handlers.jsx": `
        import { X } from "lucide-react";
        export const Handlers = () => <>
          <img onError={() => {}} alt="" src="/decorative.png" />
          <input type="email" onChange={() => {}} autoComplete="email" />
          <input type="text" name="name" />
          <div tabIndex={-1} className="outline-none">Dialog surface</div>
          <form onSubmit={(event) => event.preventDefault()}>
            <button onClick={() => {}} type="button">Save</button>
            <button onClick={() => {}}><X /></button>
            <button onClick={() => {}} type="button" aria-label="Close"><X /></button>
          </form>
        </>;
      `,
    },
    async (rootDir) => {
      const report = await runUiAudit({ rootDir });
      assert.deepEqual(
        report.findings.map(({ ruleId, line }) => ({ ruleId, line })),
        [
          { ruleId: "form-button-type", line: 10 },
          { ruleId: "icon-button-accessible-name", line: 10 },
        ],
      );
    },
  );
});

test("baseline keeps existing debt informational and blocks only new high-confidence failures", async () => {
  await withFixture(
    {
      "client/src/Existing.jsx": `
        import { X } from "lucide-react";
        export const Existing = () => <button><X /></button>;
      `,
    },
    async (rootDir) => {
      const initialReport = await runUiAudit({ rootDir });
      const baseline = createUiAuditBaseline(initialReport);
      await writeFile(
        join(rootDir, "client/src/NewSurface.jsx"),
        `export const NewSurface = () => <><img src="/new.png" /><div className="animate-pulse" /></>;`,
        "utf8",
      );

      const currentReport = await runUiAudit({ rootDir });
      const regressionReport = attachUiAuditBaseline(
        currentReport,
        baseline,
        "scripts/ui-audit/baseline.json",
      );
      const prompt = renderUiAuditReport(regressionReport, "prompt");

      assert.deepEqual(
        {
          baselineFindings: regressionReport.regression.baselineFindings,
          newFindings: regressionReport.regression.newFindings,
          newHighConfidence: regressionReport.regression.newHighConfidence,
          resolvedFindings: regressionReport.regression.resolvedFindings,
          shouldFail: regressionReport.regression.shouldFail,
          promptIncludesNew: prompt.includes("client/src/NewSurface.jsx"),
          promptExcludesExisting: !prompt.includes("client/src/Existing.jsx"),
        },
        {
          baselineFindings: 1,
          newFindings: 2,
          newHighConfidence: 1,
          resolvedFindings: 0,
          shouldFail: true,
          promptIncludesNew: true,
          promptExcludesExisting: true,
        },
      );
    },
  );
});

test("baseline rejects ruleset drift before comparing finding keys", async () => {
  await withFixture(
    { "client/src/Clean.jsx": "export const Clean = () => <main />;" },
    async (rootDir) => {
      const report = await runUiAudit({ rootDir });
      const baseline = {
        ...createUiAuditBaseline(report),
        rulesetVersion: "stale-ruleset",
      };

      assert.throws(
        () => attachUiAuditBaseline(report, baseline, "baseline.json"),
        /ruleset mismatch/i,
      );
    },
  );
});

test("excludes test fixtures from the production UI source inventory", async () => {
  await withFixture(
    {
      "client/src/Surface.jsx": "export const Surface = () => <main />;",
      "client/src/__tests__/BadFixture.test.jsx":
        "export const BadFixture = () => <img src='/fixture.png' />;",
    },
    async (rootDir) => {
      const report = await runUiAudit({ rootDir });
      assert.deepEqual(
        { scannedFiles: report.scannedFiles, findings: report.findings.length },
        { scannedFiles: 1, findings: 0 },
      );
    },
  );
});
