import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ["index.html", "styles.css", "app.js", "industry-brief.css", "industry-brief.js"]) {
  await cp(resolve(root, file), resolve(dist, file));
}
for (const directory of ["assets", "data"]) {
  await cp(resolve(root, directory), resolve(dist, directory), { recursive: true });
}

console.log("Built static site to dist/");
