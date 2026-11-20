import assert from "node:assert/strict";
import test from "node:test";
import plugin from "../src/tui.ts";

test("/rules lists only activated scoped paths from the selected session", async () => {
  let sessionID = "empty";
  let command!: { slash: { name: string }; run(): Promise<void> };
  const dialogs: { title: string; message: string }[] = [];
  const host = {
    keymap: { layer(factory: () => { mode?: string; commands: typeof command[] }) {
      const layer = factory();
      assert.equal(layer.mode, "global", "slash command must be reachable with the prompt focused");
      [command] = layer.commands;
    } },
    ui: {
      router: { current: () => ({ type: "session", sessionID }) },
      dialog: { alert: (dialog: typeof dialogs[number]) => dialogs.push(dialog) },
    },
    client: { experimental: { session: { instructions: { entry: {
      list: ({ sessionID: selected }: { sessionID: string }) => selected === "active" ? [
        { key: "path-scoped-rules.a", value: ".claude/rules/backend.md\nPrivate rule body" },
        { key: "another-plugin", value: "Other instructions" },
      ] : [],
    } } } } },
  };
  await plugin.setup(host as unknown as Parameters<typeof plugin.setup>[0]);
  assert.equal(command.slash.name, "rules");
  await command.run();
  assert.match(dialogs[0].message, /No path-scoped rules/);
  sessionID = "active";
  await command.run();
  assert.deepEqual(dialogs[1], { title: "1 scoped rule applied", message: ".claude/rules/backend.md" });
});
