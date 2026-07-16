import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
    maxWorkers: 4,
    passWithNoTests: false,
    reporters: ["default"],
  },
});
