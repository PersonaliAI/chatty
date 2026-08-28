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
    // Generated, minified widget bundle (packages/chatty-react's tsup
    // build output, copied here as the actual served asset) - not source,
    // and linting a single ~1.7MB minified line was producing 80+ false
    // no-this-alias/no-array-constructor "errors" from ordinary minifier
    // output patterns (huge column numbers like 347:275774 are the tell),
    // failing CI on every push regardless of what the push changed.
    // widget.js stays linted - that one's real hand-written source.
    "public/chatty-app.js",
    // Same problem, same package's other build output: tsup's compiled
    // dist/index.js (the React SDK bundle) and its bundled deps
    // (emoji-picker-react etc.) are also generated, not source - linting
    // them was the larger share of the false-positive count (340 errors).
    "packages/chatty-react/dist/**",
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
      // Same reasoning as the three above - flags manual useCallback/
      // useMemo dep arrays that don't match what the (unenabled) compiler
      // would infer, not an actual bug. Was failing CI on inbox-panel.tsx
      // (setState setters omitted from deps, which is fine - React
      // guarantees their identity is stable - and one dep the compiler
      // considers possibly-mutated later).
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);

export default eslintConfig;
