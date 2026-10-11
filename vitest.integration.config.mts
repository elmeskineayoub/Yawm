import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests talk to a real local Supabase stack (`npm run db:start`).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Tests share one database; run files sequentially to keep failures easy to read.
    fileParallelism: false,
  },
});
