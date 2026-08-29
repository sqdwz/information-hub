import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "..", "policy-library", "data");
const target = resolve(root, "data", "policy");

await mkdir(target, { recursive: true });
await cp(resolve(source, "index.json"), resolve(target, "index.json"));
await cp(resolve(source, "index.json"), resolve(target, "snapshot.json"));
await cp(resolve(source, "categories.json"), resolve(target, "categories.json"));
await cp(resolve(source, "categories.json"), resolve(target, "categories-snapshot.json"));
await cp(resolve(source, "records"), resolve(target, "records"), { recursive: true, force: true });

console.log("Synced policy-library data into information-hub/data/policy.");
