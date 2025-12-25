import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Custom rules
  {
    rules: {
      // Strict rules - all errors must be fixed
      "@typescript-eslint/no-explicit-any": "error",
      "react/no-unescaped-entities": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-require-imports": "error",
    },
  },
]);

export default eslintConfig;
