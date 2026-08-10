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
  resolveDefaultAdminTrainer,
  selectDefaultAdminTrainer,
} from "../defaultAdminTrainer.service.js";

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("default admin trainer resolver", () => {
  it("prefers an explicit admin ID over ADMIN_EMAIL", async () => {
    const explicit = await createTestUser({
      role: "admin",
      email: "explicit-admin@example.com",
    });
    await createTestUser({ role: "admin", email: "fallback@example.com" });

    const trainer = await resolveDefaultAdminTrainer({
      env: {
        DEFAULT_ADMIN_TRAINER_ID: String(explicit.user._id),
        ADMIN_EMAIL: "fallback@example.com",
      },
    });

    expect(String(trainer._id)).toBe(String(explicit.user._id));
  });

  it("falls back to the first configured ADMIN_EMAIL and requires admin role", async () => {
    const admin = await createTestUser({
      role: "admin",
      email: "primary-admin@example.com",
    });
    await createTestUser({ role: "user", email: "secondary@example.com" });

    const trainer = await resolveDefaultAdminTrainer({
      env: {
        ADMIN_EMAIL: "primary-admin@example.com, secondary@example.com",
      },
    });

    expect(String(trainer._id)).toBe(String(admin.user._id));
  });

  it("fails closed when an explicit ID is invalid", () => {
    let thrown;
    try {
      selectDefaultAdminTrainer({
        DEFAULT_ADMIN_TRAINER_ID: "invalid",
        ADMIN_EMAIL: "fallback@example.com",
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      codeName: "INVALID_DEFAULT_TRAINER_CONFIG",
    });
  });
});
