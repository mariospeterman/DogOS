import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...tseslint.configs.recommended,
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@next/next/no-html-link-for-pages": ["error", "apps/web"],
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/.next-*/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/next-env.d.ts",
  ]),
]);
