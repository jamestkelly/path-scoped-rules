import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { minimatch } from "minimatch";
import { parse } from "yaml";
/** Encode a discovered Markdown path as a readable, slash-free OpenCode entry key. */
export function ruleKey(file) {
    const stem = file.slice(1, -3);
    const parts = stem.split(sep).map(part => part.replace(/[^a-z0-9-]/gu, char => `_${Buffer.from(char).toString("hex")}_`));
    return `path-scoped-rules.${parts.join(".")}.md`;
}
/** Split Markdown from YAML without treating invalid frontmatter as global guidance. */
export function parseRule(file, markdown) {
    const source = markdown.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
    if (!/^---[ \t]*$/.test(source.split("\n", 1)[0]))
        return { file, paths: [], text: source };
    const header = /^---[ \t]*\n([\s\S]*?)^---[ \t]*(?:\n|$)/m.exec(source);
    if (!header)
        throw new Error(`${file}: unclosed YAML frontmatter`);
    const metadata = parse(header[1]);
    if (metadata !== null && (typeof metadata !== "object" || Array.isArray(metadata))) {
        throw new Error(`${file}: expected a YAML mapping`);
    }
    const paths = metadata && "paths" in metadata ? metadata.paths : [];
    const patterns = typeof paths === "string" ? [paths] : paths;
    if (!Array.isArray(patterns) || !patterns.every(p => typeof p === "string" && p.trim())) {
        throw new Error(`${file}: expected paths to contain glob strings`);
    }
    return { file, paths: patterns, text: source.slice(header[0].length).trim() };
}
/** Read regular Markdown files in stable order from this checkout's rules tree. */
async function markdownFiles(directory, recursive) {
    const files = await readdir(directory, { recursive, withFileTypes: true }).catch((error) => {
        if (error.code === "ENOENT")
            return [];
        throw error;
    });
    return files.filter(f => f.isFile() && f.name.endsWith(".md")).map(f => join(f.parentPath, f.name));
}
/** Discover both conventions without treating unrelated .agent subdirectories as rules. */
export async function loadRules(root) {
    const groups = await Promise.all([
        markdownFiles(join(root, ".claude/rules"), true),
        markdownFiles(join(root, ".agent/rules"), true),
        markdownFiles(join(root, ".agent"), false),
    ]);
    return Promise.all(groups.flat().sort().map(async (file) => parseRule(relative(root, file), await readFile(file, "utf8"))));
}
/** Only consider paths inside the current checkout. Exclusions take precedence. */
export function matches(rule, root, cwd, target) {
    const path = relative(root, resolve(cwd, target));
    if (!path || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path))
        return false;
    const name = path.split(sep).join("/");
    const hit = (pattern) => minimatch(name, pattern, { dot: true, nonegate: true });
    return !rule.paths.some(p => p.startsWith("!") && hit(p.slice(1)))
        && (!rule.paths.some(p => !p.startsWith("!")) || rule.paths.some(p => !p.startsWith("!") && hit(p)));
}
/** Extract explicit file targets, including both endpoints of patch renames. */
export function targets(tool, input) {
    if (tool === "patch" || tool === "apply_patch") {
        const patch = typeof input === "object" && input !== null && "patchText" in input ? input.patchText : input;
        return typeof patch === "string"
            ? Array.from(patch.matchAll(/^\*\*\* (?:Add File|Delete File|Update File|Move to): (.+?)\r?$/gm), m => m[1])
            : [];
    }
    if (!["read", "edit", "write"].includes(tool) || typeof input !== "object" || !input)
        return [];
    const path = "path" in input ? input.path : "filePath" in input ? input.filePath : undefined;
    return typeof path === "string" ? [path] : [];
}
