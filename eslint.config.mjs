import tsParser from "@typescript-eslint/parser";

const safetyRules = {
  "no-debugger": "error",
  "no-unreachable": "error",
  "no-constant-condition": ["error", { checkLoops: false }],
};

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "app/generated-master-plan-test-ids.ts",
    ],
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: safetyRules,
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: safetyRules,
  },
];
