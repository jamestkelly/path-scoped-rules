import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import plugin from "../src/index.ts";
import { matches, parseRule, ruleKey } from "../src/rules.ts";

test("entry keys show the rule path without conflating directories, punctuation or case", () => {
  assert.equal(ruleKey(join(".claude", "rules", "backend", "code-style.md")), "path-scoped-rules.claude.rules.backend.code-style.md");
  const keys = ["a/b", "a.b", "A.b", "a_2e_b", "a b", "日本語"].map(name => ruleKey(join(".agent", `${name}.md`)));
  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) assert.match(key, /^[a-z0-9][a-z0-9._-]*$/);
});

test("invalid scopes never silently become global", () => {
  assert.throws(() => parseRule("bad.md", "---\npaths: 123\n---\nhello"), /paths/);
  assert.throws(() => parseRule("bad.md", "---\npaths: []"), /unclosed/);
});

test("relative paths use the workspace; exclusions and checkout boundaries win", () => {
  const rule = parseRule("testing.md", "---\npaths: ['backend/**/*.{ts,js}', '!backend/**/deploy/**']\n---\nTest");
  assert.ok(matches(rule, "/repo", "/repo/backend", "service/test.ts"));
  assert.ok(!matches(rule, "/repo", "/repo/backend", "service/deploy/test.js"));
  assert.ok(!matches(rule, "/repo", "/repo/backend", "/other/backend/test.ts"));
});

test("plugin scopes each convention and activates every matching patch destination", async t => {
  const root = await mkdtemp(join(tmpdir(), "path-scoped-rules-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries({
    ".agent/common.md": "All contributors",
    ".agent/skills/example.md": "Not a rule",
    ".agent/rules/ui/view.md": "---\npaths: 'frontend/**'\n---\nUI guidance",
    ".claude/rules/db.md": "---\npaths: ['backend/**']\n---\nDB guidance",
  })) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), content);
  }
  const entries = new Map<string, string>();
  type ContextHook = (event: { sessionID: string; system: { text: string }[]; messages: unknown[] }) => Promise<void>;
  type BeforeHook = (event: { tool: string; input: unknown; sessionID: string }) => Promise<void>;
  type Entry = { sessionID: string; key: string; value: string };
  let context!: ContextHook;
  let before!: BeforeHook;
  const host = {
    location: { directory: root, project: { directory: root } },
    session: { hook: (_: string, fn: ContextHook) => { context = fn; },
      instructions: { entry: { list: ({ sessionID }: { sessionID: string }) =>
        [...entries].filter(([id]) => id.startsWith(`${sessionID}:`)).map(([id, value]) => ({ key: id.slice(sessionID.length + 1), value })),
        put: ({ sessionID, key, value }: Entry) =>
      entries.set(`${sessionID}:${key}`, value) } } },
    tool: { hook: (_: string, fn: BeforeHook) => { before = fn; } },
  };
  await plugin.setup(host as unknown as Parameters<typeof plugin.setup>[0]);
  const system: { text: string }[] = [];
  await context({ system, sessionID: "one", messages: [] });
  assert.match(system.map(p => p.text).join("\n"), /All contributors/);
  assert.doesNotMatch(system.map(p => p.text).join("\n"), /UI guidance|DB guidance|Not a rule/);
  await before({ tool: "read", input: { path: "frontend/view.ts" }, sessionID: "one" });
  assert.equal(entries.size, 1);
  assert.match([...entries.values()][0], /UI guidance/);
  const move = { tool: "patch", input: "*** Update File: backend/a.ts\n*** Move to: frontend/a.ts", sessionID: "two" };
  await assert.rejects(before(move), /No files changed.*\.agent\/rules\/ui\/view\.md.*\.claude\/rules\/db\.md/);
  assert.equal(entries.size, 3);
  assert.ok([...entries].some(([key, value]) => key.startsWith("two:") && value.includes("DB guidance")));
  await assert.rejects(before({ tool: "edit", input: { path: "frontend/view.ts" }, sessionID: "one" }), /No files changed/);
  await context({ sessionID: "one", messages: [], system: [{ text: [...entries.values()][0] }] });
  await before({ tool: "write", input: { path: "frontend/view.ts" }, sessionID: "one" });
  await before({ tool: "edit", input: { path: "README.md" }, sessionID: "two" });
});
