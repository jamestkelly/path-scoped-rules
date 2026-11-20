import { Plugin } from "@opencode/plugin";
import { loadRules, matches, ruleKey, targets } from "./rules.ts";

const MAX_REQUEST_SNAPSHOTS = 256;

export default Plugin.define({
  id: "path-scoped-rules",
  async setup(ctx) {
    const root = ctx.location.project.directory;
    const rules = await loadRules(root);
    if (!rules.length) return;
    const scoped = rules.filter(rule => rule.paths.length);
    const visibleBySession = new Map<string, Set<string>>();
    await ctx.session.hook("context", async event => {
      const instructions = [
        ...event.system.map(part => part.text),
        ...event.messages.filter(message => message.role === "system").flatMap(message =>
          typeof message.content === "string" ? [message.content] : message.content.flatMap(part => part.type === "text" ? [part.text] : [])),
      ];
      const active = new Map((scoped.length ? await ctx.session.instructions.entry.list({ sessionID: event.sessionID }) : [])
        .map(entry => [entry.key as string, entry.value]));
      const visible = new Set<string>();
      for (const rule of scoped) {
        const key = ruleKey(rule.file);
        const body = `${rule.file}\n${rule.text}`;
        if (active.get(key) !== body) continue;
        if (!instructions.some(text => text.includes(body))) event.system.push({ type: "text", text: body });
        visible.add(key);
      }
      visibleBySession.delete(event.sessionID);
      visibleBySession.set(event.sessionID, visible);
      if (visibleBySession.size > MAX_REQUEST_SNAPSHOTS) visibleBySession.delete(visibleBySession.keys().next().value!);
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
      const missing: string[] = [];
      const visible = visibleBySession.get(event.sessionID);
      for (const rule of scoped) {
        const key = ruleKey(rule.file);
        if (!visible?.has(key) && paths.some(path => matches(rule, root, ctx.location.directory, path))) {
          await ctx.session.instructions.entry.put({
            sessionID: event.sessionID,
            key,
            value: `${rule.file}\n${rule.text}`,
          });
          missing.push(rule.file);
        }
      }
      if (missing.length && event.tool !== "read") {
        throw new Error(`No files changed by this call. Review the newly applied rules and retry: ${missing.join(", ")}`);
      }
    });
  },
});
