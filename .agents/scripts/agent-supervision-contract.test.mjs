import assert from "node:assert/strict";
import test from "node:test";

import { evaluateLeaseAvailability } from "./agent-supervision-contract.mjs";

const NOW = "2026-08-30T02:00:00.000Z";
const FUTURE = "2026-08-30T03:00:00.000Z";
const PAST = "2026-08-30T01:00:00.000Z";

const scope = (path, kind = "file") => ({ kind, path });

const lease = (overrides = {}) => ({
  id: "lease-a",
  owner: "agent-a",
  lifecycle: "active",
  expiresAt: FUTURE,
  scopes: [scope(".agents/scripts/owned.mjs")],
  ...overrides,
});

const registry = (leases = [lease()]) => ({
  schemaVersion: 1,
  kind: "worktree-lease-registry",
  leases,
});

const proposal = (scopes = [scope("docs/plans/078-plan.md")]) => ({
  owner: "agent-b",
  scopes,
});

test("rejects a proposal with an exact active lease conflict without exposing its path", () => {
  const result = evaluateLeaseAvailability(
    registry(),
    proposal([scope(".agents/scripts/owned.mjs")]),
    { now: NOW },
  );

  assert.deepEqual(
    {
      decision: result.decision,
      conflicts: result.conflicts,
      leaksScopePath: JSON.stringify(result).includes("owned.mjs"),
    },
    {
      decision: "conflict",
      conflicts: [{ reason: "proposal-overlap", leaseId: "lease-a", owner: "agent-a" }],
      leaksScopePath: false,
    },
  );
});

test("rejects ancestor overlap in either file-directory direction", () => {
  const descendantProposal = evaluateLeaseAvailability(
    registry([lease({ scopes: [scope("client/src", "directory")] })]),
    proposal([scope("client/src/App.jsx")]),
    { now: NOW },
  );
  const ancestorProposal = evaluateLeaseAvailability(
    registry([lease({ scopes: [scope("client/src/App.jsx")] })]),
    proposal([scope("client", "directory")]),
    { now: NOW },
  );

  assert.deepEqual(
    [descendantProposal.decision, ancestorProposal.decision],
    ["conflict", "conflict"],
  );
});

test("treats case-only path variants as the same lease scope", () => {
  const result = evaluateLeaseAvailability(
    registry([lease({ scopes: [scope("client/src/App.jsx")] })]),
    proposal([scope("CLIENT/SRC/app.jsx")]),
    { now: NOW },
  );

  assert.equal(result.decision, "conflict");
});

test("treats stable Unicode case-fold variants as the same lease scope", () => {
  const equivalentPaths = [
    ["docs/A\u03a3", "docs/a\u03c2"],
    ["docs/stra\u00dfe", "docs/STRASSE"],
    ["docs/\u0130", "docs/i\u0307"],
  ];

  for (const [activePath, proposedPath] of equivalentPaths) {
    const result = evaluateLeaseAvailability(
      registry([lease({ scopes: [scope(activePath)] })]),
      proposal([scope(proposedPath)]),
      { now: NOW },
    );

    assert.equal(result.decision, "conflict", `${activePath} must conflict with ${proposedPath}`);
  }
});

test("rejects an internally overlapping active registry with both owners and lease IDs", () => {
  const result = evaluateLeaseAvailability(
    registry([
      lease({ id: "lease-z", owner: "agent-z", scopes: [scope("server", "directory")] }),
      lease({ id: "lease-a", owner: "agent-a", scopes: [scope("server/src/a.js")] }),
    ]),
    proposal(),
    { now: NOW },
  );

  assert.deepEqual(result.conflicts, [
    { reason: "active-registry-overlap", leaseId: "lease-a", owner: "agent-a" },
    { reason: "active-registry-overlap", leaseId: "lease-z", owner: "agent-z" },
  ]);
});

test("rejects ancestor overlap when a lexical sibling appears between paths", () => {
  const result = evaluateLeaseAvailability(
    registry([
      lease({ id: "lease-root", owner: "agent-root", scopes: [scope("client")] }),
      lease({ id: "lease-sibling", owner: "agent-sibling", scopes: [scope("client-other")] }),
      lease({ id: "lease-child", owner: "agent-child", scopes: [scope("client/src")] }),
    ]),
    proposal(),
    { now: NOW },
  );

  assert.deepEqual(result.conflicts, [
    { reason: "active-registry-overlap", leaseId: "lease-child", owner: "agent-child" },
    { reason: "active-registry-overlap", leaseId: "lease-root", owner: "agent-root" },
  ]);
});

test("evaluates the maximum registry shape within the contract bound", { timeout: 5_000 }, () => {
  const leases = Array.from({ length: 200 }, (_, leaseIndex) => lease({
    id: `lease-${String(leaseIndex).padStart(3, "0")}`,
    owner: `agent-${String(leaseIndex).padStart(3, "0")}`,
    scopes: Array.from({ length: 100 }, (_, scopeIndex) => scope(
      `workspaces/${String(leaseIndex).padStart(3, "0")}/${String(scopeIndex).padStart(3, "0")}.mjs`,
    )),
  }));

  const result = evaluateLeaseAvailability(registry(leases), proposal(), { now: NOW });

  assert.deepEqual({ decision: result.decision, conflicts: result.conflicts }, {
    decision: "available",
    conflicts: [],
  });
});

test("normalizes Unicode lease paths in deterministic code-unit order", () => {
  const scopes = [scope("tests/z.test.mjs"), scope("tests/ä.test.mjs")];

  const first = evaluateLeaseAvailability(
    registry([lease({ scopes })]),
    proposal(),
    { now: NOW },
  );
  const second = evaluateLeaseAvailability(
    registry([lease({ scopes: [...scopes].reverse() })]),
    proposal(),
    { now: NOW },
  );

  assert.deepEqual(
    {
      registryFingerprint: first.registryFingerprint,
      proposalFingerprint: first.proposalFingerprint,
      conflicts: first.conflicts,
    },
    {
      registryFingerprint: second.registryFingerprint,
      proposalFingerprint: second.proposalFingerprint,
      conflicts: second.conflicts,
    },
  );
});

test("ignores expired leases and returns deterministic detached output without mutating inputs", () => {
  const inputRegistry = registry([lease({ expiresAt: PAST })]);
  const inputProposal = proposal();
  const before = structuredClone({ inputRegistry, inputProposal });

  const first = evaluateLeaseAvailability(inputRegistry, inputProposal, { now: NOW });
  const second = evaluateLeaseAvailability(inputRegistry, inputProposal, { now: NOW });
  first.conflicts.push({ reason: "proposal-overlap", leaseId: "fake", owner: "fake" });

  assert.deepEqual(
    {
      decision: second.decision,
      conflicts: second.conflicts,
      deterministic: first.proposalFingerprint === second.proposalFingerprint,
      inputs: { inputRegistry, inputProposal },
    },
    {
      decision: "available",
      conflicts: [],
      deterministic: true,
      inputs: before,
    },
  );
});

test("fails closed for malformed, absolute and traversal lease scopes", () => {
  const invalidPaths = [
    "../client/src/App.jsx",
    "/client/src/App.jsx",
    "C:/client/src/App.jsx",
    "D:client/src/App.jsx",
    "client:src/App.jsx",
    "client\\src\\App.jsx",
    "client//src/App.jsx",
    "client/src/App.jsx.",
    "client/src/App.jsx ",
    "client/src/App.jsx\0spoof",
    "client/src/\u202eApp.jsx",
    "client/src/\u061cApp.jsx",
    "client/src/soft\u00adhyphen.jsx",
    "client/src/cafe\u0301.js",
    "client/src/CON",
    "client/src/con.txt",
    "client/src/NUL.md",
    "client/src/AUX",
    "client/src/COM1.js",
    "client/src/LPT9.log",
    "client/src/a?b.js",
    ".",
  ];

  for (const invalidPath of invalidPaths) {
    assert.throws(
      () => evaluateLeaseAvailability(
        registry([lease({ scopes: [scope(invalidPath)] })]),
        proposal(),
        { now: NOW },
      ),
      /repository-relative path/i,
    );
  }
});

test("fails closed for duplicate lease IDs and redundant scopes", () => {
  const duplicateIds = registry([lease(), lease({ owner: "agent-z" })]);
  const redundantScopes = proposal([
    scope("client/src", "directory"),
    scope("client/src/App.jsx"),
  ]);

  assert.deepEqual(
    [
      () => evaluateLeaseAvailability(duplicateIds, proposal(), { now: NOW }),
      () => evaluateLeaseAvailability(registry(), redundantScopes, { now: NOW }),
    ].map((operation) => {
      try {
        operation();
        return "accepted";
      } catch (error) {
        return error.message;
      }
    }),
    ["Lease registry contains a duplicate lease ID", "Lease proposal contains overlapping scopes"],
  );
});

test("fails closed for malformed lifecycle, expiry, unknown fields and non-canonical time", () => {
  const cases = [
    registry([lease({ lifecycle: "pending" })]),
    registry([lease({ expiresAt: "not-a-time" })]),
    registry([lease({ unexpected: true })]),
  ];

  for (const value of cases) {
    assert.throws(
      () => evaluateLeaseAvailability(value, proposal(), { now: NOW }),
      /lease|unsupported|expiry/i,
    );
  }
  assert.throws(
    () => evaluateLeaseAvailability(registry(), proposal(), { now: "2026-08-30" }),
    /canonical ISO-8601/i,
  );
});

test("rejects personal phone identifiers before they can appear in conflicts", () => {
  const sensitiveIdentifiers = [
    "0912345678",
    "0912_345_678",
    ["sk", "proj", "A".repeat(24)].join("-"),
  ];

  for (const owner of sensitiveIdentifiers) {
    assert.throws(
      () => evaluateLeaseAvailability(
        registry([lease({ owner })]),
        proposal([scope(".agents/scripts/owned.mjs")]),
        { now: NOW },
      ),
      /owner.*invalid/i,
    );
  }

  const credential = ["ghp", "A".repeat(30)].join("_");
  assert.throws(
    () => evaluateLeaseAvailability(
      registry([lease({ id: credential })]),
      proposal([scope(".agents/scripts/owned.mjs")]),
      { now: NOW },
    ),
    /lease id.*invalid/i,
  );
});
