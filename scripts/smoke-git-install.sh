#!/usr/bin/env bash
set -euo pipefail

cli="$(pwd)/node_modules/@opencode/cli/bin/opencode.exe"
consumer=$(mktemp -d)
trap 'rm -rf "$consumer"' EXIT
cd "$consumer"
env -i PATH="$PATH" HOME="$consumer" XDG_CONFIG_HOME="$consumer/config" \
  XDG_DATA_HOME="$consumer/data" XDG_STATE_HOME="$consumer/state" XDG_CACHE_HOME="$consumer/cache" \
  "$cli" plugin add "github:jamestkelly/path-scoped-rules#${1:?Expected a packaged revision}"
