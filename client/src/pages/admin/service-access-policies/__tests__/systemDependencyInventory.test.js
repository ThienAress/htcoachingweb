import { describe, expect, it } from "vitest";

import { SYSTEM_DEPENDENCY_INVENTORY } from "../systemDependencyInventory.js";

describe("system dependency inventory", () => {
  it("combines all three package manifests without losing scope metadata", () => {
    expect(
      SYSTEM_DEPENDENCY_INVENTORY.manifests.map(({ scopeKey, file }) => [
        scopeKey,
        file,
      ]),
    ).toEqual([
      ["workspace", "package.json"],
      ["frontend", "client/package.json"],
      ["backend", "server/package.json"],
    ]);
    expect(SYSTEM_DEPENDENCY_INVENTORY.items.length).toBeGreaterThan(0);
    expect(
      SYSTEM_DEPENDENCY_INVENTORY.items.every(
        ({ name, declarations }) => name && declarations.length > 0,
      ),
    ).toBe(true);
  });

  it("flags only actionable manifest risks without claiming registry freshness", () => {
    expect(
      SYSTEM_DEPENDENCY_INVENTORY.items.every(({ recommendation }) =>
        recommendation.includes("npm outdated"),
      ),
    ).toBe(true);
  });
});
