#!/usr/bin/env bash
set -euo pipefail

source_sha=$(git rev-parse HEAD)
previous=refs/remotes/origin/release-dist
test -s dist/index.js
test -s dist/rules.js
if git show-ref --verify --quiet "$previous"; then
  if [[ $(git rev-parse "$previous^1") == "$source_sha" ]]; then
    git switch -C release-dist "$previous"
    exit 0
  fi
  git merge-base --is-ancestor "$previous^1" "$source_sha"
fi

git switch -C release-dist "$source_sha"
if git show-ref --verify --quiet "$previous"; then
  git merge --no-ff --no-commit -s ours "$previous"
fi
git add --force -- dist/
jq 'del(.scripts, .devDependencies)' package.json > package.runtime.json
mv package.runtime.json package.json
git add package.json
git commit -m 'build: Package OpenCode plugin'
git push origin HEAD:refs/heads/release-dist
