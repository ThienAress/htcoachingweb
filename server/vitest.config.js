import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.js"],
    exclude: ["node_modules"],
    fileParallelism: false,
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
