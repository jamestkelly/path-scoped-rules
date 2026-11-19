#!/usr/bin/env bash
set -euo pipefail

consumer=$(mktemp -d)
trap 'rm -rf "$consumer"' EXIT
pnpm pack --pack-destination "$consumer"
cd "$consumer"
printf '{"private":true,"type":"module"}\n' > package.json
pnpm add ./path-scoped-rules-*.tgz
node --input-type=module <<'JS'
import assert from "node:assert/strict";
import plugin from "path-scoped-rules";
import tui from "path-scoped-rules/tui";
assert.equal(plugin.id, "path-scoped-rules");
assert.equal(typeof plugin.setup, "function");
assert.equal(tui.id, plugin.id);
assert.equal(typeof tui.setup, "function");
JS
