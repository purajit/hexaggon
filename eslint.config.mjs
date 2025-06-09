import { defineConfig } from "eslint/config";
import globals from "globals";

import css from "@eslint/css";
import html from "@html-eslint/eslint-plugin";
import tseslint from "typescript-eslint";
import eslint from "@eslint/js";

export default defineConfig([
  {
    ...eslint.configs.recommended,
    files: ["**/*.ts"],
  },
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  { files: ["**/*.ts"], languageOptions: { sourceType: "script" } },
  {
    files: ["**/*.{ts}"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
    rules: {
      "css/use-baseline": [
        "warn",
        {
          available: "newly",
        },
      ],
    },
  },
  {
    ...html.configs["flat/recommended"],
    files: ["**/*.html"],
    rules: {
      "@html-eslint/indent": ["error", 2],
    },
  },
]);
