import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [],
  test: {
    environment: "node",
    include: [
      "src/**/__tests__/**/*.test.{js,jsx}",
      "scripts/**/__tests__/**/*.test.js",
    ],
    exclude: ["node_modules", "dist"],
  },
});
