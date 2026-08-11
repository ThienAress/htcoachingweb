import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.js"],
    exclude: ["node_modules"],
    globalSetup: ["src/__tests__/globalSetup.js"],
    // Windows fork workers have exited under the full memory-heavy suite.
    // Keep the previously verified single-thread lane; integration files share
    // one replica set and drop their isolated worker database during teardown.
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
