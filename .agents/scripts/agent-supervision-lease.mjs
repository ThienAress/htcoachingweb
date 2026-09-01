import crypto from "node:crypto";
import { isCanonicalRepositoryRelativePath } from "../../scripts/lib/repository-path.mjs";
import { findPrivacyTypes } from "../../scripts/lib/docs-privacy.mjs";
import { hasSecretLikeText } from "../../scripts/lib/sensitive-text.mjs";

const SHA256 = /^[0-9a-f]{64}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/;
const MAX_LEASES = 200;
const MAX_SCOPES = 100;
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const closedObject = (value, allowedFields, name) => {
  invariant(value && typeof value === "object" && !Array.isArray(value), `${name} must be an object`);
  for (const field of Object.keys(value)) {
    invariant(allowedFields.includes(field), `${name} contains an unsupported field`);
  }
};

const safeIdentifier = (value, name) => {
  invariant(typeof value === "string" && IDENTIFIER.test(value), `${name} is invalid`);
  const comparableIdentifier = value.replace(/[._/-]+/g, " ");
  invariant(
    !hasSecretLikeText(value)
      && findPrivacyTypes(value).length === 0
      && findPrivacyTypes(comparableIdentifier).length === 0,
    `${name} is invalid`,
  );
  invariant(
    !value.split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
    `${name} is invalid`,
  );
  return value;
};

const canonicalTime = (value, name) => {
  const parsed = new Date(value);
  invariant(
    typeof value === "string" && Number.isFinite(parsed.getTime()) && parsed.toISOString() === value,
    `${name} must be canonical ISO-8601`,
  );
  return parsed.getTime();
};

const safeRelativePath = (value) => {
  invariant(isCanonicalRepositoryRelativePath(value), "Invalid repository-relative path");
  return value;
};

const normalizePathCase = (value) => value
  .normalize("NFKC")
  .toUpperCase()
  .normalize("NFKC");

const normalizeScope = (value) => {
  closedObject(value, ["kind", "path"], "Lease scope");
  invariant(["file", "directory"].includes(value.kind), "Lease scope kind is invalid");
  return { kind: value.kind, path: normalizePathCase(safeRelativePath(value.path)) };
};

const scopeOverlaps = (left, right) => {
  if (left.path === right.path) return true;
  return (
    left.path.startsWith(`${right.path}/`)
    || right.path.startsWith(`${left.path}/`)
  );
};

const normalizeScopes = (values, name) => {
  invariant(Array.isArray(values) && values.length > 0 && values.length <= MAX_SCOPES, `${name} scopes are invalid`);
  const scopes = values.map(normalizeScope).sort((left, right) => (
    compareText(left.path, right.path) || compareText(left.kind, right.kind)
  ));
  for (let left = 0; left < scopes.length; left += 1) {
    for (let right = left + 1; right < scopes.length; right += 1) {
      invariant(!scopeOverlaps(scopes[left], scopes[right]), `${name} contains overlapping scopes`);
    }
  }
  return scopes;
};

const normalizeLease = (value) => {
  closedObject(value, ["id", "owner", "lifecycle", "expiresAt", "scopes"], "Lease");
  invariant(["active", "released"].includes(value.lifecycle), "Lease lifecycle is invalid");
  canonicalTime(value.expiresAt, "Lease expiry");
  return {
    id: safeIdentifier(value.id, "Lease ID"),
    owner: safeIdentifier(value.owner, "Lease owner"),
    lifecycle: value.lifecycle,
    expiresAt: value.expiresAt,
    scopes: normalizeScopes(value.scopes, "Lease"),
  };
};

const hashJson = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const evaluateLeaseAvailability = (registry, proposal, { now } = {}) => {
  closedObject(registry, ["schemaVersion", "kind", "leases"], "Lease registry");
  invariant(
    registry.schemaVersion === 1 && registry.kind === "worktree-lease-registry",
    "Lease registry identity is invalid",
  );
  invariant(Array.isArray(registry.leases) && registry.leases.length <= MAX_LEASES, "Lease registry is invalid");
  const evaluatedAt = canonicalTime(now, "now");
  const leases = registry.leases.map(normalizeLease).sort((left, right) => (
    compareText(left.id, right.id)
  ));
  invariant(new Set(leases.map(({ id }) => id)).size === leases.length, "Lease registry contains a duplicate lease ID");

  closedObject(proposal, ["owner", "scopes"], "Lease proposal");
  const normalizedProposal = {
    owner: safeIdentifier(proposal.owner, "Lease proposal owner"),
    scopes: normalizeScopes(proposal.scopes, "Lease proposal"),
  };
  const active = leases.filter((item) => (
    item.lifecycle === "active" && canonicalTime(item.expiresAt, "Lease expiry") > evaluatedAt
  ));
  const conflictMap = new Map();
  const record = (reason, item) => {
    conflictMap.set(`${reason}:${item.id}`, { reason, leaseId: item.id, owner: item.owner });
  };

  const scopeGroups = new Map();
  for (const item of active) {
    for (const leaseScope of item.scopes) {
      const members = scopeGroups.get(leaseScope.path) || [];
      members.push(item);
      scopeGroups.set(leaseScope.path, members);
    }
  }
  const scopeTrie = { members: [], children: new Map() };
  for (const [scopePath, members] of scopeGroups) {
    let node = scopeTrie;
    for (const segment of scopePath.split("/")) {
      if (!node.children.has(segment)) {
        node.children.set(segment, { members: [], children: new Map() });
      }
      node = node.children.get(segment);
    }
    node.members.push(...members);
  }
  const inspectScopeTrie = (node, ancestorMembers) => {
    if (node.members.length > 1) {
      for (const item of node.members) record("active-registry-overlap", item);
    }
    if (node.members.length > 0 && ancestorMembers.length > 0) {
      for (const item of ancestorMembers) record("active-registry-overlap", item);
      for (const item of node.members) record("active-registry-overlap", item);
    }
    const previousLength = ancestorMembers.length;
    ancestorMembers.push(...node.members);
    for (const [, child] of [...node.children.entries()].sort((left, right) => (
      compareText(left[0], right[0])
    ))) {
      inspectScopeTrie(child, ancestorMembers);
    }
    ancestorMembers.length = previousLength;
  };
  inspectScopeTrie(scopeTrie, []);
  for (const item of active) {
    const overlaps = item.scopes.some((leaseScope) => (
      normalizedProposal.scopes.some((proposalScope) => scopeOverlaps(leaseScope, proposalScope))
    ));
    if (overlaps) record("proposal-overlap", item);
  }

  const conflicts = [...conflictMap.values()].sort((left, right) => (
    compareText(left.reason, right.reason) || compareText(left.leaseId, right.leaseId)
  ));
  const registryFingerprint = hashJson({
    schemaVersion: registry.schemaVersion,
    kind: registry.kind,
    leases,
  });
  invariant(SHA256.test(hashJson(normalizedProposal)), "Lease proposal fingerprint is invalid");
  return {
    schemaVersion: 1,
    kind: "lease-decision",
    decision: conflicts.length === 0 ? "available" : "conflict",
    evaluatedAt: now,
    proposalFingerprint: hashJson(normalizedProposal),
    registryFingerprint,
    conflicts,
  };
};
