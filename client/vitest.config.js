import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [],
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{js,jsx}"],
    exclude: ["node_modules", "dist"],
  },
});
