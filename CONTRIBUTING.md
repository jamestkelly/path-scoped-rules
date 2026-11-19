# Contributing

When reporting a rule-loading issue, include the OpenCode version, rule frontmatter, repository-relative target path, and tool name. Replace private rule text with a minimal example.

With Node.js 24 and the pnpm version in `package.json`, run:

```sh
pnpm install --frozen-lockfile
pnpm validate
bash scripts/smoke-package.sh
actionlint
```

PRs require **Review Gate**: the source branch name, plugin validation, and packed-install smoke test must pass. Use a Conventional Commit PR title; squash merges use it for release notes.

`pnpm validate` launches the pinned OpenCode CLI against a loopback model stub. It checks that a rule body first appears in the model request after a matching read. No provider credentials are needed. Keep the CLI and plugin SDK versions aligned when upgrading.

## Releases

On `main`, CI rebuilds the package and makes a commit containing `dist/` on `release-dist`. Semantic-release tags that packaged commit and publishes a GitHub Release for release-worthy changes. Breaking changes bump major, `feat` bumps minor, and `fix`, `perf`, or `chore` bump patch. Docs, CI, and tests alone do not produce versions.

Install a release tag or pin its full commit SHA. Ordinary `main` and PR commits are source-only. The moving major alias advances only after the exact release exists. To retry a failed release, inspect existing tags and use **Release → Run workflow** on `main`. The plugin is distributed through Git; there is no npm or GitHub Marketplace publication.
