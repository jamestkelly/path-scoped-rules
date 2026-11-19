# Working on path-scoped-rules

- Keep rule discovery, parsing, and matching in `src/rules.ts`. `src/index.ts` adapts those rules to the OpenCode server hooks.
- For scope changes, test a matching and nonmatching path, plus any exclusions. For tool changes, test when the rule body reaches the session; do not promise it retroactively affects an edit.
- Run the checks in [CONTRIBUTING.md](CONTRIBUTING.md). Keep generated `dist/` off source branches. Only the release pipeline commits the runtime.
- Add required PR jobs to `review-gate.needs`. Keep `Review Gate` stable for downstream branch protection.
