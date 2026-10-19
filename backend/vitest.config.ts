import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Starts one in-memory MongoDB for the whole run (downloaded on the first run).
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // Test files share the database: run them one after the other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
