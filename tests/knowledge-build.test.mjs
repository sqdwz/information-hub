import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the production build keeps knowledge behind the hidden secondary page", async () => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: root, stdio: "pipe" });

  const index = await readFile(resolve(root, "dist/index.html"), "utf8");
  const knowledge = await readFile(resolve(root, "dist/knowledge.html"), "utf8");
  const publicNav = index.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0] || "";
  const footer = index.match(/<footer[\s\S]*?<\/footer>/)?.[0] || "";

  assert.doesNotMatch(publicNav, /knowledge\.html|知识库/);
  assert.doesNotMatch(footer, /knowledge\.html|知识库/);
  assert.doesNotMatch(index, /data-page="knowledge"/);
  assert.match(index, /id="showcase-knowledge-link"[^>]+href="\.\/knowledge\.html"/);
  assert.match(knowledge, /data-knowledge-app/);
  assert.match(knowledge, /href="\.\/#showcase"/);
});

test("the mobile knowledge toolbar keeps authenticated actions in one compact row", async () => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: root, stdio: "pipe" });
  const css = await readFile(resolve(root, "dist/knowledge.css"), "utf8");
  const mobile = css.match(/@media \(max-width: 820px\) \{[\s\S]*?\n\}/)?.[0] || "";
  const narrow = css.match(/@media \(max-width: 460px\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(mobile, /\.knowledge-topbar__actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.4fr\) repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(narrow, /#knowledge-logout\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
});
