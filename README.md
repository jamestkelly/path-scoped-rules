# path-scoped-rules

An OpenCode 2.3.2 server plugin that loads Markdown guidance for the files an agent works on. Keep rules under `.claude/rules/` or `.agent/rules/` (both recursive), or directly under `.agent/`. The plugin combines these sources and ignores unrelated `.agent/` subdirectories.

## Use locally

With Node.js 24 and pnpm, run `pnpm install --frozen-lockfile` and `pnpm validate` in this checkout. Add its absolute directory to `plugins` in your project's `opencode.jsonc`, or in `~/.config/opencode/opencode.jsonc` for all projects:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/path-scoped-rules"]
}
```

Keep the checkout in place. After editing rules, use OpenCode's `/reload` and start a fresh session.

## Rule format

```markdown
---
paths:
  - "backend/**/*.ts"
  - "!backend/**/deploy/**"
---
Use the project's structured logger in backend code.
```

Patterns match repository-relative paths, including dotfiles. A match on an exclusion wins. A single glob string also works. Omit `paths` for an always-on rule. Rule discovery reads regular `.md` files; it does not traverse symlinked entries.

## When guidance appears

Unscoped text and an index of scoped rule paths are included before model decisions. For explicit `read`, `edit`, `write`, and `patch` targets, matching rule bodies become keyed session instructions for subsequent decisions. A multi-file patch activates rules for both sides of a move.

For a direct write, the index asks the agent to read applicable rules **before composing** the change. A tool hook cannot retroactively change a patch the model already wrote. The plugin supplies guidance, not enforcement. It does not infer files accessed inside shell commands or MCP tools.

## Development

Use `pnpm test` for behavior tests, `pnpm typecheck` for strict TypeScript checks, and `pnpm build` to update `dist/`. `pnpm validate` runs all three. Commit changes using Conventional Commits.
