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
import serviceAccessPolicyRoutes from "../serviceAccessPolicy.routes.js";

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
  app.use("/api/admin/service-access-policies", serviceAccessPolicyRoutes);
});

afterEach(clearCollections);
afterAll(teardownTestDB);

describe("GET /api/admin/service-access-policies", () => {
  it("returns the canonical read-only matrix to admin", async () => {
    const { accessToken } = await createTestUser({
      email: "policy-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get("/api/admin/service-access-policies"),
      accessToken,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.columns).toEqual([
      expect.objectContaining({ id: "guest", label: "Guest" }),
      expect.objectContaining({ id: "user", label: "User thường" }),
      expect.objectContaining({
        id: "paid",
        label: "User có gói / HLV",
      }),
    ]);
    expect(response.body.data.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceKey: "meal_scan",
          policies: expect.objectContaining({
            guest: expect.objectContaining({ limit: 2 }),
            user: expect.objectContaining({ limit: 3 }),
            coaching_customer: expect.objectContaining({ limit: 10 }),
            trainer: expect.objectContaining({ limit: 10 }),
          }),
        }),
      ]),
    );
    expect(response.body.data.trainerPlans.columns.map((plan) => plan.id)).toEqual([
      "free",
      "standard",
      "professional",
      "premium",
    ]);
    expect(response.body.data.trainerPlans.benefits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "max_students",
          values: { free: 3, standard: 5, professional: 20, premium: 50 },
        }),
        expect.objectContaining({
          key: "crm_ai_analysis",
          values: {
            free: false,
            standard: false,
            professional: true,
            premium: true,
          },
        }),
      ]),
    );
  });

  it("returns the canonical community feature catalog to admin", async () => {
    const { accessToken } = await createTestUser({
      email: "feature-catalog-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get("/api/admin/service-access-policies"),
      accessToken,
    );

    expect(response.body.data.communityFeatures).toEqual(
      expect.objectContaining({
        version: "2026-08-12.1",
        reportOptions: {
          audiences: [
            { key: "community", label: "Cộng đồng" },
            { key: "customer", label: "Khách hàng" },
            { key: "trainer", label: "HLV" },
          ],
          statuses: [
            { code: "in_progress", rank: 0, label: "Đang xử lý" },
            { code: "implemented", rank: 1, label: "Đã code" },
            { code: "verified", rank: 2, label: "Đã kiểm thử" },
            {
              code: "production_verified",
              rank: 3,
              label: "Đã xác minh production",
            },
          ],
          dateRange: { from: "2026-08-10", to: "2026-08-12" },
        },
        items: expect.arrayContaining([
          expect.objectContaining({
            featureKey: "ht_assistant",
            label: "HT Assistant",
            group: { key: "ai_support", label: "AI hỗ trợ" },
            priority: {
              code: "F1",
              rank: 1,
              label: "Ưu tiên kế tiếp",
            },
            primaryValue:
              "Trả lời và định hướng người dùng về tập luyện, dinh dưỡng, phục hồi và các dịch vụ HTCOACHING.",
            audiences: ["Cộng đồng", "Khách hàng", "HLV"],
            audienceKeys: ["community", "customer", "trainer"],
            currentImprovement: {
              improvementKey: "moderation_consistency_and_concise_guidance",
              description:
                "Đồng bộ moderation production, rút gọn phản hồi chuyển hướng và theo dõi tỷ lệ chặn nhầm.",
              openedAt: "2026-08-12",
            },
            improvementHistory: expect.arrayContaining([
              expect.objectContaining({
                improvementKey: "conversation_continuity",
                opportunity: "Giữ phản hồi khi chuyển cuộc trò chuyện",
                result:
                  "Phản hồi tiếp tục chạy đúng conversation nguồn khi người dùng chuyển sang conversation khác.",
              }),
              expect.objectContaining({
                improvementKey: "production_background_chat_validation",
                milestones: [
                  expect.objectContaining({
                    status: expect.objectContaining({
                      code: "production_verified",
                    }),
                    statusDate: "2026-08-12",
                  }),
                ],
              }),
            ]),
            initialImprovement:
              "Đồng bộ moderation production, rút gọn phản hồi chuyển hướng và theo dõi tỷ lệ chặn nhầm.",
            deliveryUpdates: expect.arrayContaining([
              expect.objectContaining({
                updateKey: "conversation_continuity",
                label: "Giữ phản hồi khi chuyển cuộc trò chuyện",
                result:
                  "Phản hồi tiếp tục chạy đúng conversation nguồn khi người dùng chuyển sang conversation khác.",
                status: {
                  code: "implemented",
                  rank: 1,
                  label: "Đã code",
                },
                statusDate: "2026-08-10",
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it("returns canonical delivery updates with date-only status history", async () => {
    const { accessToken } = await createTestUser({
      email: "feature-delivery-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get("/api/admin/service-access-policies"),
      accessToken,
    );

    expect(
      response.body.data.communityFeatures.items.flatMap((feature) =>
        (feature.deliveryUpdates || []).map((update) => ({
          featureKey: feature.featureKey,
          status: update.status?.code,
          statusDate: update.statusDate,
        })),
      ),
    ).toEqual([
      {
        featureKey: "ht_assistant",
        status: "implemented",
        statusDate: "2026-08-10",
      },
      {
        featureKey: "ht_assistant",
        status: "implemented",
        statusDate: "2026-08-10",
      },
      {
        featureKey: "ht_assistant",
        status: "implemented",
        statusDate: "2026-08-10",
      },
      {
        featureKey: "ht_assistant",
        status: "production_verified",
        statusDate: "2026-08-12",
      },
      {
        featureKey: "meal_plan",
        status: "implemented",
        statusDate: "2026-08-10",
      },
      {
        featureKey: "meal_plan",
        status: "implemented",
        statusDate: "2026-08-10",
      },
      {
        featureKey: "meal_plan",
        status: "production_verified",
        statusDate: "2026-08-12",
      },
    ]);
  });

  it("returns the approved F0 to F3 priority for every community feature", async () => {
    const { accessToken } = await createTestUser({
      email: "feature-priority-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get("/api/admin/service-access-policies"),
      accessToken,
    );

    expect(
      response.body.data.communityFeatures.items.map((feature) => [
        feature.featureKey,
        feature.priority?.code,
      ]),
    ).toEqual([
      ["ht_assistant", "F1"],
      ["tdee_calculator", "F1"],
      ["meal_plan", "F1"],
      ["meal_scan", "F1"],
      ["recipes", "F2"],
      ["exercise_library", "F1"],
      ["workout_plans", "F1"],
      ["today_dashboard", "F1"],
      ["progress_tracking", "F1"],
      ["gym_finder", "F3"],
      ["blog_knowledge", "F2"],
    ]);
  });

  it("returns the filtered community feature report to admin", async () => {
    const { accessToken } = await createTestUser({
      email: "feature-report-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get(
        "/api/admin/service-access-policies/community-features/report?group=nutrition&audience=customer&status=implemented&from=2026-08-10&to=2026-08-10",
      ),
      accessToken,
    );

    expect({
      status: response.status,
      cacheControl: response.headers["cache-control"],
      body: response.body,
    }).toEqual({
      status: 200,
      cacheControl: "private, no-store",
      body: expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          summary: expect.objectContaining({ eventCount: 2 }),
        }),
      }),
    });
  });

  it("rejects invalid community feature report filters", async () => {
    const { accessToken } = await createTestUser({
      email: "feature-report-invalid-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get(
        "/api/admin/service-access-policies/community-features/report?group=unknown",
      ),
      accessToken,
    );

    expect({ status: response.status, body: response.body }).toEqual({
      status: 400,
      body: {
        success: false,
        code: "COMMUNITY_FEATURE_REPORT_GROUP_INVALID",
        message: "Nhóm tính năng không hợp lệ",
      },
    });
  });

  it("rejects an invalid community feature audience", async () => {
    const { accessToken } = await createTestUser({
      email: "feature-report-invalid-audience-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get(
        "/api/admin/service-access-policies/community-features/report?audience=unknown",
      ),
      accessToken,
    );

    expect({ status: response.status, body: response.body }).toEqual({
      status: 400,
      body: {
        success: false,
        code: "COMMUNITY_FEATURE_REPORT_AUDIENCE_INVALID",
        message: "Đối tượng tính năng không hợp lệ",
      },
    });
  });

  it("downloads the same filtered report as a private PDF", async () => {
    const { accessToken } = await createTestUser({
      email: "feature-report-pdf-admin@example.com",
      role: "admin",
    });

    const response = await withAuth(
      request(app).get(
        "/api/admin/service-access-policies/community-features/report.pdf?group=ai_support&audience=trainer&from=2026-08-10&to=2026-08-10",
      ),
      accessToken,
    );

    expect({
      status: response.status,
      contentType: response.headers["content-type"],
      disposition: response.headers["content-disposition"],
      cacheControl: response.headers["cache-control"],
      prefix: Buffer.from(response.body).subarray(0, 5).toString("ascii"),
    }).toEqual({
      status: 200,
      contentType: "application/pdf",
      disposition:
        'attachment; filename="bao-cao-cai-tien-2026-08-10-den-2026-08-10.pdf"',
      cacheControl: "private, no-store",
      prefix: "%PDF-",
    });
  });

  it("rejects PDF report downloads from non-admin users", async () => {
    const { accessToken } = await createTestUser({
      email: "feature-report-pdf-user@example.com",
      role: "user",
    });

    const response = await withAuth(
      request(app).get(
        "/api/admin/service-access-policies/community-features/report.pdf",
      ),
      accessToken,
    );

    expect(response.status).toBe(403);
  });

  it("rejects non-admin users", async () => {
    const { accessToken } = await createTestUser({
      email: "policy-user@example.com",
      role: "user",
    });

    const response = await withAuth(
      request(app).get("/api/admin/service-access-policies"),
      accessToken,
    );

    expect(response.status).toBe(403);
  });
});
