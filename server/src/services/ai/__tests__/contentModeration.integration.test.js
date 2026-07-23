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
} from "../../../__tests__/setup.js";
import AiModerationState from "../../../models/AiModerationState.js";
import User from "../../../models/User.js";
import { isUserLocked, moderateContent } from "../contentModeration.js";

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("persistent AI moderation", () => {
  it("persists warnings and temporary locks in MongoDB", async () => {
    const { user } = await createTestUser();

    const first = await moderateContent(user._id, "fuck");
    const second = await moderateContent(user._id, "shit");
    const state = await AiModerationState.findOne({ userId: user._id }).lean();
    const lock = await isUserLocked(user._id);

    expect(first.warning).toBe(true);
    expect(second.safe).toBe(false);
    expect(state.warnings).toBe(2);
    expect(lock.blocked).toBe(true);
  });

  it("persists the permanent ban on the third violation", async () => {
    const { user } = await createTestUser();
    await moderateContent(user._id, "fuck");
    await moderateContent(user._id, "shit");
    await moderateContent(user._id, "bitch");

    const storedUser = await User.findById(user._id).lean();
    expect(storedUser.isAiChatBanned).toBe(true);
    expect(await AiModerationState.exists({ userId: user._id })).toBeNull();
  });
});
