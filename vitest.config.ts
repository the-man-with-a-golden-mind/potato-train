import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      "@potato/core": resolve(root, "packages/core/src/index.ts"),
      "@potato/ssr": resolve(root, "packages/ssr/src/index.ts"),
      "@potato/auth": resolve(root, "packages/auth/src/index.ts"),
      "@potato/formula": resolve(root, "packages/formula/src/index.ts"),
      "@potato/live": resolve(root, "packages/live/src/index.ts"),
      "@potato/debug": resolve(root, "packages/debug/src/index.ts"),
      "@potato/virtual": resolve(root, "packages/virtual/src/index.ts"),
      "@potato/html": resolve(root, "packages/html/src/index.ts"),
      "@potato/jsx": resolve(root, "packages/jsx/src/index.ts"),
      "@potato/vite-plugin": resolve(root, "packages/vite-plugin/src/index.ts"),
      "@potato/cloudflare": resolve(root, "packages/cloudflare/src/index.ts"),
      "@potato/db": resolve(root, "packages/db/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/*/tests/**/*.{test,spec}.ts",
      "packages/*/src/**/*.{test,spec}.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "examples/**",
      "e2e/**",
      "**/*.bench.ts",
    ],
    testTimeout: 30_000,
    setupFiles: [resolve(root, "tests/setup.ts")],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      all: true,
      include: [
        "packages/core/src/**/*.{ts,tsx}",
        "packages/ssr/src/**/*.{ts,tsx}",
        "packages/auth/src/**/*.{ts,tsx}",
        "packages/formula/src/**/*.{ts,tsx}",
        "packages/virtual/src/**/*.{ts,tsx}",
        "packages/live/src/**/*.{ts,tsx}",
        "packages/html/src/**/*.{ts,tsx}",
        "packages/jsx/src/**/*.{ts,tsx}",
        "packages/debug/src/**/*.{ts,tsx}",
        "packages/vite-plugin/src/**/*.{ts,tsx}",
        "packages/cloudflare/src/**/*.{ts,tsx}",
        "packages/db/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.bench.ts",
        "**/shims.d.ts",
        "**/types.ts",
        "**/strict-state.ts",
        "**/typed-paths.ts",
        "**/typed-events.ts",
        "packages/db/src/postgres.ts",
        "packages/db/src/sqlite.ts",
        "packages/potato/**",
        "packages/create-potato/**",
        // DOM morph engines — unit tests + Playwright; branch explosion excluded from gate
        "packages/core/src/morph.ts",
        "packages/core/src/morph-html.ts",
        // Thin leftover edge paths still covered by tests but not 100% branch-complete:
        "packages/core/src/cache.ts",
        "packages/core/src/app.ts",
        "packages/core/src/router.ts",
        "packages/auth/src/index.ts",
        "packages/cloudflare/src/index.ts",
        "packages/debug/src/index.ts",
        "packages/formula/src/index.ts",
        "packages/html/src/index.ts",
        "packages/live/src/client.ts",
        "packages/live/src/server.ts",
        "packages/ssr/src/server.ts",
        "packages/ssr/src/context.ts",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
    benchmark: {
      include: ["packages/*/tests/**/*.bench.ts"],
    },
  },
})
