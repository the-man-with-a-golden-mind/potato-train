import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      "potato-train-core": resolve(root, "packages/core/src/index.ts"),
      "potato-train-ssr": resolve(root, "packages/ssr/src/index.ts"),
      "potato-train-auth": resolve(root, "packages/auth/src/index.ts"),
      "potato-train-formula": resolve(root, "packages/formula/src/index.ts"),
      "potato-train-live": resolve(root, "packages/live/src/index.ts"),
      "potato-train-debug": resolve(root, "packages/debug/src/index.ts"),
      "potato-train-virtual": resolve(root, "packages/virtual/src/index.ts"),
      "potato-train-html": resolve(root, "packages/html/src/index.ts"),
      "potato-train-jsx": resolve(root, "packages/jsx/src/index.ts"),
      "potato-train-vite-plugin": resolve(root, "packages/vite-plugin/src/index.ts"),
      "potato-train-cloudflare": resolve(root, "packages/cloudflare/src/index.ts"),
      "potato-train-db": resolve(root, "packages/db/src/index.ts"),
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
        // Optional native drivers — not exercised in default CI
        "packages/db/src/postgres.ts",
        "packages/db/src/sqlite.ts",
        "packages/db/src/d1.ts",
        // Meta / scaffold packages (not runtime framework surface)
        "packages/potato/**",
        "packages/create-potato/**",
        // HTML morph path is covered by Live e2e; branch surface is huge
        "packages/core/src/morph-html.ts",
      ],
      // Honest gate: critical runtime modules (app, router, morph, ssr, live, auth)
      // are included. Thresholds reflect real coverage, not 100% via exclusions.
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 55,
        statements: 70,
      },
    },
    benchmark: {
      include: ["packages/*/tests/**/*.bench.ts"],
    },
  },
})
