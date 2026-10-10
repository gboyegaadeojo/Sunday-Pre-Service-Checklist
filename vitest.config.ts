import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    test: {
      // How many test files run at once. Each server test file gets its own Workers runtime and local D1, and the
      // default (one per CPU core) ran this 16-core, 16 GB machine out of memory. TEST_WORKERS overrides it.
      maxWorkers: Number(process.env.TEST_WORKERS) || 4,
      projects: [
        {
          // Server: the Worker inside the Workers runtime with a fresh local D1.
          plugins: [
            cloudflareTest({
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: {
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  // A fresh random key per run, so no secret is ever written into the repo.
                  SESSION_SECRET: crypto.randomUUID(),
                  DEV_AUTH: "true",
                  // Tests never reach the real Planning Center, whatever a developer's .dev.vars holds: the sample
                  // schedule and test users only (tests that need Planning Center fake its responses).
                  SCHEDULE_SOURCE: "",
                  PCO_PAT_ID: "",
                  PCO_PAT_SECRET: "",
                  PCO_CLIENT_ID: "",
                  PCO_CLIENT_SECRET: "",
                },
              },
            }),
          ],
          test: {
            name: "worker",
            include: ["test/**/*.test.ts"],
            exclude: ["test/client/**"],
            setupFiles: ["./test/apply-migrations.ts"],
          },
        },
        {
          // Browser code: React components and hooks in a simulated DOM, with fetch faked per test.
          plugins: [react()],
          test: {
            name: "client",
            include: ["test/client/**/*.test.tsx"],
            environment: "happy-dom",
          },
        },
      ],
    },
  };
});
