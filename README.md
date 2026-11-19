# path-scoped-rules

Give [OpenCode](https://opencode.ai) the Markdown rules that apply to the file it’s working on. Reuse your existing `.claude/rules/` files: a backend logging rule can stay out of the conversation until the agent reads backend code. Tested with OpenCode 2.3.2.

## Install

To use the plugin in **all your OpenCode projects**, install the [v1.0.1 release](https://github.com/jamestkelly/path-scoped-rules/releases/tag/v1.0.1) and check that it appears in the plugin list:

```sh
opencode plugin add github:jamestkelly/path-scoped-rules#v1.0.1
opencode plugin list
```

## Quick start

Save this as `.claude/rules/logging.md`:

```markdown
---
paths:
  - "backend/**/*.ts"
  - "!backend/**/deploy/**"
---
Use the project's structured logger in backend code.
```

After adding or editing a rule, run `/reload` in OpenCode and start a fresh session. For the rule above:

| First file read | Is the logging instruction in the next model request? |
| --- | --- |
| `backend/orders/create.ts` | Yes |
| `backend/orders/deploy/stack.ts` | No — explicitly excluded |
| `frontend/orders/create.ts` | No — outside `backend/` |

Once activated, the rule stays in that session. Reading a different file later does not remove it.

## Share with a team

Add this entry to `plugins` in the project's `opencode.jsonc` or `.opencode/opencode.jsonc`. This pins the packaged commit for v1.0.1; contributors do not need a separate global install.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:jamestkelly/path-scoped-rules#2fd74d2c2552cfcb2086dfb10a561975abedcbda"]
}
```

Use a tag or commit from [GitHub Releases](https://github.com/jamestkelly/path-scoped-rules/releases) rather than `main`: released revisions include the built plugin.

## Rule discovery

The plugin combines `.claude/rules/**/*.md`, `.agent/rules/**/*.md`, and `.agent/*.md`. Other `.agent/` subdirectories are ignored.

Patterns match repository-relative paths, including dotfiles. A match on an exclusion wins. A single glob string also works. Omit `paths` for an always-on rule. Rule discovery reads regular `.md` files; it does not traverse symlinked entries.

## When guidance appears

Unscoped text and an index of scoped rule paths are included before model decisions. For explicit `read`, `edit`, `write`, and `patch` targets, matching rule bodies become keyed session instructions for subsequent decisions. A multi-file patch activates rules for both sides of a move.

For a direct write, the index asks the agent to read applicable rules **before composing** the change. A tool hook cannot retroactively change a patch the model already wrote. The plugin supplies guidance, not enforcement. It does not infer files accessed inside shell commands or MCP tools.

## Development

To try a local change, run `pnpm install --frozen-lockfile` and `pnpm validate` with Node.js 24 in this checkout. Validation type-checks, runs the tests, builds `dist/`, and verifies rule delivery in a real OpenCode session. Set the `plugins` entry in your test project's config to the absolute path of this checkout.

See [Contributing](CONTRIBUTING.md), [Security](SECURITY.md), and the [MIT license](LICENSE).
