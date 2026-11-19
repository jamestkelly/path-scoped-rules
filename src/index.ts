import { Plugin } from "@opencode/plugin";
import { loadRules, matches, targets } from "./rules.ts";

export default Plugin.define({
  id: "path-scoped-rules",
  async setup(ctx) {
    const root = ctx.location.project.directory;
    const rules = await loadRules(root);
    if (!rules.length) return;
    const scoped = rules.filter(rule => rule.paths.length);
    await ctx.session.hook("context", event => {
      for (const rule of rules.filter(rule => !rule.paths.length)) {
        event.system.push({ type: "text", text: `${rule.file}\n${rule.text}` });
      }
      if (scoped.length) event.system.push({ type: "text", text: [
        "Before composing a direct edit or patch, read applicable rule files below if their contents are not already in context. Paths are project-relative; ! excludes matches.",
        ...scoped.map(rule => `${rule.file}: ${rule.paths.join(", ")}`),
      ].join("\n") });
    });
    await ctx.tool.hook("execute.before", async event => {
      const paths = targets(event.tool, event.input);
      for (const rule of scoped) {
        if (paths.some(path => matches(rule, root, ctx.location.directory, path))) {
          await ctx.session.instructions.entry.put({
            sessionID: event.sessionID,
            key: `path-scoped-rules/${rule.file}`,
            value: `${rule.file}\n${rule.text}`,
          });
        }
      }
    });
  },
});
