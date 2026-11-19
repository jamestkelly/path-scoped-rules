import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const run = promisify(execFile);

test("OpenCode sends a rule body only after a matching file read", async t => {
  const root = await mkdtemp(join(tmpdir(), "scoped-host-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cwd = join(root, "repo");
  const config = join(root, "config");
  await mkdir(join(cwd, ".claude/rules"), { recursive: true });
  await mkdir(join(config, "opencode"), { recursive: true });
  await run("git", ["init", "--quiet", cwd]);
  const marker = randomUUID();
  await writeFile(join(cwd, ".claude/rules/guide.md"), `---\npaths: ['match.txt']\n---\n${marker}`);
  for (const file of ["other.txt", "match.txt"]) await writeFile(join(cwd, file), `contents of ${file}`);

  const requests: string[] = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const primary = body.tools?.some((tool: { function?: { name: string } }) => tool.function?.name === "read");
    const step = requests.length;
    if (primary) requests.push(JSON.stringify(body.messages));
    const file = ["other.txt", "match.txt"][step];
    const read = primary && file;
    const delta = read ? { tool_calls: [{ index: 0, id: `call_${step}`, type: "function",
      function: { name: "read", arguments: JSON.stringify({ path: file }) } }] } : { content: "Done" };
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const choice of [{ delta, finish_reason: null }, { delta: {}, finish_reason: read ? "tool_calls" : "stop" }]) {
      res.write(`data: ${JSON.stringify({ id: `completion_${step}`, object: "chat.completion.chunk", model: "stub", created: 1, choices: [{ index: 0, ...choice }] })}\n\n`);
    }
    res.end("data: [DONE]\n\n");
  });
  await new Promise<void>(ok => server.listen(0, "127.0.0.1", ok));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");
  await writeFile(join(config, "opencode/opencode.json"), JSON.stringify({
    plugins: [resolve(".")],
    providers: { fixture: { name: "Local fixture", env: ["FIXTURE_KEY"], package: "@opencode/ai/providers/openai-compatible",
      settings: { baseURL: `http://127.0.0.1:${address.port}/v1` }, models: { stub: { name: "Stub", capabilities: { tools: true } } } } },
  }));
  const result = await run(resolve("node_modules/@opencode/cli/bin/opencode.exe"),
    ["run", "--standalone", "--auto", "--model", "fixture/stub", "--title", "Rule delivery", "Read the fixture files."], {
      cwd, timeout: 45_000, env: { PATH: process.env.PATH, HOME: root, XDG_CONFIG_HOME: config,
        XDG_DATA_HOME: join(root, "data"), XDG_CACHE_HOME: join(root, "cache"), XDG_STATE_HOME: join(root, "state"), FIXTURE_KEY: "local-fixture" },
    });
  assert.equal(requests.length, 3, result.stdout + result.stderr);
  assert.match(requests[0], /\.claude\/rules\/guide\.md/, `rule index missing: ${result.stderr}`);
  assert.ok(!requests[0].includes(marker));
  assert.match(requests[1], /contents of other\.txt/);
  assert.ok(!requests[1].includes(marker));
  assert.ok(requests[2].includes("contents of match.txt"), requests[2].slice(-800));
  assert.ok(requests[2].includes(marker), "matching rule missing from next model request");
});
