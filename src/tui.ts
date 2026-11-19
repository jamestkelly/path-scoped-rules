import type { Plugin } from "@opencode/plugin/tui";

/** Show the plugin's applied instruction paths without exposing rule bodies or other instructions. */
const plugin: Plugin.Definition = {
  id: "path-scoped-rules",
  setup({ client, keymap, ui }) {
    keymap.layer(() => ({
      commands: [{
        id: "path-scoped-rules.show",
        title: "Show applied path-scoped rules",
        palette: true,
        slash: { name: "rules" },
        enabled: () => ui.router.current().type === "session",
        async run() {
          const route = ui.router.current();
          if (route.type !== "session") return;
          const entries = await client.experimental.session.instructions.entry.list({ sessionID: route.sessionID });
          const paths = entries.flatMap(({ key, value }) =>
            key.startsWith("path-scoped-rules.") && typeof value === "string" ? [value.split("\n", 1)[0]] : []
          ).sort();
          await ui.dialog.alert({
            title: `${paths.length} scoped ${paths.length === 1 ? "rule" : "rules"} applied`,
            message: paths.join("\n") || "No path-scoped rules have been applied in this session.",
          });
        },
      }],
    }));
  },
};

export default plugin;
