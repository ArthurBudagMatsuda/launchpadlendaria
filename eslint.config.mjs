import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["e2e/**/*.ts"],
    rules: {
      // Playwright fixtures receive a `use` callback; it is not a React hook.
      "react-hooks/rules-of-hooks": "off",
      // Fixtures name dependencies they only need for ordering with a leading _.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    ".qa/**",
    "packages/**",
    "examples/**",
  ]),
]);
