import { describe, expect, it } from "vitest";
import {
  getAccountWorkspaceItems,
  getTrainerNavigationGroups,
  getWorkoutPlanWorkspacePath,
  isTrainerNavigationItemActive,
} from "../workspaceNavigation";

describe("workspace navigation contract", () => {
  it("gives admin the system and customer workspaces only", () => {
    expect(
      getAccountWorkspaceItems({ isAdmin: true, hasTrainerAccess: true }).map(
        (item) => item.key,
      ),
    ).toEqual(["admin", "customerManagement"]);
  });

  it("gives trainer access only to customer management", () => {
    expect(
      getAccountWorkspaceItems({
        isAdmin: false,
        hasTrainerAccess: true,
      }).map((item) => item.key),
    ).toEqual(["customerManagement"]);
  });

  it("keeps the customer dashboard entry for a regular user", () => {
    expect(
      getAccountWorkspaceItems({
        isAdmin: false,
        hasTrainerAccess: false,
      }),
    ).toEqual([
      expect.objectContaining({ key: "customerDashboard", path: "/dashboard" }),
    ]);
  });

  it("hides Today workspaces and health navigation while the platform is off", () => {
    expect(
      getAccountWorkspaceItems({
        isAdmin: false,
        hasTrainerAccess: false,
        todayPlatformEnabled: false,
      }),
    ).toEqual([]);

    expect(
      getTrainerNavigationGroups({
        f1Allowed: false,
        todayPlatformEnabled: false,
      }).flatMap((group) => group.items.map((item) => item.key)),
    ).not.toContain("health");
  });

  it("keeps the trainer workspace focused on clients, coaching and resources", () => {
    const groups = getTrainerNavigationGroups({ f1Allowed: false });

    expect(groups.map((group) => group.key)).toEqual([
      "overview",
      "trainingOperations",
      "professionalResources",
    ]);
    expect(
      groups.flatMap((group) => group.items.map((item) => item.key)),
    ).toEqual([
      "clients",
      "health",
      "checkin",
      "coaching",
      "schedule",
      "workoutPlans",
      "exercises",
      "practiceCenter",
    ]);
  });

  it("does not duplicate administration entries inside the trainer sidebar", () => {
    const groups = getTrainerNavigationGroups({ f1Allowed: true });

    expect({
      groupKeys: groups.map((group) => group.key),
      itemKeys: groups.flatMap((group) =>
        group.items.map((item) => item.key),
      ),
    }).toEqual({
      groupKeys: [
        "overview",
        "trainingOperations",
        "professionalResources",
        "customerGrowth",
      ],
      itemKeys: [
        "clients",
        "health",
        "checkin",
        "coaching",
        "schedule",
        "workoutPlans",
        "exercises",
        "practiceCenter",
        "f1Customers",
      ],
    });
  });

  it("adds the F1 growth group only when authorized", () => {
    const groups = getTrainerNavigationGroups({ f1Allowed: true });

    expect(groups.at(-1)).toEqual(
      expect.objectContaining({
        key: "customerGrowth",
        items: [
          expect.objectContaining({
            key: "f1Customers",
            path: "/f1-customers",
          }),
        ],
      }),
    );
  });

  it("matches detail routes without activating the trainer overview", () => {
    expect(
      isTrainerNavigationItemActive("clients", "/trainer/clients/client-1"),
    ).toBe(true);
    expect(
      isTrainerNavigationItemActive(
        "workoutPlans",
        "/trainer/workout-plans/plan-1",
      ),
    ).toBe(true);
    expect(
      isTrainerNavigationItemActive("clients", "/trainer/workout-plans"),
    ).toBe(false);
  });

  it("keeps workout-plan navigation inside its current route family", () => {
    expect(getWorkoutPlanWorkspacePath()).toBe("/trainer/workout-plans");
    expect(getWorkoutPlanWorkspacePath("plan 1")).toBe(
      "/trainer/workout-plans/plan%201",
    );
    expect(getWorkoutPlanWorkspacePath("plan 1", { embedded: false })).toBe(
      "/workout-plans/plan%201",
    );
  });
});
