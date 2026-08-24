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
    // Leftover worktree build output (contains its own .next/**, which the
    // pattern above doesn't reach since it's nested under a different root).
    ".claude/worktrees/**",
  ]),
  {
    rules: {
      // React Compiler *readiness* checks (from eslint-plugin-react-hooks),
      // not runtime-correctness rules — they flag patterns the not-yet-
      // adopted React Compiler couldn't safely auto-memoize (functions
      // referenced before their `const` declaration in source order, refs
      // read during render, impure calls like Date.now() during render).
      // This project doesn't enable the compiler anywhere (no
      // experimental.reactCompiler in next.config.ts, no babel-plugin-
      // react-compiler dependency), so these patterns are safe today —
      // JS closures resolve `const` handlers correctly by the time they're
      // actually invoked, well after the component's first render pass
      // completes. Revisit this exclusion if the compiler is ever adopted.
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
