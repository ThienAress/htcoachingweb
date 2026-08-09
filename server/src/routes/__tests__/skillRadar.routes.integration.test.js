import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import skillRadarRoutes from "../skillRadar.routes.js";
import { buildSkillRadarReadModel } from "../../services/skillRadar.service.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/admin/skill-radar", skillRadarRoutes);
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("GET /api/admin/skill-radar", () => {
  it("returns the sanitized 20-source read model to admin", async () => {
    const { accessToken } = await createTestUser({
      email: "radar-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get("/api/admin/skill-radar"),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary.total).toBe(20);
    expect(response.body.data.items).toHaveLength(20);
    expect(response.body.data.items[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        repoUrl: expect.stringMatching(/^https:\/\/github\.com\//),
        skillsShUrl: expect.stringMatching(/^https:\/\/(www\.)?skills\.sh\//),
        localTargets: expect.any(Array),
      }),
    );
    expect(response.body.data.items[0]).not.toHaveProperty("sourcePath");
    expect(JSON.stringify(response.body.data)).not.toMatch(/[A-Z]:\\/i);
  });

  it("rejects non-admin users", async () => {
    const { accessToken } = await createTestUser({
      email: "radar-user@example.com",
      role: "user",
    });

    const response = await withAuth(
      request(app).get("/api/admin/skill-radar"),
      accessToken,
    );

    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get("/api/admin/skill-radar");

    expect(response.status).toBe(401);
  });

  it("falls back safely when the generated snapshot is missing", () => {
    const model = buildSkillRadarReadModel({
      watchlist: {
        schemaVersion: 1,
        schedule: {},
        entries: [{
          id: "example/skills/example-skill",
          name: "example-skill",
          sourceRepo: "example/skills",
          repoUrl: "https://github.com/example/skills",
          skillsShUrl: "https://www.skills.sh/example/skills/example-skill",
          domain: "Testing",
          summary: "Example",
          localTargets: [".agents/skills/qa/SKILL.md"],
          trustTier: "expert",
          lifecycle: "active",
          reviewIntervalDays: 30,
          license: "MIT",
        }],
      },
      snapshot: null,
      now: new Date("2026-08-08T10:00:00.000Z"),
    });

    expect(model.summary).toEqual(expect.objectContaining({ total: 1, reviewDue: 1 }));
    expect(model.items[0]).toEqual(expect.objectContaining({
      drift: "review_due",
      contentHash: null,
      lastCheckedAt: null,
    }));
    expect(model.schedule.nextRunAt).toBe("2026-09-01T02:00:00.000Z");
  });

  it("only exposes repository-relative radar report paths", () => {
    const watchlist = {
      schemaVersion: 1,
      schedule: {},
      entries: [{
        id: "example/skills/example-skill",
        name: "example-skill",
        sourceRepo: "example/skills",
        repoUrl: "https://github.com/example/skills",
        skillsShUrl: "https://www.skills.sh/example/skills/example-skill",
        domain: "Testing",
        summary: "Example",
        localTargets: [".agents/skills/qa/SKILL.md"],
        trustTier: "expert",
        lifecycle: "active",
        reviewIntervalDays: 30,
        license: "MIT",
      }],
    };
    const unsafe = buildSkillRadarReadModel({
      watchlist,
      snapshot: {
        schemaVersion: 1,
        items: [{
          id: "example/skills/example-skill",
          reportPath: "C:\\private\\report.md",
        }],
      },
    });
    const safe = buildSkillRadarReadModel({
      watchlist,
      snapshot: {
        schemaVersion: 1,
        items: [{
          id: "example/skills/example-skill",
          reportPath: "docs/audits/2026-08-skill-radar.md",
        }],
      },
    });

    expect(unsafe.items[0].reportPath).toBeNull();
    expect(safe.items[0].reportPath).toBe("docs/audits/2026-08-skill-radar.md");
  });

  it("reports transient API limits separately from unreachable repositories", () => {
    const model = buildSkillRadarReadModel({
      watchlist: {
        schemaVersion: 1,
        schedule: {},
        entries: [{
          id: "example/skills/example-skill",
          name: "example-skill",
          sourceRepo: "example/skills",
          repoUrl: "https://github.com/example/skills",
          skillsShUrl: "https://www.skills.sh/example/skills/example-skill",
          domain: "Testing",
          summary: "Example",
          localTargets: [".agents/skills/qa/SKILL.md"],
          trustTier: "expert",
          lifecycle: "active",
          reviewIntervalDays: 30,
          license: "MIT",
        }],
      },
      snapshot: {
        schemaVersion: 1,
        items: [{
          id: "example/skills/example-skill",
          drift: "rate_limited",
          contentHash: "known-hash",
          upstreamCommit: "abc123def456",
        }],
      },
    });

    expect(model.summary).toEqual(expect.objectContaining({
      rateLimited: 1,
      unreachable: 0,
    }));
    expect(model.items[0]).toEqual(expect.objectContaining({
      drift: "rate_limited",
      upstreamCommit: "abc123def456",
    }));
  });
});
