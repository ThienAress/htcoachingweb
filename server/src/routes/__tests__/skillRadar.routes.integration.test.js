import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
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
import SkillRadarSource from "../../models/SkillRadarSource.js";
import AuditLog from "../../models/AuditLog.js";
import { skillRadarGithubService } from "../../services/skillRadarGithub.service.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/admin/skill-radar", skillRadarRoutes);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearCollections();
});
afterAll(teardownTestDB);

describe("GET /api/admin/skill-radar", () => {
  it("returns the sanitized 23-source read model to admin", async () => {
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
    expect(response.body.data.summary.total).toBe(23);
    expect(response.body.data.items).toHaveLength(23);
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
          rateLimitRetryAt: "2026-08-08T13:00:00.000Z",
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
      rateLimitRetryAt: "2026-08-08T13:00:00.000Z",
    }));
  });

  it("merges persisted dynamic sources into the admin read model", async () => {
    const { user, accessToken } = await createTestUser({
      email: "radar-dynamic@example.com",
      role: "admin",
    });
    await SkillRadarSource.create({
      _id: "tencentcloud/tencentdb-agent-memory",
      sourceType: "repository",
      name: "TencentDB-Agent-Memory",
      sourceRepo: "TencentCloud/TencentDB-Agent-Memory",
      repoUrl: "https://github.com/TencentCloud/TencentDB-Agent-Memory",
      domain: "AI Memory",
      summary: "Agent memory",
      localTargets: ["HT Assistant"],
      nextCheckAt: new Date("2026-09-11T02:00:00.000Z"),
      createdBy: user._id,
      auditLogId: user._id,
    });

    const response = await withAuth(request(app).get("/api/admin/skill-radar"), accessToken);

    expect(response.status).toBe(200);
    expect(response.body.data.summary.total).toBe(24);
    expect(response.body.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "tencentcloud/tencentdb-agent-memory",
        sourceType: "repository",
      }),
    ]));
  });

  it("persists an allowlisted preview payload and rejects its duplicate", async () => {
    const { accessToken } = await createTestUser({
      email: "radar-create@example.com",
      role: "admin",
    });
    const analyzed = {
      sourceRepo: "TencentCloud/TencentDB-Agent-Memory",
      repoUrl: "https://github.com/TencentCloud/TencentDB-Agent-Memory",
      skillsShUrl: null,
      trustTier: "community",
      reviewIntervalDays: 30,
      license: "Apache-2.0",
      lastUpstreamCommitAt: "2026-08-11T10:00:00.000Z",
      lastCheckedAt: "2026-08-12T02:00:00.000Z",
      nextCheckAt: "2026-09-11T02:00:00.000Z",
      repositoryArchived: false,
    };
    vi.spyOn(skillRadarGithubService, "analyze").mockResolvedValue(analyzed);
    const payload = {
      sourceUrl: "https://github.com/TencentCloud/TencentDB-Agent-Memory?fbclid=x",
      sourceType: "repository",
      name: "TencentDB-Agent-Memory",
      domain: "AI Memory",
      summary: "Agent memory for databases",
      localTargets: ["HT Assistant", "Knowledge Base"],
      lifecycle: "candidate",
    };

    const created = await withAuth(
      request(app).post("/api/admin/skill-radar/sources").send(payload),
      accessToken,
    );
    const duplicate = await withAuth(
      request(app).post("/api/admin/skill-radar/sources").send(payload),
      accessToken,
    );

    expect(created.status).toBe(201);
    expect(created.body.data).toEqual(expect.objectContaining({
      id: "tencentcloud/tencentdb-agent-memory",
      domain: "AI Memory",
      drift: "review_due",
      reviewIntervalDays: 30,
    }));
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("SKILL_RADAR_SOURCE_DUPLICATE");
    expect(skillRadarGithubService.analyze).toHaveBeenCalledTimes(1);
    expect(await AuditLog.exists({
      action: "create_skill_radar_source",
      targetKey: "tencentcloud/tencentdb-agent-memory",
      outcome: "succeeded",
    })).toBeTruthy();
    const persisted = await SkillRadarSource.findById(
      "tencentcloud/tencentdb-agent-memory",
    ).lean();
    expect(await AuditLog.exists({ _id: persisted.auditLogId })).toBeTruthy();
  });

  it("rejects a repository that already exists in the static watchlist", async () => {
    const { accessToken } = await createTestUser({
      email: "radar-static-duplicate@example.com",
      role: "admin",
    });
    const analyze = vi.spyOn(skillRadarGithubService, "analyze");

    const response = await withAuth(
      request(app).post("/api/admin/skill-radar/sources").send({
        sourceUrl: "https://github.com/coreyhaines31/marketingskills",
        sourceType: "skill",
        name: "seo-audit",
        domain: "SEO",
        summary: "Duplicate static source",
        localTargets: ["$seo-check"],
        lifecycle: "active",
      }),
      accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("SKILL_RADAR_SOURCE_DUPLICATE");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("uses the selected watch lifecycle to schedule a 90-day review", async () => {
    const { accessToken } = await createTestUser({
      email: "radar-watch@example.com",
      role: "admin",
    });
    vi.spyOn(skillRadarGithubService, "analyze").mockResolvedValue({
      sourceRepo: "example/slow-radar",
      repoUrl: "https://github.com/example/slow-radar",
      skillsShUrl: null,
      trustTier: "community",
      reviewIntervalDays: 30,
      license: "MIT",
      lastUpstreamCommitAt: "2026-08-11T10:00:00.000Z",
      lastCheckedAt: "2026-08-12T02:00:00.000Z",
      nextCheckAt: "2026-09-11T02:00:00.000Z",
      repositoryArchived: false,
    });

    const response = await withAuth(
      request(app).post("/api/admin/skill-radar/sources").send({
        sourceUrl: "https://github.com/example/slow-radar",
        sourceType: "repository",
        name: "slow-radar",
        domain: "Công nghệ khác",
        summary: "Nguồn theo dõi theo quý",
        localTargets: ["Cần review local"],
        lifecycle: "watch",
      }),
      accessToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.data.reviewIntervalDays).toBe(90);
    expect(response.body.data.nextCheckAt).toBe("2026-11-10T02:00:00.000Z");
  });

  it("does not trust GitHub metadata echoed by the browser", async () => {
    const { accessToken } = await createTestUser({
      email: "radar-tampered@example.com",
      role: "admin",
    });
    vi.spyOn(skillRadarGithubService, "analyze").mockResolvedValue({
      sourceRepo: "TencentCloud/TencentDB-Agent-Memory",
      repoUrl: "https://github.com/TencentCloud/TencentDB-Agent-Memory",
      skillsShUrl: null,
      trustTier: "community",
      reviewIntervalDays: 30,
      license: "Apache-2.0",
      lastUpstreamCommitAt: "2026-08-11T10:00:00.000Z",
      lastCheckedAt: "2026-08-12T02:00:00.000Z",
      nextCheckAt: "2026-09-11T02:00:00.000Z",
      repositoryArchived: false,
    });

    const response = await withAuth(
      request(app).post("/api/admin/skill-radar/sources").send({
        sourceUrl: "https://github.com/TencentCloud/TencentDB-Agent-Memory",
        sourceType: "repository",
        name: "TencentDB-Agent-Memory",
        domain: "AI Memory",
        summary: "Agent memory for databases",
        localTargets: ["$ai-chat-system"],
        lifecycle: "candidate",
        license: "TAMPERED",
      }),
      accessToken,
    );

    expect(response.status).toBe(400);
    expect(await SkillRadarSource.countDocuments()).toBe(0);
  });

  it("keeps a failed audit record when persistence rejects the confirmed source", async () => {
    const { accessToken } = await createTestUser({
      email: "radar-persistence-failure@example.com",
      role: "admin",
    });
    vi.spyOn(skillRadarGithubService, "analyze").mockResolvedValue({
      sourceRepo: "example/persistence-failure",
      repoUrl: "https://github.com/example/persistence-failure",
      skillsShUrl: null,
      trustTier: "community",
      reviewIntervalDays: 30,
      license: "MIT",
      lastUpstreamCommitAt: "2026-08-11T10:00:00.000Z",
      lastCheckedAt: "2026-08-12T02:00:00.000Z",
      nextCheckAt: "2026-09-11T02:00:00.000Z",
      repositoryArchived: false,
    });
    vi.spyOn(SkillRadarSource.prototype, "save").mockRejectedValueOnce(
      new Error("write failed"),
    );

    const response = await withAuth(
      request(app).post("/api/admin/skill-radar/sources").send({
        sourceUrl: "https://github.com/example/persistence-failure",
        sourceType: "repository",
        name: "persistence-failure",
        domain: "Testing",
        summary: "Persistence failure test",
        localTargets: ["$qa"],
        lifecycle: "candidate",
      }),
      accessToken,
    );

    expect(response.status).toBe(500);
    expect(await AuditLog.exists({
      targetKey: "example/persistence-failure",
      outcome: "failed",
      "metadata.failureCode": "persistence_failed",
    })).toBeTruthy();
  });

  it("does not mark the audit successful before the source is persisted", async () => {
    const { accessToken } = await createTestUser({
      email: "radar-audit-order@example.com",
      role: "admin",
    });
    vi.spyOn(skillRadarGithubService, "analyze").mockResolvedValue({
      sourceRepo: "example/audit-order",
      repoUrl: "https://github.com/example/audit-order",
      skillsShUrl: null,
      trustTier: "community",
      reviewIntervalDays: 30,
      license: "MIT",
      lastUpstreamCommitAt: "2026-08-11T10:00:00.000Z",
      lastCheckedAt: "2026-08-12T02:00:00.000Z",
      nextCheckAt: "2026-09-11T02:00:00.000Z",
      repositoryArchived: false,
    });
    vi.spyOn(SkillRadarSource.prototype, "save").mockImplementationOnce(
      async () => {
        const audit = await AuditLog.findOne({
          targetKey: "example/audit-order",
        }).lean();
        expect(audit?.outcome).toBe("failed");
        throw new Error("write failed");
      },
    );

    const response = await withAuth(
      request(app).post("/api/admin/skill-radar/sources").send({
        sourceUrl: "https://github.com/example/audit-order",
        sourceType: "repository",
        name: "audit-order",
        domain: "Testing",
        summary: "Audit write ordering test",
        localTargets: ["$qa"],
        lifecycle: "candidate",
      }),
      accessToken,
    );

    expect(response.status).toBe(500);
  });

  it("rejects a final duplicate race and records the failed attempt", async () => {
    const { accessToken } = await createTestUser({
      email: "radar-race@example.com",
      role: "admin",
    });
    vi.spyOn(skillRadarGithubService, "analyze").mockResolvedValue({
      sourceRepo: "example/race",
      repoUrl: "https://github.com/example/race",
      skillsShUrl: null,
      trustTier: "community",
      license: "MIT",
      lastUpstreamCommitAt: "2026-08-11T10:00:00.000Z",
      lastCheckedAt: "2026-08-12T02:00:00.000Z",
      nextCheckAt: "2026-09-11T02:00:00.000Z",
      repositoryArchived: false,
    });
    vi.spyOn(SkillRadarSource.prototype, "save").mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), { code: 11000 }),
    );

    const response = await withAuth(
      request(app).post("/api/admin/skill-radar/sources").send({
        sourceUrl: "https://github.com/example/race",
        sourceType: "repository",
        name: "race",
        domain: "Testing",
        summary: "Duplicate race test",
        localTargets: ["$qa"],
        lifecycle: "candidate",
      }),
      accessToken,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("SKILL_RADAR_SOURCE_DUPLICATE");
    expect(await AuditLog.exists({
      targetKey: "example/race",
      outcome: "failed",
      "metadata.failureCode": "duplicate",
    })).toBeTruthy();
  });

  it("requires CSRF for mutations", async () => {
    const { accessToken } = await createTestUser({ role: "admin" });
    const analyze = vi.spyOn(skillRadarGithubService, "analyze");
    const response = await request(app)
      .post("/api/admin/skill-radar/preview")
      .set("Cookie", [`accessToken=${accessToken}`])
      .send({ sourceUrl: "https://github.com/example/repo" });

    expect(response.status).toBe(403);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects non-admin and unauthenticated mutations before GitHub analysis", async () => {
    const { accessToken } = await createTestUser({ role: "user" });
    const analyze = vi.spyOn(skillRadarGithubService, "analyze");
    const payload = { sourceUrl: "https://github.com/example/repo" };

    const forbidden = await withAuth(
      request(app).post("/api/admin/skill-radar/preview").send(payload),
      accessToken,
    );
    const unauthenticated = await request(app)
      .post("/api/admin/skill-radar/preview")
      .send(payload);

    expect(forbidden.status).toBe(403);
    expect(unauthenticated.status).toBe(401);
    expect(analyze).not.toHaveBeenCalled();
  });
});
