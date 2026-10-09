import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    test: {
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
