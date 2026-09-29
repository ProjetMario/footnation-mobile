import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "expo-crypto": fileURLToPath(
        new URL("./tests/crypto.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/core.test.ts", "tests/team-calendar.test.ts"],
    environment: "node",
    pool: "forks",
    maxWorkers: 1,
  },
});
