import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import {
  runTodayDashboardPhase6Migration,
  verifyTodayDashboardPhase6Migration,
} from "../../migrations/20260729-today-dashboard-phase6.js";
import CoachingCommentRevision from "../../models/CoachingCommentRevision.js";
import DailyJournal from "../../models/DailyJournal.js";
import InAppNotification from "../../models/InAppNotification.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import {
  runTodayDashboardPerformanceCheck,
} from "../todayDashboardPerformance.js";
import { getVietnamDateKey } from "../../utils/dateKey.js";

beforeAll(async () => {
  await setupTestDB();
  await Promise.all([
    CoachingCommentRevision.init(),
    DailyJournal.init(),
    InAppNotification.init(),
    WeeklyCheckin.init(),
  ]);
});
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("Today Dashboard Phase 6 performance gates", () => {
  it("creates index-only migration and keeps explain/load budgets green", async () => {
    const migration = await runTodayDashboardPhase6Migration();
    const client = await createTestUser({
      email: "today-performance@example.com",
    });
    const result = await runTodayDashboardPerformanceCheck({
      clientId: client.user._id,
      dateKey: getVietnamDateKey(),
      iterations: 1,
    });

    expect(migration.documentsModified).toBe(0);
    expect(migration.verification.totalIssues).toBe(0);
    expect((await verifyTodayDashboardPhase6Migration()).totalIssues).toBe(0);
    expect(result.queryPlans).toHaveLength(7);
    expect(result.queryPlans.every((plan) => plan.pass)).toBe(true);
    expect(result.load.pass).toBe(true);
    expect(result.totalIssues).toBe(0);
  });
});
